import { useHousehold } from '../app/household-context'
import {
  fetchMyAccounts,
  fetchMyCardExpenses,
  fetchMyPayments,
  fetchMyStatements,
} from '../services/debts'
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

/** Pagos hechos a tus tarjetas (pesos y dólares). */
export function useDebtPayments() {
  const { household, userId } = useHousehold()
  return useResource(`debt-payments:${household.id}:${userId}`, () => fetchMyPayments(household.id))
}

/** Gastos hechos con tus tarjetas. */
export function useCardExpenses() {
  const { household, userId } = useHousehold()
  return useResource(`debt-card-expenses:${household.id}:${userId}`, () =>
    fetchMyCardExpenses(household.id),
  )
}
