import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { baixarIcs, linkGoogleAgenda } from '../lib/agenda'
import { dataHora } from '../lib/texto'
import { TIPOS_EVENTO, type Evento } from '../lib/tipos'
import { SeletorCidade } from './SeletorCidade'
import { Erro } from './ui'

const ICONE = { reuniao: '🗓️', conferencia: '🏛️', outro: '📌' } as const

export function EventoCard({ evento, aoMudar, podeApagar = false }: { evento: Evento; aoMudar: () => void; podeApagar?: boolean }) {
  const { perfil } = useAuth()
  const [opcoes, setOpcoes] = useState(false)
  const inicio = new Date(evento.inicio)

  async function alternarLembrete() {
    if (evento.lembrete) {
      await supabase.from('lembretes_evento').delete().eq('evento_id', evento.id).eq('user_id', perfil!.id)
    } else {
      await supabase.from('lembretes_evento').insert({ evento_id: evento.id, user_id: perfil!.id })
      setOpcoes(true)
    }
    aoMudar()
  }

  async function apagar() {
    if (!confirm('Apagar este evento?')) return
    await supabase.from('eventos').delete().eq('id', evento.id)
    aoMudar()
  }

  return (
    <article className={`cartao evento ${evento.lembrete ? 'com-lembrete' : ''}`}>
      <div className="evento-data" aria-hidden>
        <strong>{inicio.getDate()}</strong>
        <small>{inicio.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>
      </div>
      <div className="evento-corpo">
        <small className="texto-suave">
          {ICONE[evento.tipo]} {TIPOS_EVENTO[evento.tipo]} · {evento.cidade}
        </small>
        <strong>{evento.titulo}</strong>
        <small>
          🕒 {dataHora(evento.inicio)}
          {evento.local && ` · 📍 ${evento.local}`}
        </small>
        {evento.conselho && (
          <Link to={`/conselhos/${evento.conselho.id}`} className="texto-suave">
            🤝 {evento.conselho.nome}
          </Link>
        )}
        {evento.descricao && <p>{evento.descricao}</p>}
        {evento.link_url && (
          <a href={evento.link_url} target="_blank" rel="noreferrer noopener">
            🔗 Mais informações
          </a>
        )}
        <div className="barra-acoes">
          <button className={`chip ${evento.lembrete ? 'ativo' : ''}`} onClick={alternarLembrete} aria-pressed={evento.lembrete}>
            {evento.lembrete ? '🔔 Lembrete ativo' : '🔕 Lembrar-me'}
          </button>
          {evento.lembrete && (
            <button className="link discreto" onClick={() => setOpcoes(!opcoes)}>
              Adicionar à agenda
            </button>
          )}
          {podeApagar && (
            <button className="link discreto perigo" onClick={apagar}>
              Apagar
            </button>
          )}
        </div>
        {opcoes && evento.lembrete && (
          <div className="caixa">
            <small>Para o celular avisar você antes do evento, adicione-o à sua agenda:</small>
            <div className="acoes inicio">
              <a className="botao secundario" href={linkGoogleAgenda(evento)} target="_blank" rel="noreferrer noopener">
                Google Agenda
              </a>
              <button className="botao secundario" onClick={() => baixarIcs(evento)}>
                Outra agenda (.ics)
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

/** Formulário de evento: do conselho (diretoria) ou geral (admin). */
export function NovoEvento({ conselhoId, aoCriar }: { conselhoId?: string; aoCriar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [f, setF] = useState({ titulo: '', tipo: conselhoId ? 'reuniao' : 'conferencia', data: '', hora: '19:00', local: '', descricao: '', link_url: '' })
  const [municipio, setMunicipio] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (f.titulo.trim().length < 3) return setErro('Informe o título')
    if (!f.data) return setErro('Informe a data')
    const inicio = new Date(`${f.data}T${f.hora || '00:00'}`)
    const { error } = await supabase.from('eventos').insert({
      titulo: f.titulo.trim(),
      tipo: f.tipo,
      inicio: inicio.toISOString(),
      local: f.local.trim() || null,
      descricao: f.descricao.trim() || null,
      link_url: f.link_url.trim() || null,
      conselho_id: conselhoId ?? null,
      municipio_id: conselhoId ? null : municipio,
    })
    if (error) return setErro(error.message)
    setF({ ...f, titulo: '', data: '', local: '', descricao: '', link_url: '' })
    setAberto(false)
    aoCriar()
  }

  if (!aberto)
    return (
      <button className="botao secundario" onClick={() => setAberto(true)}>
        + Novo evento
      </button>
    )

  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })

  return (
    <form className="cartao formulario" onSubmit={criar}>
      <h3>Novo evento</h3>
      <label>
        Título
        <input placeholder={conselhoId ? 'Ex.: Reunião ordinária de novembro' : 'Ex.: Conferência Municipal de Saúde'} {...campo('titulo')} />
      </label>
      <label>
        Tipo
        <select {...campo('tipo')}>
          {Object.entries(TIPOS_EVENTO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="duas-colunas">
        <label>
          Data
          <input type="date" {...campo('data')} />
        </label>
        <label>
          Horário
          <input type="time" {...campo('hora')} />
        </label>
      </div>
      <label>
        Local
        <input placeholder="Ex.: Sala de reuniões da UBS" {...campo('local')} />
      </label>
      <label>
        Descrição (opcional)
        <textarea rows={3} {...campo('descricao')} />
      </label>
      <label>
        Link (opcional)
        <input type="url" placeholder="https://…" {...campo('link_url')} />
      </label>
      {!conselhoId && (
        <>
          <small className="texto-suave">Escolha a cidade para um evento municipal, ou deixe em branco para um evento nacional.</small>
          <SeletorCidade valor={municipio} onChange={(m) => setMunicipio(m?.id ?? null)} />
        </>
      )}
      <Erro mensagem={erro} />
      <div className="acoes">
        <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <button className="botao">Criar evento</button>
      </div>
    </form>
  )
}
