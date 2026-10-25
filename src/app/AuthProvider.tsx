import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { applyAppearance } from '../lib/appearance'
import { supabase } from '../lib/supabase/client'
import { setPreferences } from '../lib/preferences'
import { fetchAppearance, fetchPreferences } from '../services/household'
import { AuthContext, type AuthState } from './auth-context'

function toState(session: Session | null): AuthState {
  if (!session) return { status: 'signedOut' }
  return {
    status: 'signedIn',
    session,
    userId: session.user.id,
    email: session.user.email ?? '',
  }
}

/**
 * Al volver de Google, Supabase deja la sesión en la URL (#access_token=…&refresh_token=…). El cliente
 * tiene detectSessionInUrl desactivado (el enlace de recuperar contraseña lo lee /restablecer), así
 * que aquí se toma solo en las demás rutas y se limpia la URL para que los tokens no queden en el
 * historial. Un intento por carga de página (StrictMode monta dos veces en desarrollo).
 */
let oauthRedirect: Promise<void> | null = null
function consumeOAuthRedirect(): Promise<void> {
  oauthRedirect ??= (async () => {
    if (window.location.pathname === '/restablecer') return
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const failed = hash.get('error') || new URLSearchParams(window.location.search).get('error')
    if (!(accessToken && refreshToken && hash.get('type') !== 'recovery') && !failed) return
    window.history.replaceState(null, '', window.location.pathname)
    if (accessToken && refreshToken) {
      try {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      } catch {
        // Sin sesión: la persona queda en /entrar y puede intentarlo de nuevo.
      }
    }
  })()
  return oauthRedirect
}

// Sesión persistente (spec §4.1): Supabase la guarda en el navegador y renueva el token solo.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    consumeOAuthRedirect()
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        if (active) setState(toState(data.session))
      })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Mantener el mismo objeto si solo se renovó el token evita recargar toda la app.
      setState((previous) =>
        previous.status === 'signedIn' && session && previous.userId === session.user.id
          ? { ...previous, session }
          : toState(session),
      )
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  // La apariencia es de la cuenta: se trae al iniciar sesión (sirve entre celular y computador).
  const userId = state.status === 'signedIn' ? state.userId : null
  useEffect(() => {
    if (!userId) return
    let active = true
    fetchAppearance(userId)
      .then((appearance) => {
        if (active) applyAppearance(appearance)
      })
      .catch(() => {
        // Sin conexión: se queda la apariencia guardada en este navegador.
      })
    fetchPreferences(userId)
      .then((preferences) => {
        if (active) setPreferences(preferences)
      })
      .catch(() => {
        // Sin conexión: se quedan las preferencias guardadas en este navegador.
      })
    return () => {
      active = false
    }
  }, [userId])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
