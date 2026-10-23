/** Remove acentos e caixa para comparar textos digitados. */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias" ou a data. */
export function tempoRelativo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} ${Math.floor(s / 86400) === 1 ? 'dia' : 'dias'}`
  return dataCurta(iso)
}
