import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CARGOS, type Cargo, type Ubs } from '../lib/tipos'
import { SeletorUbs } from './SeletorUbs'
import { Erro } from './ui'

export interface ConselhoEscolhido {
  id: string
  nome: string
}

interface Sugestao {
  id: string
  nome: string
  similaridade: number
  membros: number
  ubs: string[]
}

interface Props {
  municipioId: number
  valor: ConselhoEscolhido | null
  onChange: (c: ConselhoEscolhido | null) => void
}

/**
 * Busca conselhos da cidade enquanto a pessoa digita e mostra os parecidos.
 * Se não existir, permite cadastrar — quem cadastra vira diretoria provisória.
 */
export function SeletorConselho({ municipioId, valor, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [criando, setCriando] = useState(false)
  const [ubsNovas, setUbsNovas] = useState<Ubs[]>([])
  const [cargo, setCargo] = useState<Cargo>('presidente')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (valor) return
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('buscar_conselhos', { p_municipio: municipioId, p_termo: busca })
      setSugestoes((data as Sugestao[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca, municipioId, valor])

  async function criar() {
    setErro(null)
    if (busca.trim().length < 3) return setErro('Digite o nome do conselho')
    if (ubsNovas.length === 0) return setErro('Escolha ao menos uma UBS atendida pelo conselho')
    setSalvando(true)
    const { data, error } = await supabase.rpc('criar_conselho', {
      p_nome: busca.trim(),
      p_municipio: municipioId,
      p_ubs: ubsNovas.map((u) => u.id),
      p_cargo: cargo,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setCriando(false)
    onChange({ id: data as string, nome: busca.trim() })
  }

  if (valor) {
    return (
      <div className="campo">
        <span className="rotulo">Conselho Local de Saúde</span>
        <div className="escolhido">
          <span>
            🤝 <strong>{valor.nome}</strong>
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
        Conselho Local de Saúde
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: Conselho Local de Saúde Vila Nova"
        />
      </label>
      {!criando && (
        <>
          {sugestoes.length > 0 && <small className="dica">{busca ? 'Você quis dizer:' : 'Conselhos já cadastrados na cidade:'}</small>}
          <ul className="sugestoes">
            {sugestoes.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onChange({ id: s.id, nome: s.nome })}>
                  <strong>{s.nome}</strong>
                  <small>
                    {s.membros} {s.membros === 1 ? 'membro' : 'membros'}
                    {s.ubs.length > 0 && ` · Atende: ${s.ubs.join(', ')}`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {busca.trim().length >= 3 && (
            <button type="button" className="botao secundario" onClick={() => setCriando(true)}>
              ➕ Cadastrar “{busca.trim()}” como novo conselho
            </button>
          )}
        </>
      )}
      {criando && (
        <div className="caixa">
          <p>
            Cadastrando <strong>{busca.trim()}</strong>. Como você está cadastrando, entra como{' '}
            <strong>diretoria provisória</strong> e depois pode indicar os demais membros da diretoria.
          </p>
          <span className="rotulo">UBS atendidas pelo conselho</span>
          {ubsNovas.map((u) => (
            <div className="escolhido" key={u.id}>
              <span>🏥 {u.nome}</span>
              <button type="button" className="link" onClick={() => setUbsNovas(ubsNovas.filter((x) => x.id !== u.id))}>
                Remover
              </button>
            </div>
          ))}
          <SeletorUbs
            municipioId={municipioId}
            valor={null}
            rotulo={ubsNovas.length ? 'Adicionar outra UBS' : 'Buscar UBS'}
            onChange={(u) => u && !ubsNovas.some((x) => x.id === u.id) && setUbsNovas([...ubsNovas, u])}
          />
          <label>
            Seu cargo na diretoria
            <select value={cargo} onChange={(e) => setCargo(e.target.value as Cargo)}>
              {Object.entries(CARGOS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <Erro mensagem={erro} />
          <div className="acoes">
            <button type="button" className="botao secundario" onClick={() => setCriando(false)}>
              Voltar
            </button>
            <button type="button" className="botao" disabled={salvando} onClick={criar}>
              {salvando ? 'Salvando…' : 'Cadastrar conselho'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
