import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenLoader } from '../components/ui/States'
import { useAuth } from './auth-context'

/** Protección de rutas (spec §4.1): sin sesión, a /entrar recordando a dónde iba. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <FullScreenLoader />
  if (auth.status === 'signedOut')
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login: si ya hay sesión, directo a la app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <FullScreenLoader />
  if (auth.status === 'signedIn') return <Navigate to="/" replace />
  return children
}
