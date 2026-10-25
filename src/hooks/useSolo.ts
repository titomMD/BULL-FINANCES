import { useHousehold } from '../app/household-context'

/** Hogar de una sola persona: no hay nada que compartir, así que el saldo es tu dinero personal. */
export function useSolo(): boolean {
  const { members } = useHousehold()
  return members.filter((member) => member.active).length <= 1
}
