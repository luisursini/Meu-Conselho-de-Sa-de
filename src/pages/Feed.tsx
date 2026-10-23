import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { ListaPosts } from '../components/ListaPosts'
import { NovoPost } from '../components/NovoPost'

type Aba = 'nacional' | 'cidade' | 'seguindo'

const ABAS: [Aba, string][] = [
  ['nacional', '🇧🇷 Nacional'],
  ['cidade', '📍 Minha cidade'],
  ['seguindo', '⭐ Seguindo'],
]

const VAZIO: Record<Aba, string> = {
  nacional: 'Ainda não há publicações. Que tal ser a primeira pessoa a publicar?',
  cidade: 'Ainda não há publicações da sua cidade.',
  seguindo: 'Siga pessoas e conselhos para ver as publicações deles aqui.',
}

function abaSalva(): Aba {
  try {
    const a = localStorage.getItem('feed-aba')
    if (a === 'nacional' || a === 'cidade' || a === 'seguindo') return a
  } catch {
    /* sem armazenamento local */
  }
  return 'nacional'
}

export function Feed() {
  const { perfil } = useAuth()
  const [aba, setAba] = useState<Aba>(abaSalva)
  const [versao, setVersao] = useState(0)

  // Diretoria pode publicar em nome do conselho.
  const meuConselho = useConsulta(async () => {
    if (!perfil!.conselho_id) return null
    const { data } = await supabase
      .from('diretoria')
      .select('conselhos(id, nome)')
      .eq('user_id', perfil!.id)
      .eq('conselho_id', perfil!.conselho_id)
      .maybeSingle()
    return (data as unknown as { conselhos: { id: string; nome: string } } | null)?.conselhos ?? null
  }, [perfil!.id, perfil!.conselho_id])

  function trocar(a: Aba) {
    setAba(a)
    try {
      localStorage.setItem('feed-aba', a)
    } catch {
      /* sem armazenamento local */
    }
  }

  return (
    <div className="pagina">
      <h1>Feed</h1>
      <div className="abas abas-largas" role="tablist">
        {ABAS.map(([v, r]) => (
          <button key={v} role="tab" aria-selected={aba === v} className={aba === v ? 'ativa' : ''} onClick={() => trocar(v)}>
            {r}
          </button>
        ))}
      </div>
      <NovoPost comoConselho={meuConselho.dados} aoPublicar={() => setVersao((v) => v + 1)} />
      <ListaPosts aba={aba} vazio={VAZIO[aba]} versao={versao} />
    </div>
  )
}
