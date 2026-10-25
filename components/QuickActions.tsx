import { ArrowsLeftRightIcon, PlusIcon } from '@phosphor-icons/react'
import { Link } from 'react-router'

// Acciones rápidas (spec §17 / §36): + Gasto / + Ingreso / + Transferencia, siempre a mano.
// Gasto es la acción principal (amarillo); las otras dos, secundarias.

const actions = [
  { to: '/gastos/nuevo', label: 'Gasto', primary: true },
  { to: '/ingresos/nuevo', label: 'Ingreso', primary: false },
  { to: '/transferencias/nueva', label: 'Transferencia', primary: false },
] as const

export function QuickActions({ layout }: { layout: 'row' | 'stack' }) {
  return (
    <nav
      aria-label="Registrar"
      className={
        // Con texto grande la fila no cabe: por debajo de 20rem el icono pasa arriba de la
        // etiqueta (consulta de contenedor en rem, así sigue al tamaño de texto elegido).
        layout === 'row'
          ? '@container grid grid-cols-[1.15fr_1fr_1.3fr] gap-2'
          : 'flex flex-col gap-2'
      }
    >
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className={`flex h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-[background-color,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${
            layout === 'row'
              ? 'justify-center @max-[20rem]:h-14 @max-[20rem]:flex-col @max-[20rem]:gap-0.5 @max-[20rem]:px-1 @max-[20rem]:text-xs'
              : 'justify-start px-4'
          } ${
            action.primary
              ? 'bg-primary text-on-primary hover:bg-primary-soft'
              : 'bg-surface-2 text-fg hover:bg-line-strong'
          }`}
        >
          {action.to.startsWith('/transferencias') ? (
            <ArrowsLeftRightIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
          ) : (
            <PlusIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
          )}
          <span className="truncate">{action.label}</span>
        </Link>
      ))}
    </nav>
  )
}
