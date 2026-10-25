// Plan del mes (pedido del usuario, 2026-10-25): lo que entra, lo fijo que sale y lo que se ahorra.
//   Dinero mío = ingresos − gastos fijos − ahorro
// El ahorro es una transferencia a otro bolsillo, no un gasto, pero igual se aparta antes de gastar.
// Lo que sobra es el dinero de gasto libre del mes. Un mes se escribe 'YYYY-MM' (zona Bogotá: las
// fechas ya vienen como día 'YYYY-MM-DD', sin instantes). Solo enteros: COP no tiene decimales.

import type { PlanItem } from '../../types/domain'

export type Month = string // 'YYYY-MM'

export const monthOf = (day: string): Month => day.slice(0, 7)

/** Mes siguiente (delta = 1) o anterior (delta = -1). */
export function shiftMonth(month: Month, delta: number): Month {
  const [year, number] = month.split('-').map(Number)
  const total = year * 12 + (number - 1) + delta
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
}

/** Meses completos de a a b, ambos incluidos (a ≤ b). */
export function monthsInclusive(a: Month, b: Month): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma) + 1
}

/** ¿La línea cuenta en este mes? Sin fechas, siempre; con fechas, entre su primer y último mes. */
export function isActiveInMonth(item: PlanItem, month: Month): boolean {
  if (item.startsOn && monthOf(item.startsOn) > month) return false
  if (item.endsOn && monthOf(item.endsOn) < month) return false
  return true
}

export interface Installment {
  /** Cuota de este mes (1 = la primera). */
  current: number
  total: number
  /** Valor de todas las cuotas juntas (cuota × total). */
  totalAmount: number
}

/** Solo las líneas con primer y último mes son "en cuotas" (p. ej. el fondo semestral). */
export function installmentOf(item: PlanItem, month: Month): Installment | null {
  if (!item.startsOn || !item.endsOn) return null
  const total = monthsInclusive(monthOf(item.startsOn), monthOf(item.endsOn))
  const current = monthsInclusive(monthOf(item.startsOn), month)
  if (current < 1 || current > total) return null
  return { current, total, totalAmount: item.amount * total }
}

const byOrder = (a: PlanItem, b: PlanItem) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es')

export interface PlanGroup {
  /** Null = gasto suelto (sin grupo). */
  name: string | null
  total: number
  items: PlanItem[]
}

export interface PlanSummary {
  month: Month
  incomes: PlanItem[]
  expenseGroups: PlanGroup[]
  savings: PlanItem[]
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  /** "Dinero mío": lo que sobra para gastar libremente. Negativo = el plan no alcanza. */
  free: number
}

const sum = (items: PlanItem[]) => items.reduce((total, item) => total + item.amount, 0)

export function planSummary(items: PlanItem[], month: Month): PlanSummary {
  const active = items.filter((item) => isActiveInMonth(item, month)).sort(byOrder)
  const incomes = active.filter((item) => item.kind === 'income')
  const expenses = active.filter((item) => item.kind === 'expense')
  const savings = active.filter((item) => item.kind === 'saving')

  const expenseGroups: PlanGroup[] = []
  const byName = new Map<string, PlanGroup>()
  for (const expense of expenses) {
    if (!expense.groupName) {
      expenseGroups.push({ name: null, total: expense.amount, items: [expense] })
      continue
    }
    let group = byName.get(expense.groupName)
    if (!group) {
      group = { name: expense.groupName, total: 0, items: [] }
      byName.set(expense.groupName, group)
      expenseGroups.push(group)
    }
    group.items.push(expense)
    group.total += expense.amount
  }

  const totalIncome = sum(incomes)
  const totalExpenses = sum(expenses)
  const totalSavings = sum(savings)
  return {
    month,
    incomes,
    expenseGroups,
    savings,
    totalIncome,
    totalExpenses,
    totalSavings,
    free: totalIncome - totalExpenses - totalSavings,
  }
}

/**
 * Lo que te queda de "Dinero mío" a mitad de mes: lo que el plan deja libre, menos lo que ya
 * gastaste de tu dinero personal este mes, más lo que te entró aparte.
 */
export function freeLeft(
  free: number,
  personalMonth: { periodIncomes: number; periodExpenses: number },
): number {
  return free + personalMonth.periodIncomes - personalMonth.periodExpenses
}
