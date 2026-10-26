import { useHousehold } from '../app/household-context'
import { useSignedInUser } from '../app/auth-context'
import {
  fetchMyPocketMoves,
  fetchMyPockets,
  fetchMyReceivableEntries,
  fetchMyReceivableRules,
  fetchPocketsEnabled,
} from '../services/pockets'
import { useResource } from './useResource'

/** Tus bolsillos (privado por RLS). */
export function usePockets() {
  const { household, userId } = useHousehold()
  return useResource(`pockets:${household.id}:${userId}`, () => fetchMyPockets(household.id))
}

/** Los movimientos de todos tus bolsillos. */
export function usePocketMoves() {
  const { household, userId } = useHousehold()
  return useResource(`pocket-moves:${household.id}:${userId}`, () =>
    fetchMyPocketMoves(household.id),
  )
}

/** Cobros y pagos de la cuenta con mamá. */
export function useReceivableEntries() {
  const { household, userId } = useHousehold()
  return useResource(`receivable-entries:${household.id}:${userId}`, () =>
    fetchMyReceivableEntries(household.id),
  )
}

/** Cobros que se repiten. */
export function useReceivableRules() {
  const { household, userId } = useHousehold()
  return useResource(`receivable-rules:${household.id}:${userId}`, () =>
    fetchMyReceivableRules(household.id),
  )
}

/** ¿Tiene esta cuenta los bolsillos activados? `loading` mientras se averigua. */
export function usePocketsEnabled() {
  const { userId } = useSignedInUser()
  const resource = useResource(`pockets-enabled:${userId}`, () => fetchPocketsEnabled(userId))
  return { enabled: resource.data === true, loading: resource.loading }
}
