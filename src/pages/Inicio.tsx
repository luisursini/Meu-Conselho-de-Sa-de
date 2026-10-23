import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { carregarTrilhas } from '../lib/progresso'
import { useConsulta } from '../lib/useConsulta'
import { BarraXp, Carregando, Progresso } from '../components/ui'

export function Inicio() {
  const { perfil } = useAuth()
  const primeiroNome = perfil!.nome.split(' ')[0]

  const trilhas = useConsulta(() => carregarTrilhas(perfil!.id), [perfil!.id, perfil!.xp])

  // Para quem ainda não tem vínculo: conselhos que atendem a UBS do bairro.
  const conselhosUbs = useConsulta(async () => {
    if (perfil!.segmento !== 'sem_vinculo' || !perfil!.ubs_id) return null
    return verificar(await supabase.rpc('conselhos_da_ubs', { p_ubs: perfil!.ubs_id })) as {
      id: string
      nome: string
      membros: number
    }[]
  }, [perfil!.segmento, perfil!.ubs_id])

  // Para a diretoria: pedidos de participação pendentes.
  const pedidos = useConsulta(async () => {
    if (!perfil!.conselho_id) return 0
    const { count } = await supabase
      .from('pedidos_participacao')
      .select('id', { count: 'exact', head: true })
      .eq('conselho_id', perfil!.conselho_id)
      .eq('status', 'pendente')
    return count ?? 0
  }, [perfil!.conselho_id])

  const proxima = trilhas.dados?.find((t) => !t.concluida)

  return (
    <div className="pagina">
      <h1>Olá, {primeiroNome}!</h1>
      <div className="cartao">
        <BarraXp xp={perfil!.xp} />
      </div>

      {conselhosUbs.dados && conselhosUbs.dados.length > 0 && (
        <div className="cartao destaque">
          <h2>🏥 A sua UBS tem um Conselho Local de Saúde!</h2>
          {conselhosUbs.dados.map((c) => (
            <Link key={c.id} to={`/conselhos/${c.id}`} className="linha-link">
              <strong>{c.nome}</strong>
              <small>
                {c.membros} {c.membros === 1 ? 'membro' : 'membros'} no app
              </small>
            </Link>
          ))}
        </div>
      )}
      {conselhosUbs.dados && conselhosUbs.dados.length === 0 && (
        <div className="cartao">
          <h2>🏥 Sua UBS ainda não tem conselho no app</h2>
          <p>Que tal aprender como um Conselho Local de Saúde funciona e como ele é criado?</p>
          <Link to="/aprender" className="botao secundario">
            Ver trilhas de aprendizado
          </Link>
        </div>
      )}
      {perfil!.segmento === 'sem_vinculo' && !perfil!.ubs_id && (
        <div className="cartao">
          <h2>🏥 Qual é a UBS do seu bairro?</h2>
          <p>Informe sua UBS no perfil e descubra se ela já tem um conselho de saúde.</p>
          <Link to="/perfil/editar" className="botao secundario">
            Informar minha UBS
          </Link>
        </div>
      )}

      {!!pedidos.dados && (
        <Link to="/meu-conselho" className="cartao aviso linha-link">
          <strong>🔔 {pedidos.dados} {pedidos.dados === 1 ? 'pessoa quer' : 'pessoas querem'} participar do seu conselho</strong>
          <small>Toque para responder</small>
        </Link>
      )}

      <h2>Continue aprendendo</h2>
      {trilhas.carregando && <Carregando />}
      {proxima ? (
        <Link to={`/aprender/${proxima.id}`} className="cartao trilha-cartao">
          <span className="trilha-emoji">{proxima.medalha_emoji}</span>
          <div>
            <strong>{proxima.titulo}</strong>
            <Progresso feito={proxima.cursosAprovados} total={proxima.cursos.length} />
          </div>
        </Link>
      ) : (
        trilhas.dados && (
          <p className="vazio">
            {trilhas.dados.length ? '🎉 Você concluiu todas as trilhas disponíveis!' : 'As trilhas estão sendo preparadas.'}
          </p>
        )
      )}
    </div>
  )
}
