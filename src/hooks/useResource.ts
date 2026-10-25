import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Carga de datos mínima, sin dependencias: cada recurso se identifica por una clave y se vuelve
// a pedir cuando cambia la clave o cuando una escritura llama a invalidateData().

let dataVersion = 0
const listeners = new Set<() => void>()

/** Marca todos los datos como desactualizados (tras guardar, anular, volver a la pestaña...). */
export function invalidateData(): void {
  dataVersion += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getVersion = () => dataVersion

export interface Resource<T> {
  data: T | undefined
  error: unknown
  /** Primera carga para esta clave (no hay datos que mostrar todavía). */
  loading: boolean
  /** Recargando con datos previos visibles. */
  refreshing: boolean
}

interface State<T> {
  baseKey: string | null
  requestKey: string | null
  data?: T
  error?: unknown
}

export function useResource<T>(key: string | null, load: () => Promise<T>): Resource<T> {
  const version = useSyncExternalStore(subscribe, getVersion)
  const requestKey = key === null ? null : `${key}#${version}`
  const [state, setState] = useState<State<T>>({ baseKey: null, requestKey: null })

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null || requestKey === null) return
    let cancelled = false
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ baseKey: key, requestKey, data })
      },
      (error: unknown) => {
        if (!cancelled)
          setState((previous) => ({
            baseKey: key,
            requestKey,
            data: previous.baseKey === key ? previous.data : undefined,
            error,
          }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, requestKey])

  const sameKey = state.baseKey === key && key !== null
  const data = sameKey ? state.data : undefined
  const fresh = state.requestKey === requestKey
  return {
    data,
    error: fresh ? state.error : undefined,
    loading: key !== null && !fresh && data === undefined,
    refreshing: !fresh && data !== undefined,
  }
}
