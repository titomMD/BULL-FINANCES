import { useHousehold } from '../app/household-context'
import { fetchMyPlan } from '../services/plan'
import { useResource } from './useResource'

/** Tu plan del mes (privado: RLS solo devuelve lo de quien está conectado). */
export function usePlan() {
  const { household, userId } = useHousehold()
  return useResource(`plan:${household.id}:${userId}`, () => fetchMyPlan(household.id))
}
