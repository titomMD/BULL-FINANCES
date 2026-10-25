import { useHousehold } from '../app/household-context'
import { fetchMyBudgets } from '../services/budgets'
import { useResource } from './useResource'

/** Tus presupuestos (privados: RLS solo devuelve los de quien está conectado). */
export function useBudgets() {
  const { household, userId } = useHousehold()
  return useResource(`budgets:${household.id}:${userId}`, () => fetchMyBudgets(household.id))
}
