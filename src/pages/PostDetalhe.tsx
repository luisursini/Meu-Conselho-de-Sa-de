import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { tempoRelativo } from '../lib/texto'
import type { Post } from '../lib/tipos'
import { PostCard } from '../components/PostCard'
import { Denunciar } from '../components/Denunciar'
import { Avatar, Carregando, Erro, Vazio } from '../components/ui'

interface Comentario {
  id: string
  texto: string
  created_at: string
  autor_id: string
  profiles: { nome: string; avatar_url: string | null }
}

export function PostDetalhe() {
  const { postId } = useParams()
  const { perfil } = useAuth()
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const { dados, carregando, recarregar } = useConsulta(async () => {
    const [post] = verificar(await supabase.rpc('feed', { p_aba: 'post', p_ref: postId })) as Post[]
    if (!post) return null
    const comentarios = verificar(
      await supabase.from('comentarios_post').select('*, profiles(nome, avatar_url)').eq('post_id', postId!).order('created_at'),
    ) as Comentario[]
    const souDiretoria = post.conselho
      ? !!(await supabase.from('diretoria').select('user_id').eq('conselho_id', post.conselho.id).eq('user_id', perfil!.id).maybeSingle()).data
      : false
    return { post, comentarios, souDiretoria }
  }, [postId, perfil!.id])

  async function comentar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const { error } = await supabase.from('comentarios_post').insert({ post_id: postId, autor_id: perfil!.id, texto: texto.trim() })
    if (error) return setErro(error.message)
    setTexto('')
    recarregar()
  }

  async function apagar(id: string) {
    await supabase.from('comentarios_post').delete().eq('id', id)
    recarregar()
  }

  if (carregando && !dados) return <Carregando />
  if (!dados) return <Vazio>Publicação não encontrada ou removida.</Vazio>

  return (
    <div className="pagina">
      <button className="voltar link" onClick={() => navegar(-1)}>
        ← Voltar
      </button>
      <PostCard post={dados.post} souDiretoria={dados.souDiretoria} aoMudar={() => navegar(-1)} detalhe />
      <section className="comentarios">
        <h2>Comentários ({dados.comentarios.length})</h2>
        {dados.comentarios.map((c) => (
          <div key={c.id} className="comentario">
            <Avatar url={c.profiles.avatar_url} nome={c.profiles.nome} tamanho={32} />
            <div>
              <Link to={`/pessoas/${c.autor_id}`}>
                <strong>{c.profiles.nome}</strong>
              </Link>{' '}
              <small className="texto-suave">{tempoRelativo(c.created_at)}</small>
              <p>{c.texto}</p>
              <div className="acoes-linha">
                {(c.autor_id === perfil!.id || perfil!.is_admin) && (
                  <button className="link discreto perigo" onClick={() => apagar(c.id)}>
                    Apagar
                  </button>
                )}
                {c.autor_id !== perfil!.id && <Denunciar alvoTipo="comentario_post" alvoId={c.id} />}
              </div>
            </div>
          </div>
        ))}
        <form onSubmit={comentar} className="novo-comentario">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário…" rows={2} maxLength={2000} />
          <Erro mensagem={erro} />
          <button className="botao" disabled={!texto.trim()}>
            Comentar
          </button>
        </form>
      </section>
    </div>
  )
}
