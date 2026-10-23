import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './ui'

export function Layout() {
  const { perfil } = useAuth()
  return (
    <div className="app">
      <header className="topo">
        <Link to="/" className="marca">
          <img src="/icone.svg" alt="" width={30} height={30} />
          <span>Meu Conselho de Saúde</span>
        </Link>
        {perfil && (
          <div className="topo-acoes">
            <Link to="/eventos" className="topo-icone" aria-label="Eventos">
              📅
            </Link>
            <Link to="/perfil" className="topo-perfil" aria-label="Meu perfil">
              <Avatar url={perfil.avatar_url} nome={perfil.nome} tamanho={34} />
            </Link>
          </div>
        )}
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="menu" aria-label="Menu principal">
        <NavLink to="/" end>
          <span aria-hidden>🏠</span>Início
        </NavLink>
        <NavLink to="/feed">
          <span aria-hidden>💬</span>Feed
        </NavLink>
        <NavLink to="/aprender">
          <span aria-hidden>📚</span>Aprender
        </NavLink>
        <NavLink to="/meu-conselho">
          <span aria-hidden>🤝</span>Conselho
        </NavLink>
        <NavLink to="/perfil">
          <span aria-hidden>👤</span>Perfil
        </NavLink>
        {perfil?.is_admin && (
          <NavLink to="/admin">
            <span aria-hidden>⚙️</span>Admin
          </NavLink>
        )}
      </nav>
    </div>
  )
}
