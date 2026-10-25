import { Link } from 'react-router'
import { CreditCardIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { formatMoney } from '../../lib/money'
import type { AnnotatedEntry } from '../../lib/calculations/ledger'
import { CategoryBadge, CategoryIcon, TransferIcon } from './CategoryIcon'
import {
  effectText,
  movementDetail,
  movementPath,
  movementTitle,
  transferSentence,
} from './describe'

interface MovementRowProps {
  entry: AnnotatedEntry
}

const kindLabel = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  card_payment: 'Pago de tarjeta',
} as const

const toneClasses = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-fg-muted',
} as const

/**
 * Fila del libro: a la derecha el monto real del movimiento (neutro); debajo de la descripción,
 * cuánto sumó o restó al saldo de cada uno. El verde y el rojo solo van en esa línea.
 */
export function MovementRow({ entry }: MovementRowProps) {
  const data = useHousehold()
  const { movement } = entry
  const category =
    movement.kind === 'transfer' || movement.kind === 'card_payment'
      ? null
      : data.categories.find((item) => item.id === movement.categoryId)
  const voided = movement.status === 'voided'
  const effectLine = effectText(movement, data)

  const title =
    movement.kind === 'transfer' && !movement.notes?.trim()
      ? transferSentence(movement, data)
      : movementTitle(movement)
  const detail =
    movement.kind === 'transfer' && movement.notes?.trim()
      ? transferSentence(movement, data)
      : movementDetail(movement, data)

  return (
    <li>
      <Link
        to={movementPath(movement)}
        className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-(--row-y) transition-colors duration-150 hover:bg-surface-2/50"
      >
        {movement.kind === 'expense' ? (
          <CategoryBadge icon={category?.icon} color={category?.color} className="mt-0.5 size-10" />
        ) : (
          <span
            className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full ${
              movement.kind === 'income' ? 'bg-positive-bg text-positive' : 'bg-surface-2 text-fg'
            }`}
          >
            {movement.kind === 'transfer' ? (
              <TransferIcon />
            ) : movement.kind === 'card_payment' ? (
              <CreditCardIcon aria-hidden="true" className="size-5" />
            ) : (
              <CategoryIcon icon={category?.icon} />
            )}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={`line-clamp-2 min-w-0 font-medium break-words ${voided ? 'text-fg-muted line-through' : 'text-fg'}`}
            >
              <span className="sr-only">{kindLabel[movement.kind]}: </span>
              {title}
            </span>
            <span
              className={`shrink-0 tabular font-semibold ${voided ? 'text-fg-muted line-through' : 'text-fg'}`}
            >
              {formatMoney(movement.amount)}
            </span>
          </span>
          {/* data-money: en modo privado la línea se oculta, porque lleva montos dentro. */}
          <span data-money className="text-sm text-fg-muted">
            {detail}
            {category && movement.kind === 'income' ? `, ${category.name}` : ''}
            {movement.kind === 'expense' && movement.extraCategoryIds.length > 0 && (
              <span>
                {` · también ${movement.extraCategoryIds
                  .map((id) => data.categories.find((item) => item.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}`}
              </span>
            )}
            {movement.kind === 'expense' && movement.paidWithCard && (
              <span className="whitespace-nowrap">
                {' · '}
                <CreditCardIcon aria-hidden="true" className="inline size-4 align-[-0.2em]" />{' '}
                tarjeta
              </span>
            )}
          </span>
          <span data-money className={`text-sm font-medium ${toneClasses[effectLine.tone]}`}>
            {effectLine.parts.map((part, index) => (
              <span key={part}>
                {index > 0 && ' · '}
                <span className="whitespace-nowrap">{part}</span>
              </span>
            ))}
          </span>
        </span>
      </Link>
    </li>
  )
}
