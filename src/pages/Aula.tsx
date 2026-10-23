import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { idYoutube } from '../lib/youtube'
import { dataCurta } from '../lib/texto'
import type { Aula as TAula } from '../lib/tipos'
import { Avatar, Carregando, Erro } from '../components/ui'

interface Comentario {
  id: string
  texto: string
  created_at: string
  user_id: string
  profiles: { nome: string; avatar_url: string | null } | null
}

export function Aula() {
  const { aulaId } = useParams()
  const { perfil, recarregarPerfil } = useAuth()
  const navegar = useNavigate()
  const [ganhou, setGanhou] = useState<number | null>(null)

  const { dados, erro, carregando, recarregar } = useConsulta(async () => {
    const aula = verificar(
      await supabase.from('aulas').select('*, cursos(id, titulo, trilha_id, aulas(id, ordem))').eq('id', aulaId!).single(),
    ) as TAula & { cursos: { id: string; titulo: string; trilha_id: string; aulas: { id: string; ordem: number }[] } }
    const [concluida, curtidas, minhaCurtida, salva, comentarios] = await Promise.all([
      supabase.from('aulas_concluidas').select('aula_id').eq('aula_id', aulaId!).eq('user_id', perfil!.id).maybeSingle(),
      supabase.from('curtidas_aula').select('user_id', { count: 'exact', head: true }).eq('aula_id', aulaId!),
      supabase.from('curtidas_aula').select('user_id').eq('aula_id', aulaId!).eq('user_id', perfil!.id).maybeSingle(),
      supabase.from('aulas_salvas').select('aula_id').eq('aula_id', aulaId!).eq('user_id', perfil!.id).maybeSingle(),
      supabase.from('comentarios_aula').select('*, profiles(nome, avatar_url)').eq('aula_id', aulaId!).order('created_at'),
    ])
    return {
      aula,
      concluida: !!concluida.data,
      curtidas: curtidas.count ?? 0,
      curti: !!minhaCurtida.data,
      salva: !!salva.data,
      comentarios: (comentarios.data ?? []) as Comentario[],
    }
  }, [aulaId, perfil!.id])

  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Aula não encontrada'} />
  const { aula } = dados
  const irmas = [...aula.cursos.aulas].sort((a, b) => a.ordem - b.ordem)
  const proxima = irmas[irmas.findIndex((a) => a.id === aula.id) + 1]

  async function concluir() {
    const { data } = await supabase.rpc('concluir_aula', { p_aula: aula.id })
    if (data) {
      setGanhou(data as number)
      recarregarPerfil()
    }
    recarregar()
  }

  async function alternar(tabela: 'curtidas_aula' | 'aulas_salvas', ativo: boolean) {
    if (ativo) await supabase.from(tabela).delete().eq('aula_id', aula.id).eq('user_id', perfil!.id)
    else await supabase.from(tabela).insert({ aula_id: aula.id, user_id: perfil!.id })
    recarregar()
  }

  const video = aula.video_url ? idYoutube(aula.video_url) : null

  return (
    <div className="pagina">
      <Link to={`/aprender/${aula.cursos.trilha_id}`} className="voltar">
        ← {aula.cursos.titulo}
      </Link>
      <h1>{aula.titulo}</h1>

      {aula.tipo === 'video' &&
        (video ? (
          <div className="video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video}`}
              title={aula.titulo}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          aula.video_url && (
            <a href={aula.video_url} target="_blank" rel="noreferrer" className="botao">
              Assistir ao vídeo
            </a>
          )
        ))}
      {aula.tipo === 'pdf' && aula.pdf_url && (
        <div className="pdf">
          <iframe src={aula.pdf_url} title={aula.titulo} />
          <a href={aula.pdf_url} target="_blank" rel="noreferrer" className="botao secundario">
            📑 Abrir PDF em tela cheia
          </a>
        </div>
      )}
      {aula.texto && (
        <article className="texto-aula">
          <Markdown remarkPlugins={[remarkGfm]}>{aula.texto}</Markdown>
        </article>
      )}

      <div className="barra-acoes">
        <button className={`chip ${dados.curti ? 'ativo' : ''}`} onClick={() => alternar('curtidas_aula', dados.curti)}>
          {dados.curti ? '💚' : '🤍'} {dados.curtidas}
        </button>
        <button className={`chip ${dados.salva ? 'ativo' : ''}`} onClick={() => alternar('aulas_salvas', dados.salva)}>
          🔖 {dados.salva ? 'Salva' : 'Salvar'}
        </button>
      </div>

      {ganhou ? <p className="xp-ganho">+{ganhou} XP!</p> : null}
      {dados.concluida ? (
        <div className="acoes">
          {proxima ? (
            <button className="botao" onClick={() => navegar(`/aula/${proxima.id}`)}>
              Próxima aula →
            </button>
          ) : (
            <Link to={`/questionario/${aula.cursos.id}`} className="botao">
              📝 Ir para o questionário
            </Link>
          )}
        </div>
      ) : (
        <button className="botao grande" onClick={concluir}>
          ✅ Concluir aula (+10 XP)
        </button>
      )}

      <Comentarios aulaId={aula.id} comentarios={dados.comentarios} aoMudar={recarregar} />
    </div>
  )
}

function Comentarios({ aulaId, comentarios, aoMudar }: { aulaId: string; comentarios: Comentario[]; aoMudar: () => void }) {
  const { perfil } = useAuth()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const { error } = await supabase.from('comentarios_aula').insert({ aula_id: aulaId, user_id: perfil!.id, texto: texto.trim() })
    if (error) return setErro(error.message)
    setTexto('')
    aoMudar()
  }

  async function apagar(id: string) {
    await supabase.from('comentarios_aula').delete().eq('id', id)
    aoMudar()
  }

  return (
    <section className="comentarios">
      <h2>Comentários ({comentarios.length})</h2>
      {comentarios.map((c) => (
        <div key={c.id} className="comentario">
          <Avatar url={c.profiles?.avatar_url ?? null} nome={c.profiles?.nome ?? '?'} tamanho={32} />
          <div>
            <Link to={`/pessoas/${c.user_id}`}>
              <strong>{c.profiles?.nome}</strong>
            </Link>{' '}
            <small className="texto-suave">{dataCurta(c.created_at)}</small>
            <p>{c.texto}</p>
            {(c.user_id === perfil!.id || perfil!.is_admin) && (
              <button className="link perigo" onClick={() => apagar(c.id)}>
                Apagar
              </button>
            )}
          </div>
        </div>
      ))}
      <form onSubmit={enviar} className="novo-comentario">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário…" rows={2} maxLength={2000} />
        <Erro mensagem={erro} />
        <button className="botao" disabled={!texto.trim()}>
          Comentar
        </button>
      </form>
    </section>
  )
}
