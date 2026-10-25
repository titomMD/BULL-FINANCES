import type { PersonColorId } from '../../lib/appearance'
import { initialOf } from '../../lib/people'
import { personBg } from './personClasses'

/** Círculo con la inicial en el color de la persona (el nombre va siempre al lado). */
export function PersonAvatar({
  name,
  color,
  size = 'md',
}: {
  name: string
  color: PersonColorId
  size?: 'sm' | 'md'
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-on-swatch ${personBg[color]} ${
        size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm'
      }`}
    >
      {initialOf(name)}
    </span>
  )
}
