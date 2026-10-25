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

// Sesión persistente (spec §4.1): Supabase la guarda en el navegador y renueva el token solo.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
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
