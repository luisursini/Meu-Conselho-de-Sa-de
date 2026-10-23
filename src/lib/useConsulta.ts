import { useCallback, useEffect, useState, type DependencyList } from 'react'

/** Executa uma consulta assíncrona e expõe dados, erro, carregamento e recarregar(). */
export function useConsulta<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [versao, setVersao] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(fn, deps)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    executar()
      .then((d) => ativo && (setDados(d), setErro(null)))
      .catch((e: Error) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [executar, versao])

  return { dados, erro, carregando, recarregar: () => setVersao((v) => v + 1) }
}
