import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import Login from './views/Login'
import Register from './views/Register'
import Feed from './views/Dashboard'
import AdminDashboard from './views/AdminDashboard'
import Profile from './views/Profile'
import LandingPage from './views/LandingPage'
import { useAuth } from './state/useAuth'

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return children
}

function Home() {
  const { user } = useAuth()
  if (user) {
    return <Feed />
  }
  return <LandingPage />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'admin', element: <Protected><AdminRoute><AdminDashboard /></AdminRoute></Protected> },
      { path: 'profile', element: <Protected><Profile /></Protected> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ]
  }
])
