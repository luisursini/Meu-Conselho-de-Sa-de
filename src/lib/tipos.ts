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
  ultima_atividade_diretoria: string
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

export interface Post {
  id: string
  texto: string
  link_url: string | null
  video_url: string | null
  fotos: string[]
  tipo: 'normal' | 'ata' | 'aviso'
  escopo: 'publico' | 'mural'
  fixado: boolean
  created_at: string
  autor: { id: string; nome: string; avatar_url: string | null; xp: number }
  conselho: { id: string; nome: string } | null
  cidade: string | null
  curtidas: number
  curti: boolean
  comentarios: number
}

export type AbaFeed = 'nacional' | 'cidade' | 'seguindo' | 'conselho' | 'mural' | 'pessoa' | 'post'

export interface Evento {
  id: string
  tipo: 'reuniao' | 'conferencia' | 'outro'
  titulo: string
  descricao: string | null
  local: string | null
  link_url: string | null
  inicio: string
  fim: string | null
  conselho: { id: string; nome: string } | null
  cidade: string
  lembrete: boolean
}

export const TIPOS_EVENTO: Record<Evento['tipo'], string> = {
  reuniao: 'Reunião',
  conferencia: 'Conferência',
  outro: 'Evento',
}

export type AlvoDenuncia = 'post' | 'comentario_post' | 'comentario_aula'
