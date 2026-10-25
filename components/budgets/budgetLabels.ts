import { useHousehold } from '../../app/household-context'
import type { Budget } from '../../types/domain'

export const periodLabel = { month: 'al mes', week: 'a la semana' } as const
export const kindLabel = { category: 'Por categoría', total: 'Tope total', free: 'Libre' } as const

/** Nombre visible: el de la categoría si el presupuesto es por categoría y no tiene otro. */
export function useBudgetName() {
  const data = useHousehold()
  return (budget: Budget) =>
    budget.name.trim() ||
    data.categories.find((category) => category.id === budget.categoryId)?.name ||
    'Presupuesto'
}
