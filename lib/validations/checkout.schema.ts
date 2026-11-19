import { z } from 'zod'

export const checkoutItemSchema = z.object({
  productId: z.string().uuid({ message: 'ID de producto inválido' }),
  quantity: z.number().int().positive({ message: 'La cantidad debe ser mayor a 0' }),
})

export const checkoutAddressSchema = z.object({
  recipientName: z.string().min(2, { message: 'El nombre del destinatario es requerido' }),
  phone: z.string().min(7, { message: 'Teléfono de contacto inválido' }),
  streetAddress: z.string().min(5, { message: 'Dirección completa requerida' }),
  city: z.string().min(2, { message: 'Ciudad requerida' }),
  state: z.string().min(2, { message: 'Departamento / Estado requerido' }),
  postalCode: z.string().optional(),
  country: z.string().default('Colombia'),
})

export const checkoutRequestSchema = z.object({
  customer: z.object({
    fullName: z.string().min(2, { message: 'El nombre completo es requerido' }),
    email: z.string().email({ message: 'Correo electrónico inválido' }),
    phone: z.string().min(7, { message: 'Teléfono inválido' }),
  }),
  shippingAddress: checkoutAddressSchema,
  items: z.array(checkoutItemSchema).min(1, { message: 'El carrito no puede estar vacío' }),
  couponCode: z.string().trim().optional(),
  gateway: z.enum(['wompi', 'mercadopago', 'bold', 'payu', 'stripe']).default('wompi'),
  source: z.enum(['web', 'whatsapp']).default('web'),
  notes: z.string().optional(),
})

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
