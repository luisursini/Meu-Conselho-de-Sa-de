import { Link } from 'react-router-dom'
import { supabase, verificar } from '../../lib/supabase'
import { useConsulta } from '../../lib/useConsulta'
import { dataCurta } from '../../lib/texto'
import { CARGOS, type AlvoDenuncia, type Cargo } from '../../lib/tipos'
import { Carregando, Erro, Vazio } from '../../components/ui'

interface ItemDenunciado {
  alvo_tipo: AlvoDenuncia
  alvo_id: string
  denuncias: { id: string; motivo: string; created_at: string; denunciante: string }[]
  conteudo: { texto: string; fotos?: string[]; link_url?: string; autor: string; autor_id: string; post_id?: string; aula_id?: string } | null
}

const NOMES: Record<AlvoDenuncia, string> = {
  post: 'Publicação',
  comentario_post: 'Comentário em publicação',
  comentario_aula: 'Comentário em aula',
}

export function AdminDenuncias() {
  const { dados, erro, carregando, recarregar } = useConsulta(
    async () => verificar(await supabase.rpc('denuncias_pendentes')) as ItemDenunciado[],
    [],
  )

  async function resolver(item: ItemDenunciado, remover: boolean) {
    if (remover && !confirm('Remover este conteúdo do app?')) return
    await supabase.rpc('resolver_denuncia', { p_alvo_tipo: item.alvo_tipo, p_alvo_id: item.alvo_id, p_remover: remover })
    recarregar()
  }

  if (carregando && !dados) return <Carregando />
  return (
    <div className="lista">
      <Erro mensagem={erro} />
      {dados?.length === 0 && <Vazio>Nenhuma denúncia pendente. 🎉</Vazio>}
      {dados?.map((item) => (
        <div key={item.alvo_id} className="cartao denuncia-item">
          <small className="texto-suave">
            {NOMES[item.alvo_tipo]} · {item.denuncias.length} {item.denuncias.length === 1 ? 'denúncia' : 'denúncias'}
          </small>
          {item.conteudo ? (
            <>
              <p>
                <Link to={`/pessoas/${item.conteudo.autor_id}`}>
                  <strong>{item.conteudo.autor}</strong>
                </Link>{' '}
                escreveu:
              </p>
              <blockquote className="citacao">{item.conteudo.texto || '(sem texto)'}</blockquote>
              {!!item.conteudo.fotos?.length && (
                <div className="fotos-previa">
                  {item.conteudo.fotos.map((f) => (
                    <div key={f}>
                      <img src={f} alt="" />
                    </div>
                  ))}
                </div>
              )}
              {item.conteudo.post_id && <Link to={`/posts/${item.conteudo.post_id}`}>Ver publicação</Link>}
              {item.conteudo.aula_id && <Link to={`/aula/${item.conteudo.aula_id}`}>Ver aula</Link>}
            </>
          ) : (
            <p className="texto-suave">O conteúdo já foi apagado pelo autor.</p>
          )}
          <ul className="lista-simples motivos">
            {item.denuncias.map((d) => (
              <li key={d.id}>
                🚩 <strong>{d.motivo}</strong> <small className="texto-suave">— {d.denunciante}, {dataCurta(d.created_at)}</small>
              </li>
            ))}
          </ul>
          <div className="acoes">
            <button className="botao secundario" onClick={() => resolver(item, false)}>
              Manter (ignorar)
            </button>
            <button className="botao perigo" onClick={() => resolver(item, true)}>
              Remover conteúdo
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

interface Solicitacao {
  id: string
  cargo: Cargo
  mensagem: string | null
  created_at: string
  profiles: { id: string; nome: string }
  conselhos: { id: string; nome: string; ultima_atividade_diretoria: string }
}

export function AdminSolicitacoes() {
  const { dados, erro, carregando, recarregar } = useConsulta(
    async () =>
      verificar(
        await supabase
          .from('solicitacoes_diretoria')
          .select('id, cargo, mensagem, created_at, profiles(id, nome), conselhos(id, nome, ultima_atividade_diretoria)')
          .eq('status', 'pendente')
          .order('created_at'),
      ) as unknown as Solicitacao[],
    [],
  )

  async function resolver(id: string, aprovar: boolean) {
    await supabase.rpc('resolver_solicitacao_diretoria', { p_id: id, p_aprovar: aprovar })
    recarregar()
  }

  if (carregando && !dados) return <Carregando />
  return (
    <div className="lista">
      <p className="texto-suave">
        Pedidos de membros para assumir a diretoria de conselhos sem atividade há mais de 60 dias. Antes de aprovar, veja
        a página do conselho. Lá você também pode remover a diretoria antiga.
      </p>
      <Erro mensagem={erro} />
      {dados?.length === 0 && <Vazio>Nenhum pedido pendente.</Vazio>}
      {dados?.map((s) => (
        <div key={s.id} className="cartao">
          <p>
            <Link to={`/pessoas/${s.profiles.id}`}>
              <strong>{s.profiles.nome}</strong>
            </Link>{' '}
            quer ser <strong>{CARGOS[s.cargo]}</strong> de{' '}
            <Link to={`/conselhos/${s.conselhos.id}`}>{s.conselhos.nome}</Link>
          </p>
          <small className="texto-suave">
            Última atividade da diretoria: {dataCurta(s.conselhos.ultima_atividade_diretoria)} · pedido em {dataCurta(s.created_at)}
          </small>
          {s.mensagem && <blockquote className="citacao">{s.mensagem}</blockquote>}
          <div className="acoes">
            <button className="botao secundario" onClick={() => resolver(s.id, false)}>
              Recusar
            </button>
            <button className="botao" onClick={() => resolver(s.id, true)}>
              Aprovar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
