import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

// Only the publishable (anon) key belongs in the browser. Never use the service role key here.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})
