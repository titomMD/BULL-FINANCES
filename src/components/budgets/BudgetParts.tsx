import { TagIcon, TargetIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import type { BudgetProgress } from '../../lib/calculations/budgets'
import { formatMoney } from '../../lib/money'
import type { Budget } from '../../types/domain'
import { CategoryBadge } from '../movements/CategoryIcon'

export function BudgetIcon({ budget }: { budget: Budget }) {
  const data = useHousehold()
  if (budget.kind === 'category') {
    const category = data.categories.find((item) => item.id === budget.categoryId)
    return <CategoryBadge icon={category?.icon} color={category?.color} />
  }
  const Icon = budget.kind === 'total' ? TargetIcon : TagIcon
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  )
}

/**
 * Barra de lo gastado sobre el presupuesto. Verde mientras va bien, amarillo desde el 80 % y
 * rojo al pasarse; el texto de al lado siempre dice lo mismo (el color nunca va solo).
 */
export function BudgetBar({ progress }: { progress: BudgetProgress }) {
  const { ratio } = progress
  const tone = ratio > 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-primary' : 'bg-positive'
  return (
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${Math.min(1, ratio) * 100}%` }}
      />
    </div>
  )
}

/** "Te quedan $X de $Y" o "Te pasaste por $X". */
export function BudgetStatus({ progress }: { progress: BudgetProgress }) {
  if (progress.left < 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-negative">
        <WarningCircleIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
        Te pasaste por <span className="tabular">{formatMoney(-progress.left)}</span>
      </span>
    )
  return (
    <span className="text-sm text-fg-muted">
      Te quedan <span className="tabular font-semibold text-fg">{formatMoney(progress.left)}</span>{' '}
      de <span className="tabular">{formatMoney(progress.budget.amount)}</span>
    </span>
  )
}
