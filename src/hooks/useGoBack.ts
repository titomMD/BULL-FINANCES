import { useCallback } from 'react'
import { useNavigate } from 'react-router'

/** Vuelve a la pantalla anterior de la app, o a `fallback` si se entró directo por URL. */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
