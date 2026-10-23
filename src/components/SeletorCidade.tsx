import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Municipio } from '../lib/tipos'
import { normalizar } from '../lib/texto'

interface Props {
  valor: number | null
  onChange: (municipio: Municipio | null) => void
}

export function SeletorCidade({ valor, onChange }: Props) {
  const [estados, setEstados] = useState<{ uf: string; nome: string }[]>([])
  const [uf, setUf] = useState('')
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase
      .from('estados')
      .select('uf, nome')
      .order('nome')
      .then(({ data }) => setEstados(data ?? []))
  }, [])

  // Ao editar um perfil existente, descobre o estado da cidade já escolhida.
  useEffect(() => {
    if (!valor || uf) return
    supabase
      .from('municipios')
      .select('*')
      .eq('id', valor)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUf(data.uf)
          setBusca(data.nome)
        }
      })
  }, [valor, uf])

  useEffect(() => {
    if (!uf) return
    supabase
      .from('municipios')
      .select('*')
      .eq('uf', uf)
      .order('nome')
      .then(({ data }) => setMunicipios(data ?? []))
  }, [uf])

  const filtrados = useMemo(() => {
    const t = normalizar(busca)
    return municipios.filter((m) => normalizar(m.nome).includes(t)).slice(0, 8)
  }, [busca, municipios])

  const escolhido = municipios.find((m) => m.id === valor)

  return (
    <div className="seletor-cidade">
      <label>
        Estado
        <select
          value={uf}
          onChange={(e) => {
            setUf(e.target.value)
            setBusca('')
            onChange(null)
          }}
        >
          <option value="">Selecione…</option>
          {estados.map((e) => (
            <option key={e.uf} value={e.uf}>
              {e.nome}
            </option>
          ))}
        </select>
      </label>
      {uf && (
        <label>
          Cidade
          <input
            type="search"
            value={busca}
            placeholder="Digite o nome da cidade"
            onChange={(e) => {
              setBusca(e.target.value)
              if (escolhido) onChange(null)
            }}
          />
          {!escolhido && busca && (
            <ul className="sugestoes">
              {filtrados.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBusca(m.nome)
                      onChange(m)
                    }}
                  >
                    {m.nome}
                  </button>
                </li>
              ))}
              {filtrados.length === 0 && <li className="sugestao-vazia">Nenhuma cidade encontrada</li>}
            </ul>
          )}
        </label>
      )}
    </div>
  )
}

