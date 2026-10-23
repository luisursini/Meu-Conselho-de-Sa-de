import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, verificar } from '../../lib/supabase'
import { useConsulta } from '../../lib/useConsulta'
import type { Curso, Trilha } from '../../lib/tipos'
import { Carregando, Erro, Vazio } from '../../components/ui'
import { EditorQuestoes } from './EditorQuestoes'
import { QUESTOES_POR_QUESTIONARIO } from '../../lib/questionario'

export function AdminTrilha() {
  const { trilhaId } = useParams()
  const navegar = useNavigate()
  const [f, setF] = useState<Trilha | null>(null)
  const [novoCurso, setNovoCurso] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const { dados, carregando, recarregar } = useConsulta(async () => {
    const t = verificar(await supabase.from('trilhas').select('*, cursos(*, aulas(id), questoes(id))').eq('id', trilhaId!).single())
    return t as Trilha & { cursos: (Curso & { aulas: { id: string }[]; questoes: { id: string }[] })[] }
  }, [trilhaId])

  useEffect(() => {
    if (dados) setF(dados)
  }, [dados])

  if (carregando || !f || !dados) return <Carregando />
  const cursos = [...dados.cursos].sort((a, b) => a.ordem - b.ordem)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsg(null)
    const { error } = await supabase
      .from('trilhas')
      .update({
        titulo: f!.titulo,
        descricao: f!.descricao || null,
        ordem: f!.ordem,
        medalha_nome: f!.medalha_nome,
        medalha_emoji: f!.medalha_emoji,
        publicada: f!.publicada,
      })
      .eq('id', f!.id)
    if (error) return setErro(error.message)
    setMsg('Trilha salva!')
    recarregar()
  }

  async function criarCurso(e: FormEvent) {
    e.preventDefault()
    if (!novoCurso.trim()) return
    const { data, error } = await supabase
      .from('cursos')
      .insert({ trilha_id: f!.id, titulo: novoCurso.trim(), ordem: cursos.length + 1 })
      .select()
      .single()
    if (error) return setErro(error.message)
    navegar(`/admin/cursos/${data.id}`)
  }

  async function mover(curso: Curso, direcao: -1 | 1) {
    const outro = cursos[cursos.indexOf(curso as (typeof cursos)[number]) + direcao]
    if (!outro) return
    await Promise.all([
      supabase.from('cursos').update({ ordem: outro.ordem }).eq('id', curso.id),
      supabase.from('cursos').update({ ordem: curso.ordem }).eq('id', outro.id),
    ])
    recarregar()
  }

  async function apagarTrilha() {
    if (!confirm('Apagar a trilha inteira, com cursos, aulas e questões? Isso não pode ser desfeito.')) return
    await supabase.from('trilhas').delete().eq('id', f!.id)
    navegar('/admin')
  }

  return (
    <>
      <Link to="/admin" className="voltar">
        ← Trilhas
      </Link>
      <form className="cartao formulario" onSubmit={salvar}>
        <h2>Dados da trilha</h2>
        <label>
          Título
          <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        </label>
        <label>
          Descrição
          <textarea rows={2} value={f.descricao ?? ''} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        </label>
        <div className="duas-colunas">
          <label>
            Nome da medalha
            <input value={f.medalha_nome} onChange={(e) => setF({ ...f, medalha_nome: e.target.value })} />
          </label>
          <label>
            Emoji da medalha
            <input value={f.medalha_emoji} maxLength={4} onChange={(e) => setF({ ...f, medalha_emoji: e.target.value })} />
          </label>
        </div>
        <label>
          Ordem
          <input type="number" value={f.ordem} onChange={(e) => setF({ ...f, ordem: Number(e.target.value) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={f.publicada} onChange={(e) => setF({ ...f, publicada: e.target.checked })} />
          Publicada (visível para todos)
        </label>
        <Erro mensagem={erro} />
        {msg && <p className="sucesso-msg">{msg}</p>}
        <button className="botao">Salvar trilha</button>
      </form>

      <section className="cartao">
        <h2>Cursos</h2>
        {cursos.length === 0 && <Vazio>Nenhum curso ainda.</Vazio>}
        <ol className="lista-admin">
          {cursos.map((c, i) => (
            <li key={c.id}>
              <Link to={`/admin/cursos/${c.id}`}>
                <strong>{c.titulo}</strong>
                <small className="texto-suave">
                  {' '}
                  · {c.aulas.length} aulas · {c.questoes.length}/{QUESTOES_POR_QUESTIONARIO} questões
                  {c.questoes.length < QUESTOES_POR_QUESTIONARIO && ' ⚠️'}
                </small>
              </Link>
              <div className="acoes-linha">
                <button className="link" disabled={i === 0} onClick={() => mover(c, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="link" disabled={i === cursos.length - 1} onClick={() => mover(c, 1)} aria-label="Descer">
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
        <form className="linha-form" onSubmit={criarCurso}>
          <input value={novoCurso} onChange={(e) => setNovoCurso(e.target.value)} placeholder="Título do novo curso" />
          <button className="botao">Adicionar curso</button>
        </form>
      </section>

      <section className="cartao">
        <h2>🎯 Questões do Modo Desafio</h2>
        <p className="texto-suave">
          Perguntas diferentes das dos cursos, sobre os temas desta trilha. Elas serão usadas no Modo Desafio (Versão 3),
          liberado quando a pessoa concluir a trilha.
        </p>
        <EditorQuestoes trilhaId={f.id} cursoId={null} uso="desafio" />
      </section>

      <button className="botao perigo" onClick={apagarTrilha}>
        Apagar trilha
      </button>
    </>
  )
}
