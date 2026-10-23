import type { Evento } from './tipos'

const formatoUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function fimDoEvento(e: Evento) {
  return e.fim ? new Date(e.fim) : new Date(new Date(e.inicio).getTime() + 2 * 3600 * 1000)
}

function descricaoCompleta(e: Evento) {
  return [e.descricao, e.conselho?.nome, e.link_url, 'Meu Conselho de Saúde'].filter(Boolean).join('\n\n')
}

/** Link "adicionar ao Google Agenda": o celular avisa antes do evento. */
export function linkGoogleAgenda(e: Evento) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${formatoUtc(new Date(e.inicio))}/${formatoUtc(fimDoEvento(e))}`,
    details: descricaoCompleta(e),
    location: e.local ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)

/** Arquivo .ics (agenda do iPhone, Outlook etc.) com lembretes 1 dia e 1 hora antes. */
export function baixarIcs(e: Evento) {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meu Conselho de Saude//PT-BR',
    'BEGIN:VEVENT',
    `UID:${e.id}@meuconselhodesaude`,
    `DTSTAMP:${formatoUtc(new Date())}`,
    `DTSTART:${formatoUtc(new Date(e.inicio))}`,
    `DTEND:${formatoUtc(fimDoEvento(e))}`,
    `SUMMARY:${escapar(e.titulo)}`,
    `DESCRIPTION:${escapar(descricaoCompleta(e))}`,
    e.local ? `LOCATION:${escapar(e.local)}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(e.titulo)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(e.titulo)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  const url = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.titulo.replace(/[^\p{L}\d ]/gu, '').trim() || 'evento'}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
