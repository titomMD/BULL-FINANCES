import { CreditCardIcon } from '@phosphor-icons/react'
import { cardImageFor } from '../../lib/cardImages'

/** Ícono pequeño de la tarjeta (su imagen si la conocemos; si no, un ícono genérico). */
export function CardIcon({ name, className = 'w-14' }: { name: string; className?: string }) {
  const src = cardImageFor(name)
  if (!src)
    return <CreditCardIcon aria-hidden="true" className={`${className} shrink-0 text-primary`} />
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`${className} aspect-[1.586/1] shrink-0 rounded-md object-cover`}
    />
  )
}
