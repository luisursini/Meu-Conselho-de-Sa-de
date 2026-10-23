import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { carregarTrilhas } from '../lib/progresso'
import { useConsulta } from '../lib/useConsulta'
import type { Aula } from '../lib/tipos'
import { Carregando, Erro, Progresso, Vazio } from '../components/ui'

const ICONE_AULA = { texto: '📄', video: '▶️', pdf: '📑' } as const

export function ListaTrilhas() {
  const { perfil } = useAuth()
  const { dados, erro, carregando } = useConsulta(() => carregarTrilhas(perfil!.id), [perfil!.id])

  return (
    <div className="pagina">
      <h1>Aprender</h1>
      <p>Complete as trilhas, responda às questões e ganhe XP e medalhas.</p>
      <Link to="/aprender/salvos" className="link">
        🔖 Aulas salvas
      </Link>
      {carregando && <Carregando />}
      <Erro mensagem={erro} />
      {dados?.length === 0 && <Vazio>Nenhuma trilha publicada ainda.</Vazio>}
      <div className="lista">
        {dados?.map((t) => (
          <Link key={t.id} to={`/aprender/${t.id}`} className="cartao trilha-cartao">
            <span className={`trilha-emoji ${t.concluida ? '' : 'apagado'}`}>{t.medalha_emoji}</span>
            <div>
              <strong>{t.titulo}</strong>
              {t.descricao && <p className="texto-suave">{t.descricao}</p>}
              {t.concluida ? (
                <span className="etiqueta sucesso">Concluída · medalha “{t.medalha_nome}”</span>
              ) : (
                <Progresso feito={t.cursosAprovados} total={t.cursos.length} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function DetalheTrilha() {
  const { trilhaId } = useParams()
  const { perfil } = useAuth()
  const { dados, erro, carregando } = useConsulta(async () => {
    const [trilha, concluidas, aprovados] = await Promise.all([
      supabase.from('trilhas').select('*, cursos(*, aulas(id, titulo, tipo, ordem))').eq('id', trilhaId!).single(),
      supabase.from('aulas_concluidas').select('aula_id').eq('user_id', perfil!.id),
      supabase.from('cursos_aprovados').select('curso_id').eq('user_id', perfil!.id),
    ]).then((r) => r.map((x) => verificar<unknown>(x)))
    return {
      trilha: trilha as {
        titulo: string
        descricao: string | null
        medalha_nome: string
        medalha_emoji: string
        cursos: { id: string; titulo: string; descricao: string | null; ordem: number; aulas: Aula[] }[]
      },
      concluidas: new Set((concluidas as { aula_id: string }[]).map((a) => a.aula_id)),
      aprovados: new Set((aprovados as { curso_id: string }[]).map((a) => a.curso_id)),
    }
  }, [trilhaId, perfil!.id])

  if (carregando) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Trilha não encontrada'} />
  const { trilha, concluidas, aprovados } = dados
  const cursos = [...trilha.cursos].sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="pagina">
      <Link to="/aprender" className="voltar">
        ← Trilhas
      </Link>
      <h1>
        {trilha.medalha_emoji} {trilha.titulo}
      </h1>
      {trilha.descricao && <p>{trilha.descricao}</p>}
      <p className="texto-suave">
        Conclua todos os cursos para ganhar a medalha <strong>“{trilha.medalha_nome}”</strong> e +200 XP.
      </p>
      {cursos.length === 0 && <Vazio>Esta trilha ainda não tem cursos.</Vazio>}
      {cursos.map((c, i) => {
        const aulas = [...c.aulas].sort((a, b) => a.ordem - b.ordem)
        const aprovado = aprovados.has(c.id)
        return (
          <section key={c.id} className="cartao curso">
            <header>
              <span className="curso-num">{i + 1}</span>
              <div>
                <h2>{c.titulo}</h2>
                {c.descricao && <p className="texto-suave">{c.descricao}</p>}
              </div>
            </header>
            <ul className="aulas">
              {aulas.map((a) => (
                <li key={a.id}>
                  <Link to={`/aula/${a.id}`}>
                    <span aria-hidden>{concluidas.has(a.id) ? '✅' : ICONE_AULA[a.tipo]}</span>
                    {a.titulo}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={`/questionario/${c.id}`} className={`botao ${aprovado ? 'secundario' : ''}`}>
              {aprovado ? '✅ Questionário aprovado · refazer' : '📝 Fazer o questionário'}
            </Link>
          </section>
        )
      })}
    </div>
  )
}
