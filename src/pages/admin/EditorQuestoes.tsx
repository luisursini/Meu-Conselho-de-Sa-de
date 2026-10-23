import { useState } from 'react'
import { supabase, verificar } from '../../lib/supabase'
import { useConsulta } from '../../lib/useConsulta'
import type { Questao } from '../../lib/tipos'
import { Carregando, Erro, Vazio } from '../../components/ui'

interface QuestaoAdmin extends Questao {
  gabaritos: { correta: number; explicacao: string | null } | null
}

interface Rascunho {
  id?: string
  enunciado: string
  alternativas: string[]
  correta: number
  explicacao: string
}

const NOVA: Rascunho = { enunciado: '', alternativas: ['', '', '', ''], correta: 0, explicacao: '' }
const LETRAS = 'ABCDEF'

/** Cria e edita questões de um curso (uso = curso) ou do Modo Desafio de uma trilha (uso = desafio). */
export function EditorQuestoes({ trilhaId, cursoId, uso }: { trilhaId: string; cursoId: string | null; uso: 'curso' | 'desafio' }) {
  const [editando, setEditando] = useState<Rascunho | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { dados, carregando, recarregar } = useConsulta(async () => {
    let q = supabase.from('questoes').select('*, gabaritos(correta, explicacao)').eq('uso', uso).order('ordem')
    q = cursoId ? q.eq('curso_id', cursoId) : q.eq('trilha_id', trilhaId)
    return verificar(await q) as QuestaoAdmin[]
  }, [trilhaId, cursoId, uso])

  async function salvar() {
    if (!editando) return
    setErro(null)
    const alternativas = editando.alternativas.map((a) => a.trim()).filter(Boolean)
    if (!editando.enunciado.trim()) return setErro('Escreva o enunciado')
    if (alternativas.length < 2) return setErro('Informe ao menos duas alternativas')
    if (!editando.alternativas[editando.correta]?.trim()) return setErro('Marque uma alternativa correta preenchida')
    // Reindexa a correta depois de remover alternativas vazias.
    const correta = editando.alternativas.slice(0, editando.correta).filter((a) => a.trim()).length

    const linha = {
      trilha_id: trilhaId,
      curso_id: cursoId,
      uso,
      enunciado: editando.enunciado.trim(),
      alternativas,
      ordem: editando.id ? undefined : (dados?.length ?? 0) + 1,
    }
    const res = editando.id
      ? await supabase.from('questoes').update(linha).eq('id', editando.id).select().single()
      : await supabase.from('questoes').insert(linha).select().single()
    if (res.error) return setErro(res.error.message)
    const { error } = await supabase
      .from('gabaritos')
      .upsert({ questao_id: res.data.id, correta, explicacao: editando.explicacao.trim() || null })
    if (error) return setErro(error.message)
    setEditando(null)
    recarregar()
  }

  async function apagar(id: string) {
    if (!confirm('Apagar esta questão?')) return
    await supabase.from('questoes').delete().eq('id', id)
    recarregar()
  }

  if (carregando) return <Carregando />

  return (
    <div className="editor-questoes">
      {dados?.length === 0 && !editando && <Vazio>Nenhuma questão ainda.</Vazio>}
      <ol className="lista-admin">
        {dados?.map((q) => (
          <li key={q.id}>
            <div>
              <p>{q.enunciado}</p>
              <small className="texto-suave">
                Resposta: {LETRAS[q.gabaritos?.correta ?? 0]}) {q.alternativas[q.gabaritos?.correta ?? 0]}
              </small>
            </div>
            <div className="acoes-linha">
              <button
                className="link"
                onClick={() =>
                  setEditando({
                    id: q.id,
                    enunciado: q.enunciado,
                    alternativas: [...q.alternativas, ...Array(Math.max(0, 4 - q.alternativas.length)).fill('')],
                    correta: q.gabaritos?.correta ?? 0,
                    explicacao: q.gabaritos?.explicacao ?? '',
                  })
                }
              >
                Editar
              </button>
              <button className="link perigo" onClick={() => apagar(q.id)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ol>

      {editando ? (
        <div className="caixa formulario">
          <label>
            Enunciado
            <textarea rows={3} value={editando.enunciado} onChange={(e) => setEditando({ ...editando, enunciado: e.target.value })} />
          </label>
          <span className="rotulo">Alternativas (marque a correta)</span>
          {editando.alternativas.map((alt, i) => (
            <div key={i} className="alternativa-edicao">
              <input
                type="radio"
                name="correta"
                aria-label={`Alternativa ${LETRAS[i]} é a correta`}
                checked={editando.correta === i}
                onChange={() => setEditando({ ...editando, correta: i })}
              />
              <span className="letra">{LETRAS[i]}</span>
              <input
                value={alt}
                placeholder={i < 2 ? 'Obrigatória' : 'Opcional'}
                onChange={(e) => {
                  const alternativas = [...editando.alternativas]
                  alternativas[i] = e.target.value
                  setEditando({ ...editando, alternativas })
                }}
              />
            </div>
          ))}
          {editando.alternativas.length < 6 && (
            <button type="button" className="link" onClick={() => setEditando({ ...editando, alternativas: [...editando.alternativas, ''] })}>
              + alternativa
            </button>
          )}
          <label>
            Explicação (aparece depois da correção)
            <textarea rows={2} value={editando.explicacao} onChange={(e) => setEditando({ ...editando, explicacao: e.target.value })} />
          </label>
          <Erro mensagem={erro} />
          <div className="acoes">
            <button className="botao secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button className="botao" onClick={salvar}>
              Salvar questão
            </button>
          </div>
        </div>
      ) : (
        <button className="botao secundario" onClick={() => setEditando({ ...NOVA, alternativas: [...NOVA.alternativas] })}>
          + Nova questão
        </button>
      )}
    </div>
  )
}
