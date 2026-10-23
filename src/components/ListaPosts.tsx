import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AbaFeed, Post } from '../lib/tipos'
import { PostCard } from './PostCard'
import { Carregando, Erro, Vazio } from './ui'

const POR_PAGINA = 20

interface Props {
  aba: AbaFeed
  /** Conselho (abas conselho/mural) ou pessoa (aba pessoa). */
  ref_?: string
  souDiretoria?: boolean
  vazio: string
  /** Muda para forçar recarregar (ex.: depois de publicar). */
  versao?: number
}

/** Lista de publicações com "carregar mais". */
export function ListaPosts({ aba, ref_, souDiretoria, vazio, versao = 0 }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [carregando, setCarregando] = useState(true)
  const [temMais, setTemMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(
    async (antes: string | null) => {
      setCarregando(true)
      const { data, error } = await supabase.rpc('feed', { p_aba: aba, p_antes: antes, p_limite: POR_PAGINA, p_ref: ref_ ?? null })
      setCarregando(false)
      if (error) return setErro(error.message)
      const lote = (data ?? []) as Post[]
      setPosts((atual) => (antes ? [...atual, ...lote] : lote))
      setTemMais(lote.length === POR_PAGINA)
    },
    [aba, ref_],
  )

  useEffect(() => {
    setPosts([])
    carregar(null)
  }, [carregar, versao])

  return (
    <div className="lista">
      <Erro mensagem={erro} />
      {posts.map((p) => (
        <PostCard key={p.id} post={p} souDiretoria={souDiretoria} aoMudar={() => carregar(null)} />
      ))}
      {carregando && <Carregando />}
      {!carregando && posts.length === 0 && <Vazio>{vazio}</Vazio>}
      {!carregando && temMais && (
        <button className="botao secundario" onClick={() => carregar(posts[posts.length - 1].created_at)}>
          Carregar mais
        </button>
      )}
    </div>
  )
}
