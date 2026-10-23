import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient(url ?? 'http://localhost', chave ?? 'chave-ausente', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Lança o erro do Supabase com uma mensagem legível, ou devolve os dados. */
export function verificar<T>(resultado: { data: T; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message)
  return resultado.data
}
