import crypto from 'crypto'

export interface WompiCheckoutData {
  reference: string
  amountInCents: number
  currency: string
  integritySignature: string
  publicKey: string
  redirectUrl?: string
}

export interface WompiTransactionEvent {
  event: string
  data: {
    transaction: {
      id: string
      amount_in_cents: number
      reference: string
      customer_email: string
      currency: string
      payment_method_type: string
      status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
      status_message?: string
      shipping_address?: any
      payment_method?: any
    }
  }
  environment: 'test' | 'prod'
  signature: {
    properties: string[]
    checksum: string
  }
  timestamp: number
  sent_at: string
}

/**
 * Genera la firma de integridad requerida por Wompi para asegurar
 * que ni el monto ni la referencia fueron manipulados por el cliente.
 * Fórmula: SHA256(referencia + montoEnCentavos + moneda + secretoIntegridad)
 */
export function generateWompiIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string = 'COP',
  integritySecret: string = process.env.WOMPI_INTEGRITY_SECRET || ''
): string {
  const concatenatedString = `${reference}${amountInCents}${currency}${integritySecret}`
  return crypto.createHash('sha256').update(concatenatedString, 'utf8').digest('hex')
}

/**
 * Valida la autenticidad de un webhook enviado por Wompi usando el secreto de eventos.
 * Concatena los valores de las propiedades indicadas en signature.properties + timestamp + eventsSecret
 */
export function verifyWompiWebhookSignature(
  event: WompiTransactionEvent,
  eventsSecret: string = process.env.WOMPI_EVENTS_SECRET || ''
): boolean {
  try {
    if (!event.signature || !event.signature.properties || !event.signature.checksum) {
      return false
    }

    const { properties, checksum } = event.signature
    let concatenatedValues = ''

    for (const prop of properties) {
      const parts = prop.split('.')
      let val: any = event.data
      for (const part of parts) {
        val = val?.[part]
      }
      concatenatedValues += val !== undefined && val !== null ? String(val) : ''
    }

    // Se concatena el timestamp y el secreto de eventos configurado en el panel de Wompi
    concatenatedValues += `${event.timestamp}${eventsSecret}`
    const calculatedHash = crypto.createHash('sha256').update(concatenatedValues, 'utf8').digest('hex')

    return calculatedHash.toLowerCase() === checksum.toLowerCase()
  } catch (error) {
    console.error('Error al validar la firma del webhook de Wompi:', error)
    return false
  }
}

/**
 * Mapea el estado de transacción de Wompi a nuestros estados internos.
 */
export function mapWompiStatusToInternal(wompiStatus: string): {
  paymentStatus: 'pending' | 'processing' | 'succeeded' | 'failed'
  orderPaymentStatus: 'pending' | 'paid' | 'failed'
  orderStatus: 'pending' | 'confirmed' | 'cancelled'
} {
  switch (wompiStatus) {
    case 'APPROVED':
      return {
        paymentStatus: 'succeeded',
        orderPaymentStatus: 'paid',
        orderStatus: 'confirmed',
      }
    case 'DECLINED':
    case 'VOIDED':
    case 'ERROR':
      return {
        paymentStatus: 'failed',
        orderPaymentStatus: 'failed',
        orderStatus: 'cancelled',
      }
    case 'PENDING':
    default:
      return {
        paymentStatus: 'processing',
        orderPaymentStatus: 'pending',
        orderStatus: 'pending',
      }
  }
}
