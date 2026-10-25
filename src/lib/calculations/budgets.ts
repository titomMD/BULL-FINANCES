// Presupuestos personales (pedido del usuario, 2026-10-13). TypeScript puro y determinista.
// Cuenta la PARTE de quien mira en los gastos activos del periodo (mes o semana de lunes a
// domingo, en fechas de Bogotá), con tarjeta o sin ella: un gasto es gasto aunque se pague después.

import type { Budget, BudgetPeriod, Expense, Movement } from '../../types/domain'
import { addDays, endOfMonth, startOfMonth, startOfWeek } from '../dates'
import { expenseCategoryIds, inRange, type DateRange } from './reports'

/** Periodo vigente de un presupuesto que contiene `day`. */
export function budgetRange(period: BudgetPeriod, day: string): DateRange {
  if (period === 'month') return { from: startOfMonth(day), to: endOfMonth(day) }
  const from = startOfWeek(day)
  return { from, to: addDays(from, 6) }
}

/** ¿Este gasto cuenta en el presupuesto? (sin mirar fecha ni estado). */
export function budgetIncludes(budget: Budget, expense: Expense): boolean {
  switch (budget.kind) {
    case 'total':
      return true
    case 'category':
      return budget.categoryId !== null && expenseCategoryIds(expense).includes(budget.categoryId)
    case 'free':
      return budget.expenseIds.includes(expense.id)
  }
}

/** Lo que tu parte de un gasto aporta a un presupuesto. */
export const myShare = (expense: Expense, userId: string) =>
  expense.splits.find((split) => split.userId === userId)?.amount ?? 0

export interface BudgetProgress {
  budget: Budget
  range: DateRange
  /** Tu parte de los gastos que cuentan en el periodo. */
  spent: number
  /** amount − spent; negativo = te pasaste. */
  left: number
  /** spent / amount (solo para mostrar: barra y porcentaje). */
  ratio: number
  /** Gastos que cuentan (activos, del periodo y con parte tuya), del más reciente al más antiguo. */
  expenses: Expense[]
}

export function budgetProgress(
  budget: Budget,
  movements: ReadonlyArray<Movement>,
  userId: string,
  day: string,
): BudgetProgress {
  const range = budgetRange(budget.period, day)
  const expenses: Expense[] = []
  let spent = 0
  for (const movement of movements) {
    if (movement.kind !== 'expense' || movement.status !== 'active') continue
    if (!inRange(movement.date, range) || !budgetIncludes(budget, movement)) continue
    const mine = myShare(movement, userId)
    if (mine === 0) continue
    spent += mine
    expenses.push(movement)
  }
  return {
    budget,
    range,
    spent,
    left: budget.amount - spent,
    ratio: spent / budget.amount,
    expenses,
  }
}
