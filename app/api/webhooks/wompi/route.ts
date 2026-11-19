import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  verifyWompiWebhookSignature,
  mapWompiStatusToInternal,
  WompiTransactionEvent,
} from '@/lib/payments/wompi'

export async function POST(req: NextRequest) {
  try {
    const rawBody: WompiTransactionEvent = await req.json()

    // 1. Validar firma criptográfica del Webhook (si está configurado WOMPI_EVENTS_SECRET)
    if (process.env.WOMPI_EVENTS_SECRET) {
      const isValid = verifyWompiWebhookSignature(rawBody)
      if (!isValid) {
        console.warn('⚠️ Webhook de Wompi con firma inválida o sospechosa.')
        return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 })
      }
    }

    const { event, data } = rawBody
    if (event !== 'transaction.updated' || !data?.transaction) {
      // Respondemos 200 para eventos que no requerimos procesar
      return NextResponse.json({ received: true, ignored: true })
    }

    const tx = data.transaction
    const orderNumber = tx.reference
    const { paymentStatus, orderPaymentStatus, orderStatus } = mapWompiStatusToInternal(tx.status)

    // 2. Buscar la orden asociada por su número de referencia
    const { data: order, error: orderLookupError } = await supabaseAdmin
      .from('orders')
      .select('id, status, payment_status, total')
      .eq('order_number', orderNumber)
      .single()

    if (orderLookupError || !order) {
      console.error(`No se encontró la orden con referencia: ${orderNumber}`)
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // 3. Mapear método de pago Wompi
    let paymentMethod: 'card' | 'pse' | 'nequi' | 'cash' | 'bancolombia_transfer' = 'card'
    const methodType = tx.payment_method_type?.toUpperCase()
    if (methodType === 'NEQUI') paymentMethod = 'nequi'
    else if (methodType === 'PSE') paymentMethod = 'pse'
    else if (methodType === 'BANCOLOMBIA_TRANSFER') paymentMethod = 'bancolombia_transfer'

    // 4. Actualizar o crear registro en la tabla PAYMENTS
    await supabaseAdmin
      .from('payments')
      .update({
        gateway_transaction_id: tx.id,
        method: paymentMethod,
        status: paymentStatus,
        error_message: tx.status_message || null,
        raw_response: rawBody,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', order.id)
      .eq('gateway', 'wompi')

    // 5. Si la orden ya estaba aprobada previamente, evitar duplicidad
    if (order.payment_status === 'paid' && orderPaymentStatus === 'paid') {
      return NextResponse.json({ received: true, message: 'La orden ya estaba pagada' })
    }

    const previousStatus = order.status

    // 6. Actualizar el estado de la ORDEN
    await supabaseAdmin
      .from('orders')
      .update({
        status: orderStatus,
        payment_status: orderPaymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    // 7. Si el pago fue APROBADO, descontar stock de los productos
    if (tx.status === 'APPROVED') {
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id)

      if (items && items.length > 0) {
        for (const item of items) {
          if (item.product_id) {
            // Descontar inventario
            const { data: prod } = await supabaseAdmin
              .from('products')
              .select('stock')
              .eq('id', item.product_id)
              .single()

            if (prod) {
              const newStock = Math.max(0, prod.stock - item.quantity)
              await supabaseAdmin
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.product_id)
            }
          }
        }
      }
    }

    // 8. Registrar en el historial de estados (Auditoría)
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      previous_status: previousStatus,
      new_status: orderStatus,
      changed_by: 'webhook',
      notes: `Transacción Wompi ID ${tx.id} estado: ${tx.status}`,
    })

    // 9. Registrar evento en EVENTS_OUTBOX para integraciones futuras (email, n8n, WhatsApp)
    await supabaseAdmin.from('events_outbox').insert({
      event_type: tx.status === 'APPROVED' ? 'order.paid' : 'order.payment_failed',
      entity_type: 'order',
      entity_id: order.id,
      payload: {
        orderNumber,
        wompiTransactionId: tx.id,
        amountInCents: tx.amount_in_cents,
        status: tx.status,
        customerEmail: tx.customer_email,
      },
      status: 'pending',
    })

    return NextResponse.json({
      received: true,
      orderNumber,
      status: tx.status,
    })
  } catch (error: any) {
    console.error('Error procesando Webhook de Wompi:', error)
    return NextResponse.json(
      { error: 'Error interno procesando webhook' },
      { status: 500 }
    )
  }
}
