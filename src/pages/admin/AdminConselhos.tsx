import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { SeletorCidade } from '../../components/SeletorCidade'

interface Linha {
  id: string
  nome: string
  membros: number
  ubs: string[]
}

/** Lista conselhos de uma cidade e permite juntar duplicados. */
export function AdminConselhos() {
  const [municipio, setMunicipio] = useState<number | null>(null)
  const [conselhos, setConselhos] = useState<Linha[]>([])
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function carregar(id: number) {
    const { data } = await supabase.rpc('buscar_conselhos', { p_municipio: id, p_termo: '' })
    setConselhos((data as Linha[]) ?? [])
  }

  async function mesclar() {
    setErro(null)
    setMsg(null)
    const o = conselhos.find((c) => c.id === origem)
    const d = conselhos.find((c) => c.id === destino)
    if (!o || !d || o.id === d.id) return setErro('Escolha dois conselhos diferentes')
    if (!confirm(`Juntar “${o.nome}” em “${d.nome}”? Membros, diretoria, seguidores e UBS serão movidos.`)) return
    const { error } = await supabase.rpc('mesclar_conselhos', { p_origem: o.id, p_destino: d.id })
    if (error) return setErro(error.message)
    setMsg('Conselhos unidos!')
    setOrigem('')
    setDestino('')
    carregar(municipio!)
  }

  return (
    <div className="formulario">
      <p className="texto-suave">Escolha uma cidade para ver os conselhos cadastrados e juntar duplicados.</p>
      <SeletorCidade
        valor={municipio}
        onChange={(m) => {
          setMunicipio(m?.id ?? null)
          if (m) carregar(m.id)
        }}
      />
      {municipio && (
        <>
          <ul className="lista-admin">
            {conselhos.map((c) => (
              <li key={c.id}>
                <Link to={`/conselhos/${c.id}`}>{c.nome}</Link>
                <small className="texto-suave">
                  {c.membros} membros · {c.ubs.join(', ')}
                </small>
              </li>
            ))}
          </ul>
          {conselhos.length >= 2 && (
            <div className="caixa">
              <h3>Juntar conselhos duplicados</h3>
              <label>
                Conselho duplicado (será removido)
                <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
                  <option value="">Selecione…</option>
                  {conselhos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Conselho que fica
                <select value={destino} onChange={(e) => setDestino(e.target.value)}>
                  <option value="">Selecione…</option>
                  {conselhos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <Erro mensagem={erro} />
              {msg && <p className="sucesso-msg">{msg}</p>}
              <button className="botao" onClick={mesclar}>
                Juntar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
