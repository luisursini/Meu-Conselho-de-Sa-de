import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, verificar } from '../../lib/supabase'
import { useConsulta } from '../../lib/useConsulta'
import type { Aula, Curso, TipoAula } from '../../lib/tipos'
import { Carregando, Erro, Vazio } from '../../components/ui'
import { EditorQuestoes } from './EditorQuestoes'
import { ACERTOS_PARA_APROVAR, QUESTOES_POR_QUESTIONARIO } from '../../lib/questionario'

const TIPOS: Record<TipoAula, string> = { texto: '📄 Texto', video: '▶️ Vídeo (YouTube)', pdf: '📑 PDF' }

export function AdminCurso() {
  const { cursoId } = useParams()
  const navegar = useNavigate()
  const [f, setF] = useState<Curso | null>(null)
  const [aulaEditando, setAulaEditando] = useState<Partial<Aula> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const { dados, carregando, recarregar } = useConsulta(async () => {
    const c = verificar(await supabase.from('cursos').select('*, aulas(*), trilhas(titulo)').eq('id', cursoId!).single())
    return c as Curso & { aulas: Aula[]; trilhas: { titulo: string } }
  }, [cursoId])

  useEffect(() => {
    if (dados) setF(dados)
  }, [dados])

  if (carregando || !f || !dados) return <Carregando />
  const aulas = [...dados.aulas].sort((a, b) => a.ordem - b.ordem)

  async function salvarCurso(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('cursos').update({ titulo: f!.titulo, descricao: f!.descricao || null }).eq('id', f!.id)
    if (error) return setErro(error.message)
    setMsg('Curso salvo!')
    recarregar()
  }

  async function apagarCurso() {
    if (!confirm('Apagar este curso com todas as aulas e questões?')) return
    await supabase.from('cursos').delete().eq('id', f!.id)
    navegar(`/admin/trilhas/${f!.trilha_id}`)
  }

  async function moverAula(aula: Aula, direcao: -1 | 1) {
    const outra = aulas[aulas.indexOf(aula) + direcao]
    if (!outra) return
    await Promise.all([
      supabase.from('aulas').update({ ordem: outra.ordem }).eq('id', aula.id),
      supabase.from('aulas').update({ ordem: aula.ordem }).eq('id', outra.id),
    ])
    recarregar()
  }

  return (
    <>
      <Link to={`/admin/trilhas/${f.trilha_id}`} className="voltar">
        ← {dados.trilhas.titulo}
      </Link>
      <form className="cartao formulario" onSubmit={salvarCurso}>
        <h2>Dados do curso</h2>
        <label>
          Título
          <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        </label>
        <label>
          Descrição
          <textarea rows={2} value={f.descricao ?? ''} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </label>
        <Erro mensagem={erro} />
        {msg && <p className="sucesso-msg">{msg}</p>}
        <button className="botao">Salvar curso</button>
      </form>

      <section className="cartao">
        <h2>Aulas</h2>
        {aulas.length === 0 && <Vazio>Nenhuma aula ainda.</Vazio>}
        <ol className="lista-admin">
          {aulas.map((a, i) => (
            <li key={a.id}>
              <button className="link" onClick={() => setAulaEditando(a)}>
                {TIPOS[a.tipo].split(' ')[0]} {a.titulo}
              </button>
              <div className="acoes-linha">
                <button className="link" disabled={i === 0} onClick={() => moverAula(a, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="link" disabled={i === aulas.length - 1} onClick={() => moverAula(a, 1)} aria-label="Descer">
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
        {aulaEditando ? (
          <EditorAula
            aula={aulaEditando}
            cursoId={f.id}
            ordem={aulas.length + 1}
            aoFechar={() => {
              setAulaEditando(null)
              recarregar()
            }}
          />
        ) : (
          <button className="botao secundario" onClick={() => setAulaEditando({ tipo: 'texto', titulo: '' })}>
            + Nova aula
          </button>
        )}
      </section>

      <section className="cartao">
        <h2>📝 Questões do curso</h2>
        <p className="texto-suave">
          Cada questionário tem {QUESTOES_POR_QUESTIONARIO} questões, e a pessoa precisa acertar pelo menos {ACERTOS_PARA_APROVAR}{' '}
          para concluir o curso. O questionário só aparece para as pessoas quando as {QUESTOES_POR_QUESTIONARIO} estiverem cadastradas.
        </p>
        <EditorQuestoes trilhaId={f.trilha_id} cursoId={f.id} uso="curso" />
      </section>

      <button className="botao perigo" onClick={apagarCurso}>
        Apagar curso
      </button>
    </>
  )
}

function EditorAula({ aula, cursoId, ordem, aoFechar }: { aula: Partial<Aula>; cursoId: string; ordem: number; aoFechar: () => void }) {
  const [a, setA] = useState(aula)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviarPdf(arquivo: File) {
    setEnviando(true)
    setErro(null)
    const caminho = `aulas/${crypto.randomUUID()}.pdf`
    const { error } = await supabase.storage.from('materiais').upload(caminho, arquivo, { contentType: 'application/pdf' })
    setEnviando(false)
    if (error) return setErro(error.message)
    setA({ ...a, pdf_url: supabase.storage.from('materiais').getPublicUrl(caminho).data.publicUrl })
  }

  async function salvar() {
    setErro(null)
    if (!a.titulo?.trim()) return setErro('Informe o título da aula')
    if (a.tipo === 'video' && !a.video_url?.trim()) return setErro('Cole o link do vídeo')
    if (a.tipo === 'pdf' && !a.pdf_url?.trim()) return setErro('Envie o PDF ou cole um link')
    if (a.tipo === 'texto' && !a.texto?.trim()) return setErro('Escreva o texto da aula')
    const linha = {
      curso_id: cursoId,
      titulo: a.titulo.trim(),
      tipo: a.tipo,
      texto: a.texto?.trim() || null,
      video_url: a.tipo === 'video' ? a.video_url?.trim() : null,
      pdf_url: a.tipo === 'pdf' ? a.pdf_url?.trim() : null,
    }
    const { error } = a.id
      ? await supabase.from('aulas').update(linha).eq('id', a.id)
      : await supabase.from('aulas').insert({ ...linha, ordem })
    if (error) return setErro(error.message)
    aoFechar()
  }

  async function apagar() {
    if (!a.id || !confirm('Apagar esta aula?')) return
    await supabase.from('aulas').delete().eq('id', a.id)
    aoFechar()
  }

  return (
    <div className="caixa formulario">
      <label>
        Título da aula
        <input value={a.titulo ?? ''} onChange={(e) => setA({ ...a, titulo: e.target.value })} />
      </label>
      <label>
        Tipo
        <select value={a.tipo} onChange={(e) => setA({ ...a, tipo: e.target.value as TipoAula })}>
          {Object.entries(TIPOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      {a.tipo === 'video' && (
        <label>
          Link do vídeo
          <input
            type="url"
            value={a.video_url ?? ''}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => setA({ ...a, video_url: e.target.value })}
          />
        </label>
      )}
      {a.tipo === 'pdf' && (
        <>
          <label>
            Enviar arquivo PDF
            <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && enviarPdf(e.target.files[0])} />
          </label>
          {enviando && <Carregando texto="Enviando PDF…" />}
          <label>
            …ou link do PDF
            <input type="url" value={a.pdf_url ?? ''} onChange={(e) => setA({ ...a, pdf_url: e.target.value })} />
          </label>
        </>
      )}
      <label>
        {a.tipo === 'texto' ? 'Texto da aula' : 'Texto de apoio (opcional)'}
        <textarea rows={10} value={a.texto ?? ''} onChange={(e) => setA({ ...a, texto: e.target.value })} />
        <small className="texto-suave">
          Dica: use <code>## Título</code> para subtítulos, <code>**negrito**</code> e <code>- item</code> para listas.
        </small>
      </label>
      <Erro mensagem={erro} />
      <div className="acoes">
        {a.id && (
          <button className="botao perigo" onClick={apagar}>
            Apagar
          </button>
        )}
        <button className="botao secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao" onClick={salvar} disabled={enviando}>
          Salvar aula
        </button>
      </div>
    </div>
  )
}
