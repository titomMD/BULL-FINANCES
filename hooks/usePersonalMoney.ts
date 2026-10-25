import { useHousehold } from '../app/household-context'
import { fetchMyPersonalMovements } from '../services/personal'
import { useResource } from './useResource'

/** Tu dinero personal (privado: RLS solo devuelve lo de quien está conectado). */
export function usePersonalMoney() {
  const { household, userId } = useHousehold()
  return useResource(`personal:${household.id}:${userId}`, () =>
    fetchMyPersonalMovements(household.id),
  )
}
