import { CheckIcon, TagIcon } from '@phosphor-icons/react'
import type { Budget } from '../../types/domain'
import { periodLabel } from '../budgets/budgetLabels'

interface BudgetPickerProps {
  budgets: Budget[]
  value: string[]
  onChange: (budgetIds: string[]) => void
}

/** "Mis presupuestos": en cuáles de tus presupuestos libres cuenta este gasto (solo tú lo ves). */
export function BudgetPicker({ budgets, value, onChange }: BudgetPickerProps) {
  if (budgets.length === 0) return null
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-0.5 text-sm font-medium">Mis presupuestos</legend>
      <p className="mb-1 text-sm text-fg-muted">
        Cuenta tu parte en los que marques. Solo tú lo ves.
      </p>
      <div className="flex flex-wrap gap-2">
        {budgets.map((budget) => {
          const checked = value.includes(budget.id)
          return (
            <label
              key={budget.id}
              className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                checked
                  ? 'bg-fg font-semibold text-canvas'
                  : 'bg-surface-2 font-medium text-fg-muted hover:text-fg'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(budget.id)}
                className="sr-only"
              />
              {checked ? (
                <CheckIcon aria-hidden="true" className="size-4" weight="bold" />
              ) : (
                <TagIcon aria-hidden="true" className="size-4" />
              )}
              {budget.name}
              <span className="font-normal opacity-80">({periodLabel[budget.period]})</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
