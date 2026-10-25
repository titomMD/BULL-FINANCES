import { useHousehold } from '../app/household-context'
import { fetchMyAccounts, fetchMyStatements } from '../services/debts'
import { useResource } from './useResource'

/** Tus tarjetas / deudas (privado por RLS). */
export function useDebtAccounts() {
  const { household, userId } = useHousehold()
  return useResource(`debt-accounts:${household.id}:${userId}`, () => fetchMyAccounts(household.id))
}

/** Los extractos de todas tus tarjetas. */
export function useDebtStatements() {
  const { household, userId } = useHousehold()
  return useResource(`debt-statements:${household.id}:${userId}`, () =>
    fetchMyStatements(household.id),
  )
}
