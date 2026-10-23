import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { Carregando, Erro, Vazio } from '../components/ui'

export function Salvos() {
  const { perfil } = useAuth()
  const { dados, erro, carregando } = useConsulta(
    async () =>
      verificar(
        await supabase
          .from('aulas_salvas')
          .select('created_at, aulas(id, titulo, cursos(titulo))')
          .eq('user_id', perfil!.id)
          .order('created_at', { ascending: false }),
      ) as unknown as { aulas: { id: string; titulo: string; cursos: { titulo: string } } }[],
    [perfil!.id],
  )

  return (
    <div className="pagina">
      <Link to="/aprender" className="voltar">
        ← Aprender
      </Link>
      <h1>🔖 Aulas salvas</h1>
      {carregando && <Carregando />}
      <Erro mensagem={erro} />
      {dados?.length === 0 && <Vazio>Você ainda não salvou nenhuma aula.</Vazio>}
      <div className="lista">
        {dados?.map((s) => (
          <Link key={s.aulas.id} to={`/aula/${s.aulas.id}`} className="cartao linha-link">
            <strong>{s.aulas.titulo}</strong>
            <small>{s.aulas.cursos.titulo}</small>
          </Link>
        ))}
      </div>
    </div>
  )
}
