import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    if (!orderNumber) {
      return NextResponse.json({ error: 'Número de orden no proporcionado' }, { status: 400 })
    }

    // Consultar la orden junto con sus items y pagos
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        subtotal,
        tax,
        shipping_cost,
        discount,
        total,
        currency,
        notes,
        created_at,
        customer:customers (
          id,
          full_name,
          email,
          phone
        ),
        shipping_address:addresses!orders_shipping_address_id_fkey (
          recipient_name,
          phone,
          street_address,
          city,
          state,
          country
        ),
        order_items (
          id,
          product_name,
          product_sku,
          quantity,
          unit_price,
          total_price
        ),
        payments (
          id,
          gateway,
          method,
          status,
          amount,
          currency,
          created_at
        )
      `)
      .eq('order_number', orderNumber)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data: order })
  } catch (error: any) {
    console.error('Error al consultar la orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
