/** Extrai o ID de um link do YouTube (watch, youtu.be, shorts ou embed). */
export function idYoutube(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/)
      if (m) return m[2]
    }
  } catch {
    return null
  }
  return null
}
