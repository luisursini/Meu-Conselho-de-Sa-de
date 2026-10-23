import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { Carregando } from './components/ui'
import { Login } from './pages/Login'
import { Cadastro } from './pages/Cadastro'
import { Inicio } from './pages/Inicio'
import { DetalheTrilha, ListaTrilhas } from './pages/Aprender'
import { Aula } from './pages/Aula'
import { Questionario } from './pages/Questionario'
import { Salvos } from './pages/Salvos'
import { Perfil } from './pages/Perfil'
import { Conselho, MeuConselho } from './pages/Conselho'
import { AdminLayout, AdminTrilhas } from './pages/admin/Admin'
import { AdminTrilha } from './pages/admin/AdminTrilha'
import { AdminCurso } from './pages/admin/AdminCurso'
import { AdminConselhos } from './pages/admin/AdminConselhos'

function Rotas() {
  const { sessao, perfil, carregando } = useAuth()

  if (carregando || (sessao && !perfil)) return <Carregando />
  if (!sessao) return <Login />
  // Primeiro acesso: completar o perfil antes de usar o app.
  if (!perfil!.segmento || !perfil!.municipio_id) return <Cadastro />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="aprender" element={<ListaTrilhas />} />
        <Route path="aprender/salvos" element={<Salvos />} />
        <Route path="aprender/:trilhaId" element={<DetalheTrilha />} />
        <Route path="aula/:aulaId" element={<Aula />} />
        <Route path="questionario/:cursoId" element={<Questionario />} />
        <Route path="meu-conselho" element={<MeuConselho />} />
        <Route path="conselhos/:conselhoId" element={<Conselho />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="perfil/editar" element={<Cadastro edicao />} />
        <Route path="pessoas/:pessoaId" element={<Perfil />} />
        {perfil!.is_admin && (
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminTrilhas />} />
            <Route path="trilhas/:trilhaId" element={<AdminTrilha />} />
            <Route path="cursos/:cursoId" element={<AdminCurso />} />
            <Route path="conselhos" element={<AdminConselhos />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
