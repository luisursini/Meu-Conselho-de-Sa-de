import { useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { dataCurta } from '../lib/texto'
import { CARGOS, SEGMENTOS, type Cargo, type Conselho as TConselho, type Segmento, type Ubs } from '../lib/tipos'
import { Avatar, Carregando, Erro, SeloNivel, Vazio } from '../components/ui'
import { SeletorConselho } from '../components/SeletorConselho'
import { SeletorUbs } from '../components/SeletorUbs'
import { NovoPost } from '../components/NovoPost'
import { ListaPosts } from '../components/ListaPosts'
import { EventoCard, NovoEvento } from '../components/Eventos'
import type { Evento } from '../lib/tipos'

interface Pessoa {
  id: string
  nome: string
  avatar_url: string | null
  segmento: Segmento | null
  xp: number
}

interface Pedido {
  id: string
  mensagem: string | null
  status: 'pendente' | 'aceito' | 'recusado'
  resposta: string | null
  created_at: string
  user_id: string
  profiles: Pessoa
}

/** /meu-conselho: abre o conselho do perfil ou ajuda a encontrar um. */
export function MeuConselho() {
  const { perfil } = useAuth()
  if (perfil!.conselho_id) return <Navigate to={`/conselhos/${perfil!.conselho_id}`} replace />
  return <EncontrarConselho />
}

function EncontrarConselho() {
  const { perfil } = useAuth()
  const [escolhido, setEscolhido] = useState<{ id: string; nome: string } | null>(null)
  const seguidos = useConsulta(
    async () =>
      verificar(
        await supabase.from('seguidores_conselho').select('conselhos(id, nome)').eq('user_id', perfil!.id),
      ) as unknown as { conselhos: { id: string; nome: string } }[],
    [perfil!.id],
  )
  if (escolhido) return <Navigate to={`/conselhos/${escolhido.id}`} />
  return (
    <div className="pagina">
      <h1>Conselhos de saúde</h1>
      {!!seguidos.dados?.length && (
        <div className="cartao">
          <h2>Conselhos que você segue</h2>
          {seguidos.dados.map(({ conselhos: c }) => (
            <Link key={c.id} to={`/conselhos/${c.id}`} className="linha-link">
              <span>
                🤝 <strong>{c.nome}</strong>
              </span>
            </Link>
          ))}
        </div>
      )}
      <p>
        Você ainda não faz parte de um conselho. Procure conselhos da sua cidade para conhecer, seguir ou pedir para
        participar.
      </p>
      {perfil!.municipio_id ? (
        <SeletorConselho municipioId={perfil!.municipio_id} valor={null} onChange={setEscolhido} />
      ) : (
        <Link to="/perfil/editar" className="botao">
          Informe sua cidade no perfil
        </Link>
      )}
    </div>
  )
}

type AbaConselho = 'sobre' | 'mural' | 'publicacoes' | 'eventos'

const DIAS_INATIVIDADE = 60

export function Conselho() {
  const { conselhoId } = useParams()
  const { perfil, recarregarPerfil } = useAuth()
  const [aba, setAba] = useState<AbaConselho>('sobre')
  const [versaoPosts, setVersaoPosts] = useState(0)

  const { dados, erro, carregando, recarregar } = useConsulta(async () => {
    const c = verificar(
      await supabase
        .from('conselhos')
        .select('*, municipios(nome, uf), conselho_ubs(ubs(*)), diretoria(cargo, user_id, profiles(id, nome, avatar_url, segmento, xp))')
        .eq('id', conselhoId!)
        .single(),
    ) as TConselho & {
      municipios: { nome: string; uf: string }
      conselho_ubs: { ubs: Ubs }[]
      diretoria: { cargo: Cargo; user_id: string; profiles: Pessoa }[]
    }
    const [membros, seguidores, sigo, meuPedido] = await Promise.all([
      supabase.from('profiles').select('id, nome, avatar_url, segmento, xp').eq('conselho_id', conselhoId!).order('nome'),
      supabase.from('seguidores_conselho').select('user_id', { count: 'exact', head: true }).eq('conselho_id', conselhoId!),
      supabase.from('seguidores_conselho').select('user_id').eq('conselho_id', conselhoId!).eq('user_id', perfil!.id).maybeSingle(),
      supabase.from('pedidos_participacao').select('*').eq('conselho_id', conselhoId!).eq('user_id', perfil!.id).maybeSingle(),
    ])
    return {
      c,
      membros: (membros.data ?? []) as Pessoa[],
      seguidores: seguidores.count ?? 0,
      sigo: !!sigo.data,
      meuPedido: meuPedido.data as Pedido | null,
    }
  }, [conselhoId, perfil!.id, perfil!.conselho_id])

  if (carregando && !dados) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Conselho não encontrado'} />
  const { c, membros, seguidores, sigo, meuPedido } = dados
  if (c.mesclado_em) return <Navigate to={`/conselhos/${c.mesclado_em}`} replace />

  const souMembro = perfil!.conselho_id === c.id
  const souDiretoria = c.diretoria.some((d) => d.user_id === perfil!.id)
  const podeGerenciar = souDiretoria || perfil!.is_admin
  const diretoriaInativa = Date.now() - new Date(c.ultima_atividade_diretoria).getTime() > DIAS_INATIVIDADE * 86400 * 1000
  const abas: [AbaConselho, string][] = [
    ['sobre', 'Sobre'],
    ...(souMembro || souDiretoria || perfil!.is_admin ? [['mural', '🔒 Mural'] as [AbaConselho, string]] : []),
    ['publicacoes', 'Publicações'],
    ['eventos', 'Eventos'],
  ]

  async function seguir() {
    if (sigo) await supabase.from('seguidores_conselho').delete().eq('conselho_id', c.id).eq('user_id', perfil!.id)
    else await supabase.from('seguidores_conselho').insert({ conselho_id: c.id, user_id: perfil!.id })
    recarregar()
  }

  return (
    <div className="pagina">
      <h1>{c.nome}</h1>
      <p className="texto-suave">
        📍 {c.municipios.nome} – {c.municipios.uf} · {membros.length} {membros.length === 1 ? 'membro' : 'membros'} ·{' '}
        {seguidores} {seguidores === 1 ? 'seguidor' : 'seguidores'}
      </p>
      {c.status_diretoria === 'provisoria' ? (
        <p className="etiqueta alerta" title="Ainda não confirmada pela diretoria eleita">
          ⏳ Diretoria provisória
        </p>
      ) : (
        <p className="etiqueta sucesso">✔️ Diretoria confirmada</p>
      )}

      {!souMembro && (
        <div className="acoes">
          <button className={`botao ${sigo ? 'secundario' : ''}`} onClick={seguir}>
            {sigo ? '✔️ Seguindo' : '➕ Seguir'}
          </button>
        </div>
      )}
      {!souMembro && <QueroParticipar conselhoId={c.id} pedido={meuPedido} aoMudar={recarregar} />}

      <div className="abas abas-largas" role="tablist">
        {abas.map(([v, r]) => (
          <button key={v} role="tab" aria-selected={aba === v} className={aba === v ? 'ativa' : ''} onClick={() => setAba(v)}>
            {r}
          </button>
        ))}
      </div>

      {aba === 'sobre' && (
        <>
          <div className="cartao">
            <h2>Atende</h2>
            <ul className="lista-simples">
              {c.conselho_ubs.map(({ ubs }) => (
                <li key={ubs.id}>🏥 {ubs.nome}</li>
              ))}
            </ul>
            {c.descricao && <p>{c.descricao}</p>}
            {(c.local_reunioes || c.horario_reunioes) && (
              <p>
                🗓️ <strong>Reuniões:</strong> {[c.horario_reunioes, c.local_reunioes].filter(Boolean).join(' · ')}
              </p>
            )}
            {c.mandato_fim && (
              <p className="texto-suave">
                Mandato da diretoria: {c.mandato_inicio && `${dataCurta(c.mandato_inicio)} a `}
                {dataCurta(c.mandato_fim)}
              </p>
            )}
          </div>

          {souMembro && !souDiretoria && diretoriaInativa && <DiretoriaInativa conselhoId={c.id} />}

          {podeGerenciar && (
            <PainelDiretoria conselho={c} membros={membros} aoMudar={() => (recarregar(), recarregarPerfil())} />
          )}

          <h2>Diretoria</h2>
          {c.diretoria.length === 0 && <Vazio>Sem diretoria cadastrada.</Vazio>}
          <div className="lista">
            {c.diretoria.map((d) => (
              <LinhaPessoa key={d.user_id} pessoa={d.profiles} detalhe={CARGOS[d.cargo]} />
            ))}
          </div>

          <h2>Membros</h2>
          {membros.length === 0 && <Vazio>Nenhum membro ainda.</Vazio>}
          <div className="lista">
            {membros.map((m) => (
              <LinhaPessoa key={m.id} pessoa={m} detalhe={m.segmento ? SEGMENTOS[m.segmento] : ''} />
            ))}
          </div>
        </>
      )}

      {aba === 'mural' && (
        <>
          <p className="texto-suave">🔒 Só os membros do conselho veem o mural.</p>
          <NovoPost mural={{ conselhoId: c.id, souDiretoria }} aoPublicar={() => setVersaoPosts((v) => v + 1)} />
          <ListaPosts aba="mural" ref_={c.id} souDiretoria={souDiretoria} versao={versaoPosts} vazio="Nenhuma conversa no mural ainda." />
        </>
      )}

      {aba === 'publicacoes' && (
        <>
          {souDiretoria && (
            <NovoPost comoConselho={{ id: c.id, nome: c.nome }} aoPublicar={() => setVersaoPosts((v) => v + 1)} />
          )}
          <ListaPosts aba="conselho" ref_={c.id} versao={versaoPosts} vazio="O conselho ainda não fez publicações." />
        </>
      )}

      {aba === 'eventos' && <EventosDoConselho conselho={c} podeGerenciar={podeGerenciar} />}
    </div>
  )
}

function EventosDoConselho({ conselho, podeGerenciar }: { conselho: TConselho & { municipios: { nome: string; uf: string } }; podeGerenciar: boolean }) {
  const { dados, carregando, recarregar } = useConsulta(async () => {
    const linhas = verificar(
      await supabase
        .from('eventos')
        .select('*, lembretes_evento(user_id)')
        .eq('conselho_id', conselho.id)
        .gte('inicio', new Date(Date.now() - 3 * 3600 * 1000).toISOString())
        .order('inicio'),
    ) as (Omit<Evento, 'conselho' | 'cidade' | 'lembrete'> & { lembretes_evento: { user_id: string }[] })[]
    // A regra de segurança só devolve o lembrete da própria pessoa.
    return linhas.map(({ lembretes_evento, ...e }) => ({
      ...e,
      conselho: { id: conselho.id, nome: conselho.nome },
      cidade: `${conselho.municipios.nome} – ${conselho.municipios.uf}`,
      lembrete: lembretes_evento.length > 0,
    })) as Evento[]
  }, [conselho.id])

  return (
    <>
      {podeGerenciar && <NovoEvento conselhoId={conselho.id} aoCriar={recarregar} />}
      {carregando && !dados && <Carregando />}
      {dados?.length === 0 && <Vazio>Nenhuma reunião agendada.</Vazio>}
      <div className="lista">
        {dados?.map((e) => (
          <EventoCard key={e.id} evento={e} aoMudar={recarregar} podeApagar={podeGerenciar} />
        ))}
      </div>
    </>
  )
}

/** Membro pede ao admin para assumir a diretoria quando ela some por 60 dias. */
function DiretoriaInativa({ conselhoId }: { conselhoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [cargo, setCargo] = useState<Cargo>('presidente')
  const [mensagem, setMensagem] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    const { error } = await supabase.rpc('solicitar_diretoria', { p_conselho: conselhoId, p_cargo: cargo, p_mensagem: mensagem })
    if (error) return setErro(error.message)
    setEnviado(true)
  }

  return (
    <div className="cartao aviso">
      <strong>⚠️ A diretoria está sem atividade no app há mais de {DIAS_INATIVIDADE} dias</strong>
      {enviado ? (
        <p>Pedido enviado! A administração do app vai analisar.</p>
      ) : !aberto ? (
        <>
          <p>Se a diretoria não está mais atuando, você pode pedir à administração para assumir.</p>
          <button className="botao secundario" onClick={() => setAberto(true)}>
            Pedir para assumir a diretoria
          </button>
        </>
      ) : (
        <div className="formulario">
          <label>
            Cargo
            <select value={cargo} onChange={(e) => setCargo(e.target.value as Cargo)}>
              {Object.entries(CARGOS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conte o que aconteceu
            <textarea rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: Fui eleita na última reunião, a antiga diretoria se afastou." />
          </label>
          <Erro mensagem={erro} />
          <div className="acoes">
            <button className="botao secundario" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button className="botao" onClick={enviar}>
              Enviar pedido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LinhaPessoa({ pessoa, detalhe }: { pessoa: Pessoa; detalhe: string }) {
  return (
    <Link to={`/pessoas/${pessoa.id}`} className="pessoa">
      <Avatar url={pessoa.avatar_url} nome={pessoa.nome} />
      <div>
        <strong>{pessoa.nome}</strong>
        <small>
          {detalhe} · <SeloNivel xp={pessoa.xp} />
        </small>
      </div>
    </Link>
  )
}

function QueroParticipar({ conselhoId, pedido, aoMudar }: { conselhoId: string; pedido: Pedido | null; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.rpc('quero_participar', { p_conselho: conselhoId, p_mensagem: mensagem })
    if (error) return setErro(error.message)
    setAberto(false)
    aoMudar()
  }

  if (pedido?.status === 'pendente')
    return <p className="cartao aviso">📨 Seu pedido para participar foi enviado à diretoria. Aguarde a resposta!</p>

  return (
    <>
      {pedido && (
        <div className={`cartao ${pedido.status === 'aceito' ? 'destaque' : ''}`}>
          <strong>{pedido.status === 'aceito' ? '🎉 A diretoria aceitou seu pedido!' : 'A diretoria respondeu seu pedido'}</strong>
          {pedido.resposta && <p>“{pedido.resposta}”</p>}
          {pedido.status === 'aceito' && <EntrarNoConselho conselhoId={conselhoId} />}
        </div>
      )}
      {!aberto ? (
        <button className="botao grande" onClick={() => setAberto(true)}>
          🙋 Quero participar
        </button>
      ) : (
        <form className="cartao" onSubmit={enviar}>
          <p>A diretoria do conselho vai receber seu pedido e você passa a seguir o conselho.</p>
          <label>
            Mensagem (opcional)
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} placeholder="Ex.: Moro no bairro e quero ajudar!" />
          </label>
          <Erro mensagem={erro} />
          <div className="acoes">
            <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button className="botao">Enviar pedido</button>
          </div>
        </form>
      )}
    </>
  )
}

/** Depois do pedido aceito, a pessoa escolhe o segmento e passa a ser membro. */
function EntrarNoConselho({ conselhoId }: { conselhoId: string }) {
  const { perfil, recarregarPerfil } = useAuth()
  const [segmento, setSegmento] = useState<Segmento>(perfil!.segmento && perfil!.segmento !== 'sem_vinculo' ? perfil!.segmento : 'usuario')
  const [erro, setErro] = useState<string | null>(null)

  async function entrar() {
    const { error } = await supabase.from('profiles').update({ segmento, conselho_id: conselhoId }).eq('id', perfil!.id)
    if (error) return setErro(error.message)
    recarregarPerfil()
  }

  return (
    <div className="formulario">
      <label>
        Em qual segmento você vai participar?
        <select value={segmento} onChange={(e) => setSegmento(e.target.value as Segmento)}>
          {(Object.keys(SEGMENTOS) as Segmento[])
            .filter((s) => s !== 'sem_vinculo')
            .map((s) => (
              <option key={s} value={s}>
                {SEGMENTOS[s]}
              </option>
            ))}
        </select>
      </label>
      <Erro mensagem={erro} />
      <button className="botao" onClick={entrar}>
        Entrar no conselho
      </button>
    </div>
  )
}

type ConselhoCompleto =TConselho & { conselho_ubs: { ubs: Ubs }[]; diretoria: { cargo: Cargo; user_id: string; profiles: Pessoa }[] }

function PainelDiretoria({ conselho, membros, aoMudar }: { conselho: ConselhoCompleto; membros: Pessoa[]; aoMudar: () => void }) {
  const [aba, setAba] = useState<'pedidos' | 'dados' | 'diretoria'>('pedidos')
  return (
    <section className="cartao painel">
      <h2>⚙️ Painel da diretoria</h2>
      <div className="abas" role="tablist">
        {(
          [
            ['pedidos', 'Pedidos'],
            ['dados', 'Dados do conselho'],
            ['diretoria', 'Diretoria e membros'],
          ] as const
        ).map(([v, r]) => (
          <button key={v} role="tab" aria-selected={aba === v} className={aba === v ? 'ativa' : ''} onClick={() => setAba(v)}>
            {r}
          </button>
        ))}
      </div>
      {aba === 'pedidos' && <Pedidos conselhoId={conselho.id} />}
      {aba === 'dados' && <EditarDados conselho={conselho} aoMudar={aoMudar} />}
      {aba === 'diretoria' && <GerenciarDiretoria conselho={conselho} membros={membros} aoMudar={aoMudar} />}
    </section>
  )
}

function Pedidos({ conselhoId }: { conselhoId: string }) {
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const { dados, carregando, recarregar } = useConsulta(
    async () =>
      verificar(
        await supabase
          .from('pedidos_participacao')
          .select('*, profiles(id, nome, avatar_url, segmento, xp)')
          .eq('conselho_id', conselhoId)
          .order('created_at', { ascending: false }),
      ) as Pedido[],
    [conselhoId],
  )

  async function responder(id: string, status: 'aceito' | 'recusado') {
    await supabase.rpc('responder_pedido', { p_pedido: id, p_status: status, p_resposta: respostas[id] ?? '' })
    recarregar()
  }

  if (carregando) return <Carregando />
  const pendentes = dados?.filter((p) => p.status === 'pendente') ?? []
  const respondidos = dados?.filter((p) => p.status !== 'pendente') ?? []

  return (
    <div>
      {pendentes.length === 0 && <Vazio>Nenhum pedido pendente.</Vazio>}
      {pendentes.map((p) => (
        <div key={p.id} className="pedido">
          <LinhaPessoa pessoa={p.profiles} detalhe={`pediu em ${dataCurta(p.created_at)}`} />
          {p.mensagem && <p>“{p.mensagem}”</p>}
          <textarea
            rows={2}
            placeholder="Resposta (ex.: Nossa próxima reunião é dia 10, às 19h, na UBS)"
            value={respostas[p.id] ?? ''}
            onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })}
          />
          <div className="acoes">
            <button className="botao secundario" onClick={() => responder(p.id, 'recusado')}>
              Recusar
            </button>
            <button className="botao" onClick={() => responder(p.id, 'aceito')}>
              Aceitar
            </button>
          </div>
        </div>
      ))}
      {respondidos.length > 0 && (
        <details>
          <summary>Respondidos ({respondidos.length})</summary>
          {respondidos.map((p) => (
            <p key={p.id} className="texto-suave">
              {p.profiles.nome} — {p.status === 'aceito' ? 'aceito' : 'recusado'}
            </p>
          ))}
        </details>
      )}
    </div>
  )
}

function EditarDados({ conselho, aoMudar }: { conselho: ConselhoCompleto; aoMudar: () => void }) {
  const [f, setF] = useState({
    nome: conselho.nome,
    descricao: conselho.descricao ?? '',
    local_reunioes: conselho.local_reunioes ?? '',
    horario_reunioes: conselho.horario_reunioes ?? '',
    mandato_inicio: conselho.mandato_inicio ?? '',
    mandato_fim: conselho.mandato_fim ?? '',
  })
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase
      .from('conselhos')
      .update({
        nome: f.nome,
        descricao: f.descricao || null,
        local_reunioes: f.local_reunioes || null,
        horario_reunioes: f.horario_reunioes || null,
        mandato_inicio: f.mandato_inicio || null,
        mandato_fim: f.mandato_fim || null,
      })
      .eq('id', conselho.id)
    if (error) return setErro(error.message)
    setMsg('Dados salvos!')
    aoMudar()
  }

  async function confirmarDiretoria() {
    if (!confirm('Confirmar que esta diretoria foi eleita oficialmente?')) return
    await supabase.from('conselhos').update({ status_diretoria: 'confirmada' }).eq('id', conselho.id)
    aoMudar()
  }

  async function adicionarUbs(u: Ubs | null) {
    if (!u) return
    await supabase.from('conselho_ubs').insert({ conselho_id: conselho.id, ubs_id: u.id })
    aoMudar()
  }

  async function removerUbs(ubsId: string) {
    if (conselho.conselho_ubs.length <= 1) return setErro('O conselho precisa atender ao menos uma UBS')
    await supabase.from('conselho_ubs').delete().eq('conselho_id', conselho.id).eq('ubs_id', ubsId)
    aoMudar()
  }

  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })

  return (
    <form onSubmit={salvar} className="formulario">
      {conselho.status_diretoria === 'provisoria' && (
        <div className="caixa">
          <p>
            A diretoria está marcada como <strong>provisória</strong>. Quando a diretoria for eleita oficialmente,
            confirme aqui.
          </p>
          <button type="button" className="botao secundario" onClick={confirmarDiretoria}>
            ✔️ Confirmar diretoria eleita
          </button>
        </div>
      )}
      <label>
        Nome do conselho
        <input {...campo('nome')} />
      </label>
      <label>
        Descrição
        <textarea rows={3} {...campo('descricao')} />
      </label>
      <label>
        Horário das reuniões
        <input placeholder="Ex.: Toda 2ª terça do mês, às 19h" {...campo('horario_reunioes')} />
      </label>
      <label>
        Local das reuniões
        <input placeholder="Ex.: Sala de reuniões da UBS Vila Nova" {...campo('local_reunioes')} />
      </label>
      <div className="duas-colunas">
        <label>
          Início do mandato
          <input type="date" {...campo('mandato_inicio')} />
        </label>
        <label>
          Fim do mandato
          <input type="date" {...campo('mandato_fim')} />
        </label>
      </div>
      <span className="rotulo">UBS atendidas</span>
      {conselho.conselho_ubs.map(({ ubs }) => (
        <div key={ubs.id} className="escolhido">
          <span>🏥 {ubs.nome}</span>
          <button type="button" className="link perigo" onClick={() => removerUbs(ubs.id)}>
            Remover
          </button>
        </div>
      ))}
      <SeletorUbs municipioId={conselho.municipio_id} valor={null} onChange={adicionarUbs} rotulo="Adicionar UBS" />
      <Erro mensagem={erro} />
      {msg && <p className="sucesso-msg">{msg}</p>}
      <button className="botao">Salvar dados</button>
    </form>
  )
}

function GerenciarDiretoria({ conselho, membros, aoMudar }: { conselho: ConselhoCompleto; membros: Pessoa[]; aoMudar: () => void }) {
  const { perfil } = useAuth()
  const [pessoa, setPessoa] = useState('')
  const [cargo, setCargo] = useState<Cargo>('vice_presidente')
  const [erro, setErro] = useState<string | null>(null)
  const naDiretoria = new Set(conselho.diretoria.map((d) => d.user_id))

  async function executar(promessa: PromiseLike<{ error: { message: string } | null }>) {
    setErro(null)
    const { error } = await promessa
    if (error) setErro(error.message)
    else aoMudar()
  }

  return (
    <div className="formulario">
      <h3>Diretoria atual</h3>
      {conselho.diretoria.map((d) => (
        <div key={d.user_id} className="escolhido">
          <span>
            <strong>{d.profiles.nome}</strong> · {CARGOS[d.cargo]}
          </span>
          <button
            className="link perigo"
            onClick={() =>
              confirm(`Remover ${d.profiles.nome} da diretoria?`) &&
              executar(supabase.rpc('remover_diretoria', { p_conselho: conselho.id, p_user: d.user_id }))
            }
          >
            Remover
          </button>
        </div>
      ))}

      <h3>Indicar membro para a diretoria</h3>
      <label>
        Membro
        <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
          <option value="">Selecione…</option>
          {membros
            .filter((m) => !naDiretoria.has(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
        </select>
      </label>
      <label>
        Cargo
        <select value={cargo} onChange={(e) => setCargo(e.target.value as Cargo)}>
          {Object.entries(CARGOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <button
        className="botao"
        disabled={!pessoa}
        onClick={() => executar(supabase.rpc('definir_diretoria', { p_conselho: conselho.id, p_user: pessoa, p_cargo: cargo })).then(() => setPessoa(''))}
      >
        Adicionar à diretoria
      </button>
      <p className="texto-suave">Só aparecem aqui pessoas que já escolheram este conselho no perfil.</p>

      <h3>Membros</h3>
      {membros
        .filter((m) => m.id !== perfil!.id)
        .map((m) => (
          <div key={m.id} className="escolhido">
            <span>{m.nome}</span>
            <button
              className="link perigo"
              onClick={() =>
                confirm(`Remover ${m.nome} do conselho? Use isso para quem se cadastrou no conselho errado.`) &&
                executar(supabase.rpc('remover_membro', { p_conselho: conselho.id, p_user: m.id }))
              }
            >
              Remover do conselho
            </button>
          </div>
        ))}
      <Erro mensagem={erro} />
    </div>
  )
}
