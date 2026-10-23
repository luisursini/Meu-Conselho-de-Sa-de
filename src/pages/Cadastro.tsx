import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SEGMENTOS, type Municipio, type Segmento, type Ubs } from '../lib/tipos'
import { SeletorCidade } from '../components/SeletorCidade'
import { SeletorUbs } from '../components/SeletorUbs'
import { SeletorConselho, type ConselhoEscolhido } from '../components/SeletorConselho'
import { Erro } from '../components/ui'

/** Primeiro cadastro e edição do perfil. */
export function Cadastro({ edicao = false }: { edicao?: boolean }) {
  const { perfil, sessao, recarregarPerfil } = useAuth()
  const navegar = useNavigate()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [municipio, setMunicipio] = useState<number | null>(perfil?.municipio_id ?? null)
  const [segmento, setSegmento] = useState<Segmento | null>(perfil?.segmento ?? null)
  const [conselho, setConselho] = useState<ConselhoEscolhido | null>(null)
  const [ubs, setUbs] = useState<Ubs | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Carrega conselho e UBS atuais ao editar.
  useEffect(() => {
    if (perfil?.conselho_id)
      supabase.from('conselhos').select('id, nome').eq('id', perfil.conselho_id).maybeSingle().then(({ data }) => setConselho(data))
    if (perfil?.ubs_id)
      supabase.from('ubs').select('*').eq('id', perfil.ubs_id).maybeSingle().then(({ data }) => setUbs(data as Ubs | null))
  }, [perfil?.conselho_id, perfil?.ubs_id])

  const temVinculo = segmento !== null && segmento !== 'sem_vinculo'

  function trocarCidade(m: Municipio | null) {
    if (m?.id === municipio) return
    setMunicipio(m?.id ?? null)
    setConselho(null)
    setUbs(null)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return setErro('Informe seu nome')
    if (!municipio) return setErro('Escolha seu estado e sua cidade')
    if (!segmento) return setErro('Escolha seu segmento')
    if (temVinculo && !conselho) return setErro('Escolha ou cadastre o seu Conselho Local de Saúde')
    setSalvando(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: nome.trim(),
        municipio_id: municipio,
        segmento,
        conselho_id: temVinculo ? conselho!.id : null,
        ubs_id: ubs?.id ?? null,
      })
      .eq('id', sessao!.user.id)
    setSalvando(false)
    if (error) return setErro(error.message)
    await recarregarPerfil()
    navegar(edicao ? '/perfil' : '/')
  }

  return (
    <form className="pagina formulario" onSubmit={salvar}>
      <h1>{edicao ? 'Editar perfil' : 'Bem-vindo(a)! 👋'}</h1>
      {!edicao && <p>Conte um pouco sobre você para encontrarmos o conselho de saúde perto de você.</p>}

      <label>
        Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      </label>

      <SeletorCidade valor={municipio} onChange={trocarCidade} />

      <fieldset>
        <legend>Qual é o seu segmento?</legend>
        <div className="opcoes">
          {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
            <label key={s} className={`opcao ${segmento === s ? 'ativa' : ''}`}>
              <input type="radio" name="segmento" checked={segmento === s} onChange={() => setSegmento(s)} />
              {SEGMENTOS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      {municipio && temVinculo && <SeletorConselho municipioId={municipio} valor={conselho} onChange={setConselho} />}

      {municipio && segmento && (
        <SeletorUbs
          municipioId={municipio}
          valor={ubs}
          onChange={setUbs}
          rotulo={temVinculo ? 'UBS ligada ao seu conselho (opcional)' : 'Qual é a UBS do seu bairro? (opcional)'}
        />
      )}

      <Erro mensagem={erro} />
      <button className="botao grande" disabled={salvando}>
        {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Começar'}
      </button>
    </form>
  )
}
