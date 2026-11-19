import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Cliente de Supabase con permisos de Service Role (Admin).
 * Debe usarse EXCLUSIVAMENTE en el servidor (Route Handlers, Webhooks, Server Actions).
 * Permite omitir RLS para registrar transacciones de pago, pedidos y auditoría.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
