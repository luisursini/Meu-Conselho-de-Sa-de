import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase, verificar } from '../../lib/supabase'
import { useConsulta } from '../../lib/useConsulta'
import type { Trilha } from '../../lib/tipos'
import { Carregando, Erro, Vazio } from '../../components/ui'

export function AdminLayout() {
  return (
    <div className="pagina">
      <h1>⚙️ Administração</h1>
      <div className="abas">
        <NavLink to="/admin" end>
          Trilhas
        </NavLink>
        <NavLink to="/admin/conselhos">Conselhos</NavLink>
        <NavLink to="/admin/denuncias">🚩 Denúncias</NavLink>
        <NavLink to="/admin/solicitacoes">Diretorias inativas</NavLink>
      </div>
      <Outlet />
    </div>
  )
}

export function AdminTrilhas() {
  const navegar = useNavigate()
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const { dados, carregando } = useConsulta(
    async () => verificar(await supabase.from('trilhas').select('*, cursos(id)').order('ordem')) as (Trilha & { cursos: { id: string }[] })[],
    [],
  )

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    const { data, error } = await supabase
      .from('trilhas')
      .insert({ titulo: titulo.trim(), medalha_nome: titulo.trim(), ordem: (dados?.length ?? 0) + 1 })
      .select()
      .single()
    if (error) return setErro(error.message)
    navegar(`/admin/trilhas/${data.id}`)
  }

  return (
    <>
      <form className="linha-form" onSubmit={criar}>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da nova trilha" />
        <button className="botao">Criar trilha</button>
      </form>
      <Erro mensagem={erro} />
      {carregando && <Carregando />}
      {dados?.length === 0 && <Vazio>Nenhuma trilha ainda. Crie a primeira acima.</Vazio>}
      <div className="lista">
        {dados?.map((t) => (
          <Link key={t.id} to={`/admin/trilhas/${t.id}`} className="cartao trilha-cartao">
            <span className="trilha-emoji">{t.medalha_emoji}</span>
            <div>
              <strong>
                {t.ordem}. {t.titulo}
              </strong>
              <small>
                {t.cursos.length} cursos ·{' '}
                {t.publicada ? <span className="etiqueta sucesso">Publicada</span> : <span className="etiqueta">Rascunho</span>}
              </small>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
