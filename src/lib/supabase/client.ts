import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'

// Única instancia del cliente Supabase en el navegador.
// Solo usa la publishable key: es pública por diseño y RLS protege los datos.
// Nunca pongas aquí una clave privilegiada (spec §27; lo vigila `npm run check:secrets`).

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local y complétalo.',
  )
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
