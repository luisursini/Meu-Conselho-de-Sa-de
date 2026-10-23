import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Ubs } from '../lib/tipos'
import { useAuth } from '../contexts/AuthContext'
import { Erro } from './ui'

interface Props {
  municipioId: number
  valor: Ubs | null
  onChange: (ubs: Ubs | null) => void
  rotulo?: string
}

/** Busca UBS da cidade (base CNES) e permite cadastrar uma que não esteja na lista. */
export function SeletorUbs({ municipioId, valor, onChange, rotulo = 'Unidade Básica de Saúde (UBS)' }: Props) {
  const { sessao } = useAuth()
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Ubs[]>([])
  const [cadastrando, setCadastrando] = useState(false)
  const [novaNome, setNovaNome] = useState('')
  const [novaBairro, setNovaBairro] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (valor) return
    const termo = busca.trim()
    const t = setTimeout(async () => {
      let q = supabase.from('ubs').select('*').eq('municipio_id', municipioId).order('nome').limit(15)
      if (termo) q = q.or(`nome.ilike.%${termo.replace(/[%,()]/g, '')}%,bairro.ilike.%${termo.replace(/[%,()]/g, '')}%`)
      const { data } = await q
      setResultados((data as Ubs[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca, municipioId, valor])

  async function cadastrar() {
    setErro(null)
    if (novaNome.trim().length < 3) return setErro('Informe o nome da UBS')
    const { data, error } = await supabase
      .from('ubs')
      .insert({ nome: novaNome.trim(), bairro: novaBairro.trim() || null, municipio_id: municipioId, criada_por: sessao?.user.id })
      .select()
      .single()
    if (error) return setErro(error.message)
    setCadastrando(false)
    onChange(data as Ubs)
  }

  if (valor) {
    return (
      <div className="campo">
        <span className="rotulo">{rotulo}</span>
        <div className="escolhido">
          <span>
            🏥 <strong>{valor.nome}</strong>
            {valor.bairro && <small> · {valor.bairro}</small>}
          </span>
          <button type="button" className="link" onClick={() => onChange(null)}>
            Trocar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="campo">
      <label>
        {rotulo}
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou bairro da UBS" />
      </label>
      <ul className="sugestoes">
        {resultados.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => onChange(u)}>
              {u.nome}
              {u.bairro && <small> · {u.bairro}</small>}
            </button>
          </li>
        ))}
        {resultados.length === 0 && <li className="sugestao-vazia">Nenhuma UBS encontrada</li>}
      </ul>
      {!cadastrando ? (
        <button type="button" className="link" onClick={() => (setCadastrando(true), setNovaNome(busca))}>
          Não encontrei minha UBS
        </button>
      ) : (
        <div className="caixa">
          <label>
            Nome da UBS
            <input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
          </label>
          <label>
            Bairro
            <input value={novaBairro} onChange={(e) => setNovaBairro(e.target.value)} />
          </label>
          <Erro mensagem={erro} />
          <div className="acoes">
            <button type="button" className="botao secundario" onClick={() => setCadastrando(false)}>
              Cancelar
            </button>
            <button type="button" className="botao" onClick={cadastrar}>
              Cadastrar UBS
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
