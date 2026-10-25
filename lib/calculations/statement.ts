// Extracto de un periodo (Reportes → Extracto): lo que se gastó por categoría y por persona, con
// el detalle de cada movimiento. TypeScript puro y determinista; solo cuentan los activos.
//
// A diferencia de expensesByCategory, aquí cada gasto cuenta UNA vez, en su categoría principal,
// para que el documento cuadre: la suma de las categorías es el total gastado y la suma de las
// partes de cada persona es su parte de los gastos. Las categorías adicionales se mencionan en el
// detalle. Las transferencias nunca son gasto (spec §16).

import type { Expense, Income, Movement, Transfer } from '../../types/domain'
import { householdRemaining } from './remaining'
import { inRange, summarizePeriod, type DateRange, type PersonSummary } from './reports'

export interface StatementCategory {
  categoryId: string
  total: number
  /** Proporción del total gastado en puntos básicos (se redondea cada una por separado). */
  shareBp: number
  count: number
  /** Parte de cada persona en los gastos de esta categoría. */
  byPerson: Record<string, number>
  /** Gastos de la categoría, del más antiguo al más reciente. */
  expenses: Expense[]
}

export interface Statement {
  range: DateRange
  totals: {
    incomes: number
    expenses: number
    cardExpenses: number
    transfers: number
    expenseCount: number
    /** incomes − expenses (suma de lo que le queda a cada uno). */
    left: number
  }
  people: PersonSummary[]
  /** De mayor a menor gasto. */
  categories: StatementCategory[]
  incomes: Income[]
  transfers: Transfer[]
}

const byDate = <T extends { date: string; id: string }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0

export function buildStatement(
  movements: ReadonlyArray<Movement>,
  memberIds: ReadonlyArray<string>,
  range: DateRange,
): Statement {
  const summary = summarizePeriod(movements, memberIds, range)
  const active = movements
    .filter((movement) => movement.status === 'active' && inRange(movement.date, range))
    .slice()
    .sort(byDate)

  const categories = new Map<string, StatementCategory>()
  const incomes: Income[] = []
  const transfers: Transfer[] = []
  for (const movement of active) {
    if (movement.kind === 'income') incomes.push(movement)
    else if (movement.kind === 'transfer') transfers.push(movement)
    else if (movement.kind === 'expense') {
      let category = categories.get(movement.categoryId)
      if (!category) {
        category = {
          categoryId: movement.categoryId,
          total: 0,
          shareBp: 0,
          count: 0,
          byPerson: Object.fromEntries(memberIds.map((id) => [id, 0])),
          expenses: [],
        }
        categories.set(movement.categoryId, category)
      }
      category.total += movement.amount
      category.count += 1
      category.expenses.push(movement)
      for (const split of movement.splits)
        category.byPerson[split.userId] = (category.byPerson[split.userId] ?? 0) + split.amount
    }
  }

  const total = summary.totalExpenses
  const sorted = [...categories.values()].sort(
    (a, b) => b.total - a.total || (a.categoryId < b.categoryId ? -1 : 1),
  )
  for (const category of sorted)
    category.shareBp = total > 0 ? Math.round((category.total * 10000) / total) : 0

  return {
    range,
    totals: {
      incomes: summary.totalIncomes,
      expenses: total,
      cardExpenses: summary.cardExpenses,
      transfers: summary.totalTransfers,
      expenseCount: summary.expenseCount,
      left: householdRemaining(summary),
    },
    people: summary.people,
    categories: sorted,
    incomes,
    transfers,
  }
}
