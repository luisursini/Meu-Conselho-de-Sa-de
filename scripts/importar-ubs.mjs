// Importa as Unidades Básicas de Saúde de um estado a partir da API de Dados Abertos do
// Ministério da Saúde (CNES) para a tabela public.ubs do Supabase.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar-ubs.mjs SP
//
// Tipos importados: 01 (Posto de Saúde) e 02 (Centro de Saúde / Unidade Básica).
// A chave service_role ignora as regras de segurança — NUNCA coloque no app nem no GitHub.

import { createClient } from '@supabase/supabase-js'

const API = process.env.CNES_API || 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos'
const TIPOS = [1, 2]
const POR_PAGINA = 20 // limite da API

const CODIGO_UF = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27,
  SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
}

const uf = (process.argv[2] || '').toUpperCase()
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!CODIGO_UF[uf] || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/importar-ubs.mjs <UF>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// O CNES usa o código do município com 6 dígitos; o IBGE usa 7 (com dígito verificador).
const { data: municipios, error } = await supabase.from('municipios').select('id').eq('uf', uf)
if (error) throw error
const ibgePorCnes = new Map(municipios.map((m) => [Math.floor(m.id / 10), m.id]))

const titulo = (s) =>
  (s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s|\/|-)(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (p) => p.toLowerCase())
    .replace(/\b(Ubs|Usf|Esf|Cs|Ps|Sus)\b/g, (p) => p.toUpperCase())

async function buscar(tipo, offset, tentativa = 1) {
  const url = `${API}?codigo_tipo_unidade=${tipo}&codigo_uf=${CODIGO_UF[uf]}&limit=${POR_PAGINA}&offset=${offset}`
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const json = await r.json()
    return json.estabelecimentos ?? []
  } catch (e) {
    if (tentativa >= 5) throw e
    await new Promise((ok) => setTimeout(ok, 1000 * tentativa))
    return buscar(tipo, offset, tentativa + 1)
  }
}

let total = 0
for (const tipo of TIPOS) {
  for (let offset = 0; ; offset += POR_PAGINA) {
    const lote = await buscar(tipo, offset)
    if (lote.length === 0) break
    const linhas = lote
      .map((e) => ({
        cnes: String(e.codigo_cnes).padStart(7, '0'),
        nome: titulo(e.nome_fantasia || e.nome_razao_social),
        bairro: titulo(e.bairro_estabelecimento) || null,
        endereco: [titulo(e.endereco_estabelecimento), e.numero_estabelecimento].filter(Boolean).join(', ') || null,
        municipio_id: ibgePorCnes.get(Number(e.codigo_municipio)),
      }))
      .filter((l) => l.municipio_id && l.nome)
    if (linhas.length) {
      const { error: erro } = await supabase.from('ubs').upsert(linhas, { onConflict: 'cnes' })
      if (erro) throw erro
    }
    total += linhas.length
    process.stdout.write(`\r${uf}: ${total} unidades importadas`)
  }
}
console.log(`\nPronto! ${total} unidades de ${uf}.`)
