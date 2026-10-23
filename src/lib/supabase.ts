import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config'

// No computador (npm run dev) o .env pode apontar para outro banco de testes;
// o app publicado usa sempre o projeto definido em src/config.ts.
const url = (import.meta.env.DEV && import.meta.env.VITE_SUPABASE_URL) || SUPABASE_URL
const chave = (import.meta.env.DEV && import.meta.env.VITE_SUPABASE_ANON_KEY) || SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Lança o erro do Supabase com uma mensagem legível, ou devolve os dados. */
export function verificar<T>(resultado: { data: T; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message)
  return resultado.data
}
