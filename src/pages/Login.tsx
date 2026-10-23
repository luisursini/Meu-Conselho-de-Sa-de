import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabaseConfigurado } from '../lib/supabase'

export function Login() {
  const { entrarComGoogle } = useAuth()
  return (
    <div className="login">
      <div className="login-cartao">
        <img src="/icone.svg" alt="" width={84} height={84} />
        <h1>Meu Conselho de Saúde</h1>
        <p className="login-sub">
          Aprenda sobre o controle social do SUS, ganhe experiência e participe do conselho de saúde do seu bairro.
        </p>
        <ul className="login-lista">
          <li>📚 Trilhas de aprendizado com questões</li>
          <li>⭐ Pontos de experiência, níveis e medalhas</li>
          <li>🤝 Encontre o conselho da sua UBS</li>
        </ul>
        {supabaseConfigurado ? (
          <button className="botao botao-google" onClick={entrarComGoogle}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Entrar com Google
          </button>
        ) : (
          <p className="erro">
            O app ainda não foi ligado ao Supabase. Preencha o arquivo <code>.env</code> (veja o README).
          </p>
        )}
        <p className="login-rodape">
          Projeto independente de educação sobre o controle social no SUS.
          <br />
          Ao entrar, você concorda com a nossa <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}
