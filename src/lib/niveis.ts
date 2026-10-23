export const NIVEIS = [
  { nivel: 1, xp: 0, nome: 'Cidadão Curioso' },
  { nivel: 2, xp: 200, nome: 'Participante' },
  { nivel: 3, xp: 600, nome: 'Defensor do SUS' },
  { nivel: 4, xp: 1200, nome: 'Conselheiro Atuante' },
  { nivel: 5, xp: 2500, nome: 'Guardião do Controle Social' },
] as const

export function calcularNivel(xp: number) {
  let atual: (typeof NIVEIS)[number] = NIVEIS[0]
  for (const n of NIVEIS) if (xp >= n.xp) atual = n
  const proximo = NIVEIS.find((n) => n.xp > xp) ?? null
  const progresso = proximo ? (xp - atual.xp) / (proximo.xp - atual.xp) : 1
  return { ...atual, proximo, progresso }
}
