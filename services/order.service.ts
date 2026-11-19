import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateWompiIntegritySignature } from '@/lib/payments/wompi'
import { CheckoutRequest } from '@/lib/validations/checkout.schema'

export interface CheckoutResult {
  order: {
    id: string
    orderNumber: string
    total: number
    currency: string
    status: string
    paymentStatus: string
  }
  payment: {
    id: string
    gateway: string
    amount: number
    currency: string
    status: string
  }
  checkoutConfig: {
    gateway: string
    publicKey: string
    reference: string
    amountInCents: number
    currency: string
    signature: string
    redirectUrl: string
    customerData: {
      email: string
      fullName: string
      phoneNumber: string
    }
    shippingAddress: {
      addressLine1: string
      city: string
      region: string
      country: string
    }
  }
}

export class OrderService {
  /**
   * Crea una orden completa, valida inventario, calcula montos desde base de datos
   * y genera la sesión y firma de pago para la pasarela seleccionada.
   */
  static async createOrderAndPaymentSession(data: CheckoutRequest): Promise<CheckoutResult> {
    const productIds = data.items.map((item) => item.productId)

    // 1. Obtener productos activos desde Supabase (evitamos manipulación de precios desde el frontend)
    const { data: dbProducts, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, price, stock, sku, is_active')
      .in('id', productIds)

    if (productsError || !dbProducts || dbProducts.length === 0) {
      throw new Error('No se pudieron verificar los productos seleccionados.')
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]))

    // 2. Validar stock y existencia de cada ítem
    let subtotal = 0
    const validatedItems: Array<{
      productId: string
      productName: string
      productSku: string | null
      quantity: number
      unitPrice: number
      totalPrice: number
    }> = []

    for (const item of data.items) {
      const product = productMap.get(item.productId)
      if (!product || !product.is_active) {
        throw new Error(`El producto con ID ${item.productId} no está disponible.`)
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`
        )
      }

      const unitPrice = Number(product.price)
      const itemTotal = unitPrice * item.quantity
      subtotal += itemTotal

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice: itemTotal,
      })
    }

    // 3. Cálculo de costos de envío y descuentos
    // Envío gratis si la compra supera $150.000 COP, sino $12.000 COP
    const shippingCost = subtotal >= 150000 ? 0 : 12000
    let discount = 0

    // Si viene cupón, validarlo
    if (data.couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', data.couponCode.toUpperCase())
        .eq('is_active', true)
        .single()

      if (coupon) {
        const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date()
        const maxReached = coupon.max_uses && coupon.current_uses >= coupon.max_uses

        if (!isExpired && !maxReached && subtotal >= (coupon.min_purchase || 0)) {
          if (coupon.type === 'percentage') {
            discount = (subtotal * Number(coupon.value)) / 100
          } else {
            discount = Number(coupon.value)
          }
        }
      }
    }

    const tax = 0 // Ajustable si se incluye desglose de IVA (ej. 19%)
    const total = Math.max(0, subtotal + shippingCost + tax - discount)

    // 4. Buscar o crear el cliente (Customer)
    let customerId: string
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', data.customer.email.toLowerCase())
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
      await supabaseAdmin
        .from('customers')
        .update({
          full_name: data.customer.fullName,
          phone: data.customer.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    } else {
      const { data: newCustomer, error: custError } = await supabaseAdmin
        .from('customers')
        .insert({
          email: data.customer.email.toLowerCase(),
          phone: data.customer.phone,
          full_name: data.customer.fullName,
          source: data.source,
          status: 'customer',
        })
        .select('id')
        .single()

      if (custError || !newCustomer) {
        throw new Error(`Error al registrar cliente: ${custError?.message}`)
      }
      customerId = newCustomer.id
    }

    // 5. Crear la dirección de envío (Address)
    const { data: newAddress, error: addrError } = await supabaseAdmin
      .from('addresses')
      .insert({
        customer_id: customerId,
        recipient_name: data.shippingAddress.recipientName,
        phone: data.shippingAddress.phone,
        street_address: data.shippingAddress.streetAddress,
        city: data.shippingAddress.city,
        state: data.shippingAddress.state,
        postal_code: data.shippingAddress.postalCode,
        country: data.shippingAddress.country || 'Colombia',
        type: 'shipping',
      })
      .select('id')
      .single()

    if (addrError || !newAddress) {
      throw new Error(`Error al registrar dirección: ${addrError?.message}`)
    }

    // 6. Crear la orden (Order)
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customerId,
        shipping_address_id: newAddress.id,
        billing_address_id: newAddress.id,
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        tax,
        shipping_cost: shippingCost,
        discount,
        total,
        currency: 'COP',
        source: data.source,
        notes: data.notes,
      })
      .select('id, order_number, total, currency, status, payment_status')
      .single()

    if (orderError || !newOrder) {
      throw new Error(`Error al crear la orden: ${orderError?.message}`)
    }

    // 7. Insertar los items de la orden (Order Items)
    const orderItemsPayload = validatedItems.map((item) => ({
      order_id: newOrder.id,
      product_id: item.productId,
      product_name: item.productName,
      product_sku: item.productSku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsPayload)

    if (itemsError) {
      throw new Error(`Error al registrar los items de la orden: ${itemsError.message}`)
    }

    // 8. Crear el registro en PAYMENTS (status: 'pending')
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: newOrder.id,
        gateway: data.gateway,
        amount: total,
        currency: 'COP',
        status: 'pending',
      })
      .select('id, gateway, amount, currency, status')
      .single()

    if (paymentError || !paymentRecord) {
      throw new Error(`Error al registrar la transacción de pago: ${paymentError?.message}`)
    }

    // 9. Registrar el evento en ORDER_STATUS_HISTORY
    await supabaseAdmin.from('order_status_history').insert({
      order_id: newOrder.id,
      previous_status: null,
      new_status: 'pending',
      changed_by: 'system',
      notes: `Orden creada desde ${data.source}. Esperando confirmación de pago por ${data.gateway}.`,
    })

    // 10. Generar los parámetros y firma requeridos por Wompi (o la pasarela elegida)
    const amountInCents = Math.round(total * 100)
    const reference = newOrder.order_number
    const signature = generateWompiIntegritySignature(reference, amountInCents, 'COP')
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
    const redirectUrl = `${frontendUrl}/checkout/confirmacion?order=${reference}`

    return {
      order: {
        id: newOrder.id,
        orderNumber: newOrder.order_number,
        total: Number(newOrder.total),
        currency: newOrder.currency,
        status: newOrder.status,
        paymentStatus: newOrder.payment_status,
      },
      payment: {
        id: paymentRecord.id,
        gateway: paymentRecord.gateway,
        amount: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        status: paymentRecord.status,
      },
      checkoutConfig: {
        gateway: data.gateway,
        publicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || '',
        reference,
        amountInCents,
        currency: 'COP',
        signature,
        redirectUrl,
        customerData: {
          email: data.customer.email,
          fullName: data.customer.fullName,
          phoneNumber: data.customer.phone,
        },
        shippingAddress: {
          addressLine1: data.shippingAddress.streetAddress,
          city: data.shippingAddress.city,
          region: data.shippingAddress.state,
          country: 'CO',
        },
      },
    }
  }
}
