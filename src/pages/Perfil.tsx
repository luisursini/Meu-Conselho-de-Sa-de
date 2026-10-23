import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { CARGOS, SEGMENTOS, type Cargo, type Perfil as TPerfil } from '../lib/tipos'
import { Avatar, BarraXp, Carregando, Erro, SeloNivel, Vazio } from '../components/ui'

/** Meu perfil (/perfil) ou o perfil de outra pessoa (/pessoas/:id). */
export function Perfil() {
  const { pessoaId } = useParams()
  const { perfil: eu, sair } = useAuth()
  const id = pessoaId ?? eu!.id
  const proprio = id === eu!.id

  const { dados, erro, carregando } = useConsulta(async () => {
    const p = verificar(
      await supabase
        .from('profiles')
        .select('*, municipios(nome, uf), conselhos!profiles_conselho_id_fkey(id, nome), ubs(nome)')
        .eq('id', id)
        .single(),
    ) as TPerfil & {
      municipios: { nome: string; uf: string } | null
      conselhos: { id: string; nome: string } | null
      ubs: { nome: string } | null
    }
    const [medalhas, cargo] = await Promise.all([
      supabase.from('medalhas').select('created_at, trilhas(titulo, medalha_nome, medalha_emoji)').eq('user_id', id),
      p.conselho_id
        ? supabase.from('diretoria').select('cargo').eq('user_id', id).eq('conselho_id', p.conselho_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    return {
      p,
      medalhas: (medalhas.data ?? []) as unknown as { trilhas: { titulo: string; medalha_nome: string; medalha_emoji: string } }[],
      cargo: (cargo.data as { cargo: Cargo } | null)?.cargo ?? null,
    }
  }, [id, eu!.xp])

  if (carregando) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Perfil não encontrado'} />
  const { p, medalhas, cargo } = dados

  return (
    <div className="pagina">
      <div className="perfil-topo">
        <Avatar url={p.avatar_url} nome={p.nome} tamanho={72} />
        <div>
          <h1>{p.nome}</h1>
          <SeloNivel xp={p.xp} />
        </div>
      </div>

      {proprio && (
        <div className="cartao">
          <BarraXp xp={p.xp} />
        </div>
      )}

      <dl className="dados">
        {p.municipios && (
          <>
            <dt>Cidade</dt>
            <dd>
              {p.municipios.nome} – {p.municipios.uf}
            </dd>
          </>
        )}
        {p.segmento && (
          <>
            <dt>Segmento</dt>
            <dd>{SEGMENTOS[p.segmento]}</dd>
          </>
        )}
        {p.conselhos && (
          <>
            <dt>Conselho</dt>
            <dd>
              <Link to={`/conselhos/${p.conselhos.id}`}>{p.conselhos.nome}</Link>
              {cargo && <span className="etiqueta">{CARGOS[cargo]}</span>}
            </dd>
          </>
        )}
        {p.ubs && (
          <>
            <dt>UBS</dt>
            <dd>{p.ubs.nome}</dd>
          </>
        )}
      </dl>

      <h2>Medalhas</h2>
      {medalhas.length === 0 ? (
        <Vazio>{proprio ? 'Conclua uma trilha para ganhar sua primeira medalha!' : 'Nenhuma medalha ainda.'}</Vazio>
      ) : (
        <div className="medalhas">
          {medalhas.map((m) => (
            <div key={m.trilhas.titulo} className="medalha" title={m.trilhas.titulo}>
              <span>{m.trilhas.medalha_emoji}</span>
              <small>{m.trilhas.medalha_nome}</small>
            </div>
          ))}
        </div>
      )}

      {proprio && (
        <div className="acoes coluna">
          <Link to="/perfil/editar" className="botao secundario">
            ✏️ Editar perfil
          </Link>
          <button className="botao secundario" onClick={sair}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
