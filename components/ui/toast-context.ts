import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Botones del aviso (p. ej. "Deshacer"); con acciones el aviso dura más. */
  actions?: ToastAction[]
}

export interface ToastApi {
  show: (message: string, tone?: ToastTone, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}
