import { useEffect, useState } from 'react'
import { downloadFile } from '../services/debts'

/**
 * Descarga un archivo privado y lo deja listo para mostrar (la política de seguridad solo deja
 * cargar imágenes locales, por eso se pasa por un enlace temporal «blob:»).
 */
export function useStoredFile(path: string | null) {
  const [state, setState] = useState<{
    path: string | null
    url: string | null
    type: string
    failed: boolean
  }>({ path: null, url: null, type: '', failed: false })

  useEffect(() => {
    if (!path) return
    let cancelled = false
    let created: string | null = null
    downloadFile(path)
      .then((blob) => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setState({ path, url: created, type: blob.type, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ path, url: null, type: '', failed: true })
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [path])

  const current = state.path === path
  return {
    url: path && current ? state.url : null,
    type: path && current ? state.type : '',
    loading: Boolean(path) && !current,
    failed: Boolean(path) && current && state.failed,
  }
}
