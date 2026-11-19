export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CustomerStatus = 'lead' | 'customer' | 'vip' | 'inactive'
export type CustomerSource = 'web' | 'whatsapp' | 'instagram' | 'manual'
export type AddressType = 'shipping' | 'billing' | 'both'
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentGateway = 'wompi' | 'mercadopago' | 'payu' | 'bold' | 'stripe'
export type PaymentMethod = 'card' | 'pse' | 'nequi' | 'cash' | 'bancolombia_transfer'
export type TransactionStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
export type ChangedBy = 'system' | 'webhook' | 'n8n' | 'admin'

export interface Customer {
  id: string
  email: string | null
  phone: string | null
  full_name: string
  status: CustomerStatus
  source: CustomerSource
  notes?: string | null
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  customer_id: string
  label: string
  type: AddressType
  recipient_name: string
  phone: string
  street_address: string
  city: string
  state: string
  postal_code?: string | null
  country: string
  is_default: boolean
  created_at: string
}

export interface ProductCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  category_id?: string | null
  name: string
  slug: string
  description?: string | null
  short_description?: string | null
  price: number
  compare_at_price?: number | null
  stock: number
  sku?: string | null
  images: string[]
  is_active: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_id?: string | null
  shipping_address_id?: string | null
  billing_address_id?: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  subtotal: number
  tax: number
  shipping_cost: number
  discount: number
  total: number
  currency: string
  source: 'web' | 'whatsapp'
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id?: string | null
  product_name: string
  product_sku?: string | null
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
}

export interface Payment {
  id: string
  order_id: string
  gateway: PaymentGateway
  gateway_transaction_id?: string | null
  gateway_customer_id?: string | null
  method?: PaymentMethod | null
  amount: number
  currency: string
  status: TransactionStatus
  error_message?: string | null
  raw_response?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  previous_status?: string | null
  new_status: string
  changed_by: ChangedBy
  notes?: string | null
  created_at: string
}

export interface EventOutbox {
  id: string
  event_type: string
  entity_type: 'order' | 'customer' | 'payment'
  entity_id: string
  payload: Record<string, any>
  status: 'pending' | 'processing' | 'processed' | 'failed'
  attempts: number
  processed_at?: string | null
  created_at: string
}
