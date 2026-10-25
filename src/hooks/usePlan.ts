import { useHousehold } from '../app/household-context'
import { fetchMyChecks, fetchMyEntries, fetchMyPlan } from '../services/plan'
import { useResource } from './useResource'

/** Tu plan del mes (privado: RLS solo devuelve lo de quien está conectado). */
export function usePlan() {
  const { household, userId } = useHousehold()
  return useResource(`plan:${household.id}:${userId}`, () => fetchMyPlan(household.id))
}

/** Líneas del plan marcadas como pagadas. */
export function usePlanChecks() {
  const { household, userId } = useHousehold()
  return useResource(`plan-checks:${household.id}:${userId}`, () => fetchMyChecks(household.id))
}

/** Tanqueadas y otros gastos registrados contra líneas del plan. */
export function usePlanEntries() {
  const { household, userId } = useHousehold()
  return useResource(`plan-entries:${household.id}:${userId}`, () => fetchMyEntries(household.id))
}
