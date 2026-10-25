// Series de las vistas del panel de análisis de Reportes. TypeScript puro y determinista.
// Todas usan los mismos movimientos y el mismo periodo del filtro de Reportes; solo cuentan los
// activos. Las transferencias nunca son gasto (spec §16): solo mueven el restante.

import type { Movement } from '../../types/domain'
import { addDays, addMonths, daysInMonth, endOfMonth, parseDay, startOfMonth } from '../dates'
import { expensesByCategory, inRange, type DateRange } from './reports'

const active = (movements: ReadonlyArray<Movement>, range: DateRange) =>
  movements.filter((movement) => movement.status === 'active' && inRange(movement.date, range))

/** Meses que muestran las vistas mensuales: al menos 6, terminando en el mes de range.to. */
export function chartMonths(range: DateRange, minimum = 6): string[] {
  const last = startOfMonth(range.to)
  const earliest = addMonths(last, -(minimum - 1))
  const first = startOfMonth(range.from) < earliest ? startOfMonth(range.from) : earliest
  const months: string[] = []
  for (let month = first; month <= last; month = addMonths(month, 1)) months.push(month)
  return months
}

export interface IncomeExpenseMonth {
  /** Primer día del mes. */
  month: string
  incomes: number
  expenses: number
  /** incomes − expenses. */
  left: number
}

/** Vista 1: ingresos y gastos del hogar por mes, con lo que quedó. */
export function incomeVsExpenseByMonth(
  movements: ReadonlyArray<Movement>,
  range: DateRange,
): IncomeExpenseMonth[] {
  const months = chartMonths(range)
  const rows = new Map(months.map((month) => [month, { month, incomes: 0, expenses: 0, left: 0 }]))
  const span = { from: months[0], to: endOfMonth(months.at(-1)!) }
  for (const movement of active(movements, span)) {
    const row = rows.get(startOfMonth(movement.date))
    if (!row) continue
    if (movement.kind === 'income') row.incomes += movement.amount
    else if (movement.kind === 'expense') row.expenses += movement.amount
  }
  for (const row of rows.values()) row.left = row.incomes - row.expenses
  return [...rows.values()]
}

export interface RemainingMonth {
  month: string
  /** Lo que le quedó a cada persona ese mes (puede ser negativo). */
  byPerson: Record<string, number>
}

/** Vista 5: lo que le quedó a cada persona, mes a mes (misma regla que remaining.ts). */
export function remainingByMonth(
  movements: ReadonlyArray<Movement>,
  range: DateRange,
  memberIds: ReadonlyArray<string>,
): RemainingMonth[] {
  const months = chartMonths(range)
  const rows = new Map<string, RemainingMonth>(
    months.map((month) => [
      month,
      { month, byPerson: Object.fromEntries(memberIds.map((id) => [id, 0])) },
    ]),
  )
  const span = { from: months[0], to: endOfMonth(months.at(-1)!) }
  for (const movement of active(movements, span)) {
    const row = rows.get(startOfMonth(movement.date))
    if (!row) continue
    const add = (userId: string, amount: number) =>
      (row.byPerson[userId] = (row.byPerson[userId] ?? 0) + amount)
    switch (movement.kind) {
      case 'income':
        for (const split of movement.splits) add(split.userId, split.amount)
        break
      case 'expense':
        for (const split of movement.splits) add(split.userId, -split.amount)
        break
      case 'transfer':
        add(movement.fromUser, -movement.amount)
        add(movement.toUser, movement.amount)
        break
      case 'card_payment':
        // El gasto ya contó al cargarse a la tarjeta.
        break
    }
  }
  return [...rows.values()]
}

/** Primer día desde el que se proyecta: antes de eso un gasto grande lo distorsiona todo. */
export const PACE_MIN_DAYS = 5

export interface PacePoint {
  day: number
  date: string
  /** Gasto acumulado hasta ese día; null en días que aún no llegan. */
  spent: number | null
  /** Proyección hasta fin de mes (desde hoy); null antes de hoy. */
  projected: number | null
}

export interface MonthPace {
  /** Primer día del mes que se mira (el de range.to, o el de hoy si el periodo lo incluye). */
  month: string
  days: number
  /** Días ya transcurridos del mes (todos si ya pasó, 0 si aún no empieza). */
  elapsed: number
  incomes: number
  spent: number
  /** Gasto estimado a fin de mes; igual a `spent` si el mes ya terminó. */
  projected: number
  points: PacePoint[]
}

/**
 * Gasto proyectado a fin de mes: los gastos recurrentes (arriendo, servicios) cuentan una sola
 * vez y el resto se extiende al ritmo diario hasta el último día.
 */
function project(fixed: number, variable: number, elapsed: number, days: number): number {
  if (elapsed === 0 || elapsed >= days) return fixed + variable
  return fixed + Math.floor((variable * days) / elapsed)
}

/** Vista 2 (y alerta "A este ritmo"): gasto acumulado del mes contra lo que entró. */
export function monthPace(
  movements: ReadonlyArray<Movement>,
  range: DateRange,
  today: string,
): MonthPace {
  const month = inRange(today, range) ? startOfMonth(today) : startOfMonth(range.to)
  const { year, month: m } = parseDay(month)
  const days = daysInMonth(year, m)
  const end = endOfMonth(month)
  const elapsed = today > end ? days : today < month ? 0 : parseDay(today).day

  const daily = new Array<number>(days + 1).fill(0)
  let incomes = 0
  let fixed = 0
  let variable = 0
  for (const movement of active(movements, { from: month, to: end })) {
    if (movement.kind === 'income') incomes += movement.amount
    if (movement.kind !== 'expense') continue
    const day = parseDay(movement.date).day
    if (day > elapsed) continue // gastos con fecha futura: aún no pasan
    daily[day] += movement.amount
    if (movement.recurringExpenseId) fixed += movement.amount
    else variable += movement.amount
  }

  const spent = fixed + variable
  const projected = project(fixed, variable, elapsed, days)
  const points: PacePoint[] = []
  let running = 0
  for (let day = 1; day <= days; day += 1) {
    running += daily[day]
    const isPast = day <= elapsed
    // La proyección va en línea recta desde hoy hasta el último día.
    const projectedHere =
      elapsed > 0 && elapsed < days && day >= elapsed
        ? spent + Math.floor(((projected - spent) * (day - elapsed)) / (days - elapsed))
        : null
    points.push({
      day,
      date: addDays(month, day - 1),
      spent: isPast ? running : null,
      projected: projectedHere,
    })
  }
  return { month, days, elapsed, incomes, spent, projected, points }
}

/** El periodo anterior del mismo largo: el mes anterior si es un mes completo. */
export function previousRange(range: DateRange): DateRange {
  const wholeMonths = range.from === startOfMonth(range.from) && range.to === endOfMonth(range.to)
  if (wholeMonths) {
    const { year: y1, month: m1 } = parseDay(range.from)
    const { year: y2, month: m2 } = parseDay(range.to)
    const count = (y2 - y1) * 12 + (m2 - m1) + 1
    const from = addMonths(range.from, -count)
    return { from, to: endOfMonth(addMonths(range.to, -count)) }
  }
  const length =
    (Date.parse(`${range.to}T12:00:00Z`) - Date.parse(`${range.from}T12:00:00Z`)) / 86_400_000 + 1
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) }
}

export interface CategoryChange {
  categoryId: string | null
  current: number
  previous: number
  /** current − previous: > 0 subió, < 0 bajó. */
  change: number
  /** Variación en puntos básicos sobre el anterior; null si antes no hubo gasto. */
  changeBp: number | null
}

/**
 * Vista 6: variación por categoría entre el periodo y el anterior, de la que más cambió a la
 * que menos. Usa expensesByCategory (mismas reglas de varias categorías y "mi parte").
 */
export function compareCategories(
  movements: ReadonlyArray<Movement>,
  range: DateRange,
  options: { userId?: string } = {},
): { previous: DateRange; changes: CategoryChange[] } {
  const previous = previousRange(range)
  const now = new Map(
    expensesByCategory(movements, range, options).map((entry) => [entry.categoryId, entry.amount]),
  )
  const before = new Map(
    expensesByCategory(movements, previous, options).map((entry) => [
      entry.categoryId,
      entry.amount,
    ]),
  )
  const ids = [...new Set([...now.keys(), ...before.keys()])]
  const changes = ids
    .map((categoryId) => {
      const current = now.get(categoryId) ?? 0
      const last = before.get(categoryId) ?? 0
      return {
        categoryId,
        current,
        previous: last,
        change: current - last,
        changeBp: last > 0 ? Math.round(((current - last) * 10000) / last) : null,
      }
    })
    .filter((entry) => entry.change !== 0 || entry.current > 0)
    .sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        b.current - a.current ||
        String(a.categoryId).localeCompare(String(b.categoryId)),
    )
  return { previous, changes }
}
