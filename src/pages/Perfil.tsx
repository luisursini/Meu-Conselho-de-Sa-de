import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, verificar } from '../lib/supabase'
import { useConsulta } from '../lib/useConsulta'
import { CARGOS, SEGMENTOS, type Cargo, type Perfil as TPerfil } from '../lib/tipos'
import { Avatar, BarraXp, Carregando, Erro, SeloNivel, Vazio } from '../components/ui'
import { ListaPosts } from '../components/ListaPosts'

/** Meu perfil (/perfil) ou o perfil de outra pessoa (/pessoas/:id). */
export function Perfil() {
  const { pessoaId } = useParams()
  const { perfil: eu, sair } = useAuth()
  const [versao, setVersao] = useState(0)
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
    const [medalhas, cargo, seguidores, seguindo, sigo] = await Promise.all([
      supabase.from('medalhas').select('created_at, trilhas(titulo, medalha_nome, medalha_emoji)').eq('user_id', id),
      p.conselho_id
        ? supabase.from('diretoria').select('cargo').eq('user_id', id).eq('conselho_id', p.conselho_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('seguidores_pessoa').select('seguidor_id', { count: 'exact', head: true }).eq('seguido_id', id),
      supabase.from('seguidores_pessoa').select('seguido_id', { count: 'exact', head: true }).eq('seguidor_id', id),
      supabase.from('seguidores_pessoa').select('seguido_id').eq('seguidor_id', eu!.id).eq('seguido_id', id).maybeSingle(),
    ])
    return {
      p,
      medalhas: (medalhas.data ?? []) as unknown as { trilhas: { titulo: string; medalha_nome: string; medalha_emoji: string } }[],
      cargo: (cargo.data as { cargo: Cargo } | null)?.cargo ?? null,
      seguidores: seguidores.count ?? 0,
      seguindo: seguindo.count ?? 0,
      sigo: !!sigo.data,
    }
  }, [id, eu!.xp, versao])

  if (carregando) return <Carregando />
  if (erro || !dados) return <Erro mensagem={erro ?? 'Perfil não encontrado'} />
  const { p, medalhas, cargo, seguidores, seguindo, sigo } = dados

  async function seguir() {
    if (sigo) await supabase.from('seguidores_pessoa').delete().eq('seguidor_id', eu!.id).eq('seguido_id', id)
    else await supabase.from('seguidores_pessoa').insert({ seguidor_id: eu!.id, seguido_id: id })
    setVersao((v) => v + 1)
  }

  return (
    <div className="pagina">
      <div className="perfil-topo">
        <Avatar url={p.avatar_url} nome={p.nome} tamanho={72} />
        <div>
          <h1>{p.nome}</h1>
          <SeloNivel xp={p.xp} />
          <p className="texto-suave contadores">
            <strong>{seguidores}</strong> {seguidores === 1 ? 'seguidor' : 'seguidores'} · <strong>{seguindo}</strong> seguindo
          </p>
        </div>
      </div>
      {!proprio && (
        <button className={`botao ${sigo ? 'secundario' : ''}`} onClick={seguir}>
          {sigo ? '✔️ Seguindo' : '➕ Seguir'}
        </button>
      )}

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

      <h2>Publicações</h2>
      <ListaPosts aba="pessoa" ref_={p.id} vazio={proprio ? 'Você ainda não publicou nada.' : 'Nenhuma publicação ainda.'} />

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
