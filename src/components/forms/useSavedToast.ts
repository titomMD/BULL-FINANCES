import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { useToast } from '../ui/toast-context'

interface SavedOptions {
  /** "Gasto guardado". */
  message: string
  /** Anula lo recién creado (soft-delete: queda en el historial como anulado). */
  undo: () => Promise<void>
  /** "Gasto anulado". */
  undoneMessage: string
  /** Formulario vacío para registrar otro. */
  againPath: string
}

/** Aviso tras crear un movimiento, con "Deshacer" y "Registrar otro". */
export function useSavedToast() {
  const toast = useToast()
  const navigate = useNavigate()
  return useCallback(
    ({ message, undo, undoneMessage, againPath }: SavedOptions) => {
      toast.show(message, 'success', {
        actions: [
          {
            label: 'Deshacer',
            onClick: async () => {
              try {
                await undo()
                invalidateData()
                toast.show(undoneMessage)
              } catch (error) {
                toast.show(
                  toUserMessage(error, 'No pudimos deshacerlo. Anúlalo desde el historial.'),
                  'error',
                )
              }
            },
          },
          { label: 'Registrar otro', onClick: () => navigate(againPath) },
        ],
      })
    },
    [toast, navigate],
  )
}
