import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'

interface AuthValor {
  sessao: Session | null
  perfil: Perfil | null
  carregando: boolean
  entrarComGoogle: () => Promise<void>
  sair: () => Promise<void>
  recarregarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthValor | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  const buscarPerfil = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setPerfil(data as Perfil | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session)
      await buscarPerfil(data.session?.user.id)
      setCarregando(false)
    })
    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
      // Fora do callback para não travar o cliente do Supabase.
      setTimeout(() => buscarPerfil(novaSessao?.user.id), 0)
    })
    return () => inscricao.subscription.unsubscribe()
  }, [buscarPerfil])

  const valor: AuthValor = {
    sessao,
    perfil,
    carregando,
    entrarComGoogle: async () => {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    },
    sair: async () => {
      await supabase.auth.signOut()
      setPerfil(null)
    },
    recarregarPerfil: () => buscarPerfil(sessao?.user.id),
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
