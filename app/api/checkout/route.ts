import { NextRequest, NextResponse } from 'next/server'
import { checkoutRequestSchema } from '@/lib/validations/checkout.schema'
import { OrderService } from '@/services/order.service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 1. Validar esquema del payload recibido
    const parseResult = checkoutRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de checkout inválidos',
          details: parseResult.error.format(),
        },
        { status: 400 }
      )
    }

    // 2. Procesar la orden y generar sesión de pago
    const result = await OrderService.createOrderAndPaymentSession(parseResult.data)

    return NextResponse.json(
      {
        message: 'Orden creada exitosamente. Sesión de pago generada.',
        data: result,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error en POST /api/checkout:', error)
    return NextResponse.json(
      {
        error: error.message || 'Ocurrió un error inesperado al procesar la orden',
      },
      { status: 500 }
    )
  }
}
