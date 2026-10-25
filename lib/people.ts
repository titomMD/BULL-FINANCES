import { personColors, type PersonColorId } from './appearance'

interface PersonLike {
  userId: string
  personColor: PersonColorId | null
}

/**
 * Color efectivo de cada miembro: el que eligió o, si no eligió, el primero de la paleta que no
 * use nadie más (en el orden de llegada al hogar). Así dos personas nunca comparten color.
 */
export function resolvePersonColors(
  members: ReadonlyArray<PersonLike>,
): Record<string, PersonColorId> {
  const taken = new Set(members.map((member) => member.personColor).filter(Boolean))
  const free = personColors.map((color) => color.id).filter((id) => !taken.has(id))
  const result: Record<string, PersonColorId> = {}
  let next = 0
  for (const member of members) {
    if (member.personColor) result[member.userId] = member.personColor
    else result[member.userId] = free[next++ % Math.max(free.length, 1)] ?? personColors[0].id
  }
  return result
}

/** Inicial para el avatar ("Sebastián" → "S"; vacío → "?"). */
export function initialOf(name: string): string {
  const letter = name.trim().charAt(0)
  return letter ? letter.toLocaleUpperCase('es') : '?'
}
