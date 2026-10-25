import { useEffect, useMemo, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { invalidateData, useResource } from '../hooks/useResource'
import { toUserMessage } from '../lib/errors'
import { fetchCategories, fetchMyHousehold } from '../services/household'
import { fetchAllMovements } from '../services/movements'
import { ErrorState, FullScreenLoader } from '../components/ui/States'
import { useSignedInUser } from './auth-context'
import { HouseholdContext, type HouseholdData } from './household-context'

const REFRESH_ON_FOCUS_AFTER_MS = 20_000

/**
 * Carga el household activo con sus miembros, categorías y movimientos. Sin household lleva a
 * /bienvenida. Al volver a la pestaña recarga, para ver lo que registró la otra persona.
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { userId } = useSignedInUser()

  const householdResource = useResource(`household:${userId}`, () => fetchMyHousehold(userId))
  const householdId = householdResource.data?.household.id ?? null

  const categoriesResource = useResource(householdId && `categories:${householdId}`, () =>
    fetchCategories(householdId!),
  )
  const movementsResource = useResource(householdId && `movements:${householdId}`, () =>
    fetchAllMovements(householdId!),
  )

  useEffect(() => {
    let lastRefresh = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefresh < REFRESH_ON_FOCUS_AFTER_MS) return
      lastRefresh = Date.now()
      invalidateData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const value = useMemo<HouseholdData | null>(() => {
    const householdData = householdResource.data
    if (!householdData || !categoriesResource.data || !movementsResource.data) return null
    const me = householdData.members.find((member) => member.userId === userId)
    if (!me) return null
    return {
      userId,
      household: householdData.household,
      members: householdData.members,
      me,
      categories: categoriesResource.data,
      movements: movementsResource.data,
      refreshing: movementsResource.refreshing,
    }
  }, [householdResource.data, categoriesResource.data, movementsResource, userId])

  const error = householdResource.error ?? categoriesResource.error ?? movementsResource.error

  if (householdResource.data === null) return <Navigate to="/bienvenida" replace />

  if (!value) {
    if (error)
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <ErrorState
            message={toUserMessage(error, 'No pudimos cargar tu hogar.')}
            onRetry={invalidateData}
          />
        </div>
      )
    return <FullScreenLoader label="Abriendo tu hogar" />
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
