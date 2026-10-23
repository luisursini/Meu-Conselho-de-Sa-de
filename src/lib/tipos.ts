export type Segmento = 'usuario' | 'trabalhador' | 'gestao' | 'prestador' | 'sem_vinculo'
export type Cargo = 'presidente' | 'vice_presidente' | 'primeiro_secretario' | 'segundo_secretario' | 'outro'
export type TipoAula = 'texto' | 'video' | 'pdf'

export interface Perfil {
  id: string
  nome: string
  avatar_url: string | null
  municipio_id: number | null
  segmento: Segmento | null
  conselho_id: string | null
  ubs_id: string | null
  is_admin: boolean
  xp: number
}

export interface Municipio {
  id: number
  nome: string
  uf: string
}

export interface Ubs {
  id: string
  cnes: string | null
  nome: string
  bairro: string | null
  municipio_id: number
}

export interface Conselho {
  id: string
  nome: string
  municipio_id: number
  descricao: string | null
  local_reunioes: string | null
  horario_reunioes: string | null
  status_diretoria: 'provisoria' | 'confirmada'
  mandato_inicio: string | null
  mandato_fim: string | null
  mesclado_em: string | null
}

export interface Trilha {
  id: string
  titulo: string
  descricao: string | null
  ordem: number
  medalha_nome: string
  medalha_emoji: string
  publicada: boolean
}

export interface Curso {
  id: string
  trilha_id: string
  titulo: string
  descricao: string | null
  ordem: number
}

export interface Aula {
  id: string
  curso_id: string
  titulo: string
  tipo: TipoAula
  texto: string | null
  video_url: string | null
  pdf_url: string | null
  ordem: number
}

export interface Questao {
  id: string
  trilha_id: string
  curso_id: string | null
  uso: 'curso' | 'desafio'
  enunciado: string
  alternativas: string[]
  ordem: number
}

export interface ResultadoQuestionario {
  acertos: number
  total: number
  aprovado: boolean
  xp_ganho: number
  medalha: boolean
  correcao: { questao_id: string; resposta: number | null; correta: number; acertou: boolean; explicacao: string | null }[]
}

export const SEGMENTOS: Record<Segmento, string> = {
  usuario: 'Usuário',
  trabalhador: 'Trabalhador(a)',
  gestao: 'Gestão',
  prestador: 'Prestador(a) de serviço',
  sem_vinculo: 'Sem vínculo ainda',
}

export const CARGOS: Record<Cargo, string> = {
  presidente: 'Presidente',
  vice_presidente: 'Vice-presidente',
  primeiro_secretario: '1º Secretário(a)',
  segundo_secretario: '2º Secretário(a)',
  outro: 'Diretoria',
}
