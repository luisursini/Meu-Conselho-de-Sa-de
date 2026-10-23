import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { enviarFoto } from '../lib/imagens'
import { Avatar, Erro } from './ui'

interface Props {
  /** Mural: publica só para os membros do conselho. */
  mural?: { conselhoId: string; souDiretoria: boolean }
  /** Diretoria pode publicar no feed em nome do conselho. */
  comoConselho?: { id: string; nome: string } | null
  aoPublicar: () => void
}

const MAX_FOTOS = 4

export function NovoPost({ mural, comoConselho, aoPublicar }: Props) {
  const { perfil } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [video, setVideo] = useState('')
  const [extra, setExtra] = useState<'link' | 'video' | null>(null)
  const [tipo, setTipo] = useState<'normal' | 'ata' | 'aviso'>('normal')
  const [emNomeDoConselho, setEmNomeDoConselho] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionarFotos(arquivos: FileList) {
    setErro(null)
    const lista = Array.from(arquivos).slice(0, MAX_FOTOS - fotos.length)
    setEnviando(true)
    try {
      const urls = await Promise.all(lista.map((a) => enviarFoto(a, perfil!.id)))
      setFotos((f) => [...f, ...urls])
    } catch (e) {
      setErro((e as Error).message)
    }
    setEnviando(false)
  }

  async function publicar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const linkOk = link.trim() && !/^https?:\/\//i.test(link.trim()) ? `https://${link.trim()}` : link.trim()
    const videoOk = video.trim() && !/^https?:\/\//i.test(video.trim()) ? `https://${video.trim()}` : video.trim()
    if (!texto.trim() && !fotos.length && !linkOk && !videoOk) return setErro('Escreva algo ou adicione uma foto, link ou vídeo')
    setEnviando(true)
    const { error } = await supabase.from('posts').insert({
      texto: texto.trim(),
      fotos,
      link_url: linkOk || null,
      video_url: videoOk || null,
      escopo: mural ? 'mural' : 'publico',
      conselho_id: mural ? mural.conselhoId : emNomeDoConselho ? comoConselho!.id : null,
      tipo: mural?.souDiretoria ? tipo : 'normal',
    })
    setEnviando(false)
    if (error) return setErro(error.message)
    setTexto('')
    setFotos([])
    setLink('')
    setVideo('')
    setExtra(null)
    setTipo('normal')
    setAberto(false)
    aoPublicar()
  }

  if (!aberto)
    return (
      <button className="cartao novo-post-fechado" onClick={() => setAberto(true)}>
        <Avatar url={perfil!.avatar_url} nome={perfil!.nome} tamanho={36} />
        <span>{mural ? 'Escreva para os membros do conselho…' : 'O que você quer compartilhar?'}</span>
      </button>
    )

  return (
    <form className="cartao novo-post" onSubmit={publicar}>
      {comoConselho && !mural && (
        <div className="abas">
          <button type="button" className={!emNomeDoConselho ? 'ativa' : ''} onClick={() => setEmNomeDoConselho(false)}>
            Como {perfil!.nome.split(' ')[0]}
          </button>
          <button type="button" className={emNomeDoConselho ? 'ativa' : ''} onClick={() => setEmNomeDoConselho(true)}>
            Como {comoConselho.nome}
          </button>
        </div>
      )}
      {mural?.souDiretoria && (
        <div className="abas">
          {(
            [
              ['normal', '💬 Conversa'],
              ['aviso', '📢 Aviso'],
              ['ata', '📄 Ata'],
            ] as const
          ).map(([v, r]) => (
            <button key={v} type="button" className={tipo === v ? 'ativa' : ''} onClick={() => setTipo(v)}>
              {r}
            </button>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        rows={4}
        maxLength={5000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={tipo === 'ata' ? 'Cole aqui a ata ou o resumo da reunião…' : 'Escreva aqui…'}
      />
      {fotos.length > 0 && (
        <div className="fotos-previa">
          {fotos.map((f) => (
            <div key={f}>
              <img src={f} alt="" />
              <button type="button" aria-label="Remover foto" onClick={() => setFotos(fotos.filter((x) => x !== f))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {extra === 'link' && (
        <input type="url" inputMode="url" placeholder="Cole o link (https://…)" value={link} onChange={(e) => setLink(e.target.value)} />
      )}
      {extra === 'video' && (
        <input type="url" inputMode="url" placeholder="Link do vídeo (YouTube, Instagram…)" value={video} onChange={(e) => setVideo(e.target.value)} />
      )}
      <div className="barra-acoes">
        <label className={`chip ${fotos.length >= MAX_FOTOS ? 'desativado' : ''}`}>
          📷 Foto
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={fotos.length >= MAX_FOTOS}
            onChange={(e) => e.target.files && adicionarFotos(e.target.files)}
          />
        </label>
        <button type="button" className={`chip ${extra === 'link' ? 'ativo' : ''}`} onClick={() => setExtra(extra === 'link' ? null : 'link')}>
          🔗 Link
        </button>
        <button type="button" className={`chip ${extra === 'video' ? 'ativo' : ''}`} onClick={() => setExtra(extra === 'video' ? null : 'video')}>
          ▶️ Vídeo
        </button>
      </div>
      <Erro mensagem={erro} />
      <div className="acoes">
        <button type="button" className="botao secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <button className="botao" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}
