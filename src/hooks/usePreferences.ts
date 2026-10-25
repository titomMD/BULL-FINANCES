import { useCallback, useSyncExternalStore } from 'react'
import { useSignedInUser } from '../app/auth-context'
import { toUserMessage } from '../lib/errors'
import {
  getPreferences,
  setPreferences,
  subscribePreferences,
  type Preferences,
} from '../lib/preferences'
import { updatePreferences } from '../services/household'
import { useToast } from '../components/ui/toast-context'

/**
 * Preferencias de la cuenta (gráfica de Reportes, alertas). `update` aplica al instante y guarda
 * en la cuenta; si falla, vuelve al valor anterior y avisa.
 */
export function usePreferences() {
  const preferences = useSyncExternalStore(subscribePreferences, getPreferences)
  const { userId } = useSignedInUser()
  const toast = useToast()

  const update = useCallback(
    async (changes: Partial<Preferences>) => {
      const previous = getPreferences()
      setPreferences({ ...previous, ...changes })
      try {
        await updatePreferences(userId, changes)
      } catch (error) {
        setPreferences(previous)
        toast.show(
          toUserMessage(error, 'No pudimos guardar el cambio. Inténtalo de nuevo.'),
          'error',
        )
      }
    },
    [userId, toast],
  )

  return [preferences, update] as const
}
