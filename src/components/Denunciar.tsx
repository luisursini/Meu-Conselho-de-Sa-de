import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { AlvoDenuncia } from '../lib/tipos'
import { Erro } from './ui'

const MOTIVOS = [
  'Ofensa, discurso de ódio ou assédio',
  'Informação falsa sobre saúde',
  'Propaganda político-partidária',
  'Spam ou propaganda',
  'Expõe dados pessoais de alguém',
]

/** Botão "Denunciar" que abre um pequeno formulário. A denúncia vai para o admin. */
export function Denunciar({ alvoTipo, alvoId }: { alvoTipo: AlvoDenuncia; alvoId: string }) {
  const { perfil } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [outro, setOutro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    const texto = motivo === 'outro' ? outro.trim() : motivo
    if (texto.length < 3) return setErro('Escolha ou escreva o motivo')
    const { error } = await supabase
      .from('denuncias')
      .insert({ denunciante_id: perfil!.id, alvo_tipo: alvoTipo, alvo_id: alvoId, motivo: texto })
    if (error && !error.message.includes('duplicate')) return setErro(error.message)
    setEnviado(true)
    setAberto(false)
  }

  if (enviado) return <small className="texto-suave">Denúncia enviada. Obrigado!</small>
  if (!aberto)
    return (
      <button className="link discreto" onClick={() => setAberto(true)}>
        Denunciar
      </button>
    )

  return (
    <div className="caixa denuncia">
      <strong>Por que você está denunciando?</strong>
      {MOTIVOS.map((m) => (
        <label key={m} className="check">
          <input type="radio" name={`motivo-${alvoId}`} checked={motivo === m} onChange={() => setMotivo(m)} />
          {m}
        </label>
      ))}
      <label className="check">
        <input type="radio" name={`motivo-${alvoId}`} checked={motivo === 'outro'} onChange={() => setMotivo('outro')} />
        Outro motivo
      </label>
      {motivo === 'outro' && <textarea rows={2} value={outro} onChange={(e) => setOutro(e.target.value)} maxLength={1000} />}
      <Erro mensagem={erro} />
      <div className="acoes">
        <button className="botao secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <button className="botao" onClick={enviar}>
          Enviar denúncia
        </button>
      </div>
    </div>
  )
}
