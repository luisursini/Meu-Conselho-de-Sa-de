import { supabase, verificar } from './supabase'
import type { Curso, Trilha } from './tipos'

export interface TrilhaComProgresso extends Trilha {
  cursos: (Curso & { aulas: { id: string }[] })[]
  cursosAprovados: number
  concluida: boolean
}

/** Trilhas publicadas com o progresso do usuário logado. */
export async function carregarTrilhas(userId: string): Promise<TrilhaComProgresso[]> {
  const [trilhas, aprovados, medalhas] = await Promise.all([
    supabase.from('trilhas').select('*, cursos(*, aulas(id))').eq('publicada', true).order('ordem'),
    supabase.from('cursos_aprovados').select('curso_id').eq('user_id', userId),
    supabase.from('medalhas').select('trilha_id').eq('user_id', userId),
  ]).then((r) => r.map((x) => verificar<unknown>(x)))

  const aprovadosSet = new Set((aprovados as { curso_id: string }[]).map((a) => a.curso_id))
  const medalhasSet = new Set((medalhas as { trilha_id: string }[]).map((m) => m.trilha_id))

  return (trilhas as TrilhaComProgresso[]).map((t) => ({
    ...t,
    cursos: [...t.cursos].sort((a, b) => a.ordem - b.ordem),
    cursosAprovados: t.cursos.filter((c) => aprovadosSet.has(c.id)).length,
    concluida: medalhasSet.has(t.id),
  }))
}
