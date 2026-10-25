import { useHousehold } from '../app/household-context'
import { fetchRecurring } from '../services/recurring'
import { useResource } from './useResource'

export function useRecurring() {
  const { household } = useHousehold()
  return useResource(`recurring:${household.id}`, () => fetchRecurring(household.id))
}
