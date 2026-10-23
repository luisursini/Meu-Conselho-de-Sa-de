import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import type { Questao, ResultadoQuestionario } from '../lib/tipos'
import { Carregando, Erro, Vazio } from '../components/ui'
import { ACERTOS_PARA_APROVAR, QUESTOES_POR_QUESTIONARIO } from '../lib/questionario'

const LETRAS = 'ABCDEF'

export function Questionario() {
  const { cursoId } = useParams()
  const { recarregarPerfil } = useAuth()
  const [respostas, setRespostas] = useState<Record<string, number>>({})
  const [resultado, setResultado] = useState<ResultadoQuestionario | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  const { dados, erro, carregando } = useConsulta(async () => {
    const [curso, questoes] = await Promise.all([
      supabase.from('cursos').select('id, titulo, trilha_id').eq('id', cursoId!).single(),
      supabase.from('questoes').select('*').eq('curso_id', cursoId!).eq('uso', 'curso').order('ordem'),
    ]).then((r) => r.map((x) => verificar<unknown>(x)))
    return { curso: curso as { id: string; titulo: string; trilha_id: string }, questoes: questoes as Questao[] }
  }, [cursoId])

  if (carregando) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Curso não encontrado'} />
  const { curso, questoes } = dados
  const respondidas = Object.keys(respostas).length
  const incompleto = questoes.length < QUESTOES_POR_QUESTIONARIO

  async function enviar() {
    setEnviando(true)
    setErroEnvio(null)
    const { data, error } = await supabase.rpc('enviar_questionario', {
      p_curso: curso.id,
      p_respostas: Object.entries(respostas).map(([questao_id, resposta]) => ({ questao_id, resposta })),
    })
    setEnviando(false)
    if (error) return setErroEnvio(error.message)
    setResultado(data as ResultadoQuestionario)
    recarregarPerfil()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function refazer() {
    setRespostas({})
    setResultado(null)
    window.scrollTo({ top: 0 })
  }

  const correcao = new Map(resultado?.correcao.map((c) => [c.questao_id, c]))

  return (
    <div className="pagina">
      <Link to={`/aprender/${curso.trilha_id}`} className="voltar">
        ← Voltar à trilha
      </Link>
      <h1>Questionário: {curso.titulo}</h1>

      {resultado ? (
        <div className={`cartao resultado ${resultado.aprovado ? 'aprovado' : 'reprovado'}`}>
          <h2>{resultado.aprovado ? '🎉 Aprovado!' : '😕 Ainda não foi dessa vez'}</h2>
          <p className="placar">
            {resultado.acertos} de {resultado.total} ({Math.round((resultado.acertos / resultado.total) * 100)}%)
          </p>
          {resultado.xp_ganho > 0 && <p className="xp-ganho">+{resultado.xp_ganho} XP</p>}
          {resultado.medalha && <p className="medalha-nova">🏅 Você concluiu a trilha e ganhou uma medalha!</p>}
          {!resultado.aprovado && (
            <p>
              Você precisa acertar pelo menos {ACERTOS_PARA_APROVAR} das {QUESTOES_POR_QUESTIONARIO} questões. Revise as aulas e tente
              de novo!
            </p>
          )}
          <div className="acoes">
            <button className="botao secundario" onClick={refazer}>
              Refazer
            </button>
            <Link to={`/aprender/${curso.trilha_id}`} className="botao">
              Voltar à trilha
            </Link>
          </div>
        </div>
      ) : (
        <p className="texto-suave">
          Acerte pelo menos {ACERTOS_PARA_APROVAR} das {QUESTOES_POR_QUESTIONARIO} questões para concluir. Você pode refazer quantas
          vezes quiser.
        </p>
      )}

      {incompleto && <Vazio>Este questionário ainda está sendo preparado. Volte em breve!</Vazio>}
      <ol className="questoes">
        {questoes.map((q) => {
          const c = correcao.get(q.id)
          return (
            <li key={q.id} className="cartao questao">
              <p className="enunciado">{q.enunciado}</p>
              <div className="alternativas" role="radiogroup">
                {q.alternativas.map((alt, i) => {
                  let classe = respostas[q.id] === i ? 'marcada' : ''
                  if (c) classe = i === c.correta ? 'certa' : i === c.resposta ? 'errada' : ''
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={respostas[q.id] === i}
                      className={`alternativa ${classe}`}
                      disabled={!!resultado}
                      onClick={() => setRespostas({ ...respostas, [q.id]: i })}
                    >
                      <span className="letra">{LETRAS[i]}</span>
                      {alt}
                    </button>
                  )
                })}
              </div>
              {c?.explicacao && <p className="explicacao">💡 {c.explicacao}</p>}
            </li>
          )
        })}
      </ol>

      {!resultado && !incompleto && (
        <>
          <Erro mensagem={erroEnvio} />
          <button className="botao grande" disabled={respondidas < questoes.length || enviando} onClick={enviar}>
            {enviando ? 'Corrigindo…' : `Enviar respostas (${respondidas}/${questoes.length})`}
          </button>
        </>
      )}
    </div>
  )
}
