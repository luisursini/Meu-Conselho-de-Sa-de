import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import type { Evento } from '../lib/tipos'
import { EventoCard, NovoEvento } from '../components/Eventos'
import { Carregando, Erro, Vazio } from '../components/ui'

export function Eventos() {
  const { perfil } = useAuth()
  const { dados, erro, carregando, recarregar } = useConsulta(
    async () => verificar(await supabase.rpc('proximos_eventos', { p_limite: 60 })) as Evento[],
    [],
  )

  return (
    <div className="pagina">
      <h1>📅 Eventos</h1>
      <p className="texto-suave">
        Reuniões dos conselhos que você segue, eventos da sua cidade e conferências nacionais.
      </p>
      {perfil!.is_admin && <NovoEvento aoCriar={recarregar} />}
      {carregando && !dados && <Carregando />}
      <Erro mensagem={erro} />
      <div className="lista">
        {dados?.map((e) => (
          <EventoCard key={e.id} evento={e} aoMudar={recarregar} podeApagar={perfil!.is_admin} />
        ))}
      </div>
      {dados?.length === 0 && <Vazio>Nenhum evento próximo. Siga conselhos para ver as reuniões deles aqui.</Vazio>}
    </div>
  )
}
