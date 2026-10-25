import { CreditCardIcon } from '@phosphor-icons/react'

// Ilustración propia de tarjeta (sin logos ni diseños de ningún banco). Se usa cuando no subiste
// la foto de tu tarjeta; el color cambia según el nombre para distinguirlas de un vistazo.

type Look = { surface: string; text: string; accent: string }

const LOOKS: Look[] = [
  { surface: 'bg-primary', text: 'text-on-primary', accent: 'bg-on-primary/25' },
  { surface: 'bg-surface-2 border border-line-strong', text: 'text-fg', accent: 'bg-primary/40' },
  {
    surface: 'bg-positive-bg border border-positive/40',
    text: 'text-fg',
    accent: 'bg-positive/40',
  },
]

function lookFor(name: string): Look {
  const text = name.toLowerCase()
  if (/empresa|negocio|business/.test(text)) return LOOKS[1]
  if (/j[óo]ven|joven|young/.test(text)) return LOOKS[2]
  if (/lifemiles|avianca|miles|millas/.test(text)) return LOOKS[0]
  let sum = 0
  for (const char of text) sum += char.charCodeAt(0)
  return LOOKS[sum % LOOKS.length]
}

export function CardArt({
  name,
  last4,
  className = '',
}: {
  name: string
  last4: string | null
  className?: string
}) {
  const look = lookFor(name)
  return (
    <div
      role="img"
      aria-label={`Tarjeta ${name}${last4 ? ` terminada en ${last4}` : ''}`}
      className={`relative flex aspect-[1.586/1] w-full max-w-72 flex-col justify-between overflow-hidden rounded-2xl p-4 ${look.surface} ${look.text} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-8 -right-8 size-32 rounded-full ${look.accent}`}
      />
      <CreditCardIcon aria-hidden="true" className="relative size-7" />
      <div className="relative flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        {last4 && <span className="tabular text-sm">•••• {last4}</span>}
      </div>
    </div>
  )
}
