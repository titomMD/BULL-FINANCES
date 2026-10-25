import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session; userId: string; email: string }

export const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/** Solo para componentes dentro de rutas protegidas. */
export function useSignedInUser(): { userId: string; email: string; session: Session } {
  const auth = useAuth()
  if (auth.status !== 'signedIn') throw new Error('useSignedInUser fuera de una ruta protegida')
  return { userId: auth.userId, email: auth.email, session: auth.session }
}
