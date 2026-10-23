import type { ReactNode } from 'react'
import { calcularNivel } from '../lib/niveis'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="spinner" aria-hidden /> {texto}
    </div>
  )
}

export function Erro({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null
  return (
    <p className="erro" role="alert">
      {mensagem}
    </p>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="vazio">{children}</p>
}

export function Avatar({ url, nome, tamanho = 40 }: { url: string | null; nome: string; tamanho?: number }) {
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return url ? (
    <img className="avatar" src={url} alt="" width={tamanho} height={tamanho} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar avatar-iniciais" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}>
      {iniciais || '?'}
    </span>
  )
}

export function SeloNivel({ xp }: { xp: number }) {
  const n = calcularNivel(xp)
  return (
    <span className="selo-nivel" title={`${xp} XP`}>
      Nível {n.nivel} · {n.nome}
    </span>
  )
}

export function BarraXp({ xp }: { xp: number }) {
  const n = calcularNivel(xp)
  return (
    <div className="barra-xp">
      <div className="barra-xp-topo">
        <strong>
          Nível {n.nivel} · {n.nome}
        </strong>
        <span>{xp} XP</span>
      </div>
      <div className="barra" aria-hidden>
        <div className="barra-preenchida" style={{ width: `${Math.round(n.progresso * 100)}%` }} />
      </div>
      <small>
        {n.proximo ? `Faltam ${n.proximo.xp - xp} XP para ${n.proximo.nome}` : 'Você chegou ao nível máximo!'}
      </small>
    </div>
  )
}

export function Progresso({ feito, total }: { feito: number; total: number }) {
  const pct = total ? Math.round((feito / total) * 100) : 0
  return (
    <div className="progresso">
      <div className="barra" aria-hidden>
        <div className="barra-preenchida" style={{ width: `${pct}%` }} />
      </div>
      <small>
        {feito} de {total} concluídos
      </small>
    </div>
  )
}
