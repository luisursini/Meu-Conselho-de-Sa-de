import { supabase } from './supabase'

const LADO_MAXIMO = 1600

/** Reduz a foto (para gastar menos internet) e envia para o Storage. Devolve a URL pública. */
export async function enviarFoto(arquivo: File, userId: string): Promise<string> {
  const reduzida = await reduzir(arquivo)
  const caminho = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('posts').upload(caminho, reduzida, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return supabase.storage.from('posts').getPublicUrl(caminho).data.publicUrl
}

async function reduzir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível ler a foto'))), 'image/jpeg', 0.8))
}
