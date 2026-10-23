import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { idYoutube } from '../lib/youtube'
import { tempoRelativo } from '../lib/texto'
import type { Post } from '../lib/tipos'
import { Avatar, SeloNivel } from './ui'
import { Denunciar } from './Denunciar'

interface Props {
  post: Post
  /** Pode fixar/apagar no mural (diretoria). */
  souDiretoria?: boolean
  aoMudar: () => void
  /** Na página do post os comentários já aparecem embaixo. */
  detalhe?: boolean
}

export function PostCard({ post, souDiretoria = false, aoMudar, detalhe = false }: Props) {
  const { perfil } = useAuth()
  const [curti, setCurti] = useState(post.curti)
  const [curtidas, setCurtidas] = useState(post.curtidas)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const meu = post.autor.id === perfil!.id
  const video = post.video_url ? idYoutube(post.video_url) : null

  async function curtir() {
    setCurti(!curti)
    setCurtidas((n) => n + (curti ? -1 : 1))
    if (curti) await supabase.from('curtidas_post').delete().eq('post_id', post.id).eq('user_id', perfil!.id)
    else await supabase.from('curtidas_post').insert({ post_id: post.id, user_id: perfil!.id })
  }

  async function apagar() {
    if (!confirm('Apagar esta publicação?')) return
    await supabase.from('posts').delete().eq('id', post.id)
    aoMudar()
  }

  async function fixar() {
    await supabase.from('posts').update({ fixado: !post.fixado }).eq('id', post.id)
    aoMudar()
  }

  // Publicação da diretoria em nome do conselho aparece com o nome do conselho.
  const emNomeDoConselho = post.escopo === 'publico' && post.conselho

  return (
    <article className={`cartao post ${post.tipo !== 'normal' ? `post-${post.tipo}` : ''}`}>
      <header className="post-topo">
        {emNomeDoConselho ? (
          <Link to={`/conselhos/${post.conselho!.id}`} className="post-autor">
            <span className="avatar avatar-conselho" aria-hidden>
              🤝
            </span>
            <div>
              <strong>{post.conselho!.nome}</strong>
              <small>
                por {post.autor.nome} · {tempoRelativo(post.created_at)}
              </small>
            </div>
          </Link>
        ) : (
          <Link to={`/pessoas/${post.autor.id}`} className="post-autor">
            <Avatar url={post.autor.avatar_url} nome={post.autor.nome} />
            <div>
              <strong>{post.autor.nome}</strong>
              <small>
                <SeloNivel xp={post.autor.xp} /> · {post.cidade && `${post.cidade} · `}
                {tempoRelativo(post.created_at)}
              </small>
            </div>
          </Link>
        )}
        {post.fixado && <span title="Fixado">📌</span>}
      </header>

      {post.tipo === 'ata' && <span className="etiqueta">📄 Ata</span>}
      {post.tipo === 'aviso' && <span className="etiqueta alerta">📢 Aviso</span>}

      {post.texto && <p className="post-texto">{post.texto}</p>}

      {post.fotos.length > 0 && (
        <div className={`post-fotos n${Math.min(post.fotos.length, 4)}`}>
          {post.fotos.map((f) => (
            <button key={f} onClick={() => setAmpliada(f)} aria-label="Ampliar foto">
              <img src={f} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {ampliada && (
        <div className="foto-ampliada" onClick={() => setAmpliada(null)} role="dialog" aria-label="Foto ampliada">
          <img src={ampliada} alt="" />
        </div>
      )}

      {video ? (
        <div className="video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video}`}
            title="Vídeo"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        post.video_url && (
          <a className="post-link" href={post.video_url} target="_blank" rel="noreferrer noopener">
            ▶️ Assistir ao vídeo <small>{new URL(post.video_url).hostname}</small>
          </a>
        )
      )}
      {post.link_url && (
        <a className="post-link" href={post.link_url} target="_blank" rel="noreferrer noopener">
          🔗 {post.link_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
        </a>
      )}

      <footer className="post-rodape">
        <button className={`chip ${curti ? 'ativo' : ''}`} onClick={curtir} aria-pressed={curti}>
          {curti ? '💚' : '🤍'} {curtidas}
        </button>
        {!detalhe && (
          <Link to={`/posts/${post.id}`} className="chip">
            💬 {post.comentarios}
          </Link>
        )}
        <span className="espaco" />
        {souDiretoria && post.escopo === 'mural' && (
          <button className="link discreto" onClick={fixar}>
            {post.fixado ? 'Desafixar' : 'Fixar'}
          </button>
        )}
        {(meu || perfil!.is_admin || (souDiretoria && post.escopo === 'mural')) && (
          <button className="link discreto perigo" onClick={apagar}>
            Apagar
          </button>
        )}
        {!meu && <Denunciar alvoTipo="post" alvoId={post.id} />}
      </footer>
    </article>
  )
}
