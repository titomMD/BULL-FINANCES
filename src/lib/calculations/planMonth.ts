// Plan del mes con lo que realmente pasó (pedido del usuario, 2026-10-25):
//   · gastos fijos que se marcan como pagados (membresías, gimnasio…)
//   · líneas con registro de gastos (tanqueadas de la gasolina) que se van restando de su tope
//   · el ahorro mensual sirve para pagar tarjetas/deudas: lo pagado de los extractos lo va restando
//   · lo que se pase de un tope se descuenta de «Dinero mío»
// Todo entero en COP. Los meses son 'YYYY-MM'.

import type { DebtStatement, PlanCheck, PlanEntry, PlanItem } from '../../types/domain'
import { monthOf, planSummary, type Month, type PlanSummary } from './plan'

export interface ItemProgress {
  item: PlanItem
  /** Marcado como pagado este mes (solo líneas sin registro de gastos). */
  paid: boolean
  /** Lo gastado este mes: tanqueadas si lleva registro; si no, el monto si está pagado. */
  spent: number
  /** Lo que queda del tope (puede ser negativo si se pasó). */
  remaining: number
  /** Cuánto se pasó del tope (0 si no se pasó). */
  over: number
  entries: PlanEntry[]
}

export interface GroupProgress {
  name: string | null
  planned: number
  spent: number
  paidCount: number
  count: number
  items: ItemProgress[]
}

export interface DebtProgress {
  /** Lo que el plan aparta cada mes para tarjetas y deudas (las líneas de «ahorro»). */
  planned: number
  /** Lo ya pagado de los extractos de este mes. */
  paid: number
  /** Lo que piden los extractos de este mes (total a pagar). */
  due: number
  /** Pago mínimo de los extractos de este mes. */
  minimum: number
  /** Lo que falta por pagar de los extractos de este mes. */
  pending: number
  /** Lo que queda del dinero apartado. Negativo si se pagó más de lo apartado. */
  remaining: number
  over: number
  statements: DebtStatement[]
}

export interface MonthProgress {
  summary: PlanSummary
  groups: GroupProgress[]
  debt: DebtProgress
  /** Total de gastos fijos ya pagados / total a pagar. */
  fixedPaid: number
  fixedTotal: number
  /** Lo que se pasó de los topes (gasolina + pagos de tarjetas). Se descuenta de «Dinero mío». */
  overspend: number
  /** «Dinero mío» del mes después de descontar lo que se pasó. Es lo que pasa a tu dinero personal. */
  money: number
}

const inMonth = (entry: PlanEntry, month: Month) => monthOf(entry.date) === month
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function itemProgress(
  item: PlanItem,
  month: Month,
  checks: PlanCheck[],
  entries: PlanEntry[],
): ItemProgress {
  const mine = entries.filter((entry) => entry.planItemId === item.id && inMonth(entry, month))
  const paid = checks.some((check) => check.planItemId === item.id && check.month === month)
  const spent = item.tracked ? sum(mine.map((entry) => entry.amount)) : paid ? item.amount : 0
  const remaining = item.amount - spent
  // Una línea marcada como pagada nunca "se pasa": se pagó lo planeado.
  const over = item.tracked ? Math.max(0, spent - item.amount) : 0
  return { item, paid, spent, remaining, over, entries: mine }
}

export function debtProgress(
  statements: DebtStatement[],
  planned: number,
  month: Month,
): DebtProgress {
  const mine = statements.filter((statement) => statement.payMonth === month)
  const paid = sum(mine.map((statement) => statement.paidAmount))
  const due = sum(mine.map((statement) => statement.totalDue))
  const minimum = sum(mine.map((statement) => statement.minimumDue))
  const pending = sum(
    mine.map((statement) => Math.max(0, statement.totalDue - statement.paidAmount)),
  )
  return {
    planned,
    paid,
    due,
    minimum,
    pending,
    remaining: planned - paid,
    over: Math.max(0, paid - planned),
    statements: mine,
  }
}

export function monthProgress(
  items: PlanItem[],
  checks: PlanCheck[],
  entries: PlanEntry[],
  statements: DebtStatement[],
  month: Month,
): MonthProgress {
  const summary = planSummary(items, month)
  const groups: GroupProgress[] = summary.expenseGroups.map((group) => {
    const progress = group.items.map((item) => itemProgress(item, month, checks, entries))
    return {
      name: group.name,
      planned: group.total,
      spent: sum(progress.map((entry) => entry.spent)),
      paidCount: progress.filter((entry) => entry.paid || entry.spent >= entry.item.amount).length,
      count: progress.length,
      items: progress,
    }
  })
  const debt = debtProgress(statements, summary.totalSavings, month)
  const trackedOver = sum(groups.flatMap((group) => group.items.map((entry) => entry.over)))
  const overspend = trackedOver + debt.over
  const fixedPaid = sum(groups.map((group) => Math.min(group.spent, group.planned)))
  return {
    summary,
    groups,
    debt,
    fixedPaid,
    fixedTotal: summary.totalExpenses,
    overspend,
    money: summary.free - overspend,
  }
}

export interface Bucket {
  key: string
  label: string
  planned: number
  spent: number
  /** Planeado − gastado (negativo = se pasó). */
  remaining: number
  kind: 'free' | 'group' | 'debt'
}

/**
 * «Bolsillos» del mes para Presupuestos: libre, cada grupo/gasto fijo (gasolina, membresías…) y
 * el pago de tarjetas. `personalSpent` es lo gastado del dinero personal este mes.
 */
export function planBuckets(progress: MonthProgress, personalSpent: number): Bucket[] {
  const buckets: Bucket[] = []
  const free = Math.max(0, progress.summary.free)
  const freeSpent = personalSpent + progress.overspend
  buckets.push({
    key: 'libre',
    label: 'Dinero mío (libre)',
    planned: free,
    spent: freeSpent,
    remaining: free - freeSpent,
    kind: 'free',
  })
  for (const group of progress.groups) {
    buckets.push({
      key: `grupo:${group.name ?? group.items[0].item.id}`,
      label: group.name ?? group.items[0].item.name,
      planned: group.planned,
      spent: group.spent,
      remaining: group.planned - group.spent,
      kind: 'group',
    })
  }
  if (progress.debt.planned > 0 || progress.debt.paid > 0) {
    buckets.push({
      key: 'deudas',
      label: 'Tarjetas y deudas',
      planned: progress.debt.planned,
      spent: progress.debt.paid,
      remaining: progress.debt.remaining,
      kind: 'debt',
    })
  }
  return buckets
}

/** Mes de pago por defecto de un extracto: el de su fecha límite (o el de su corte). */
export function defaultPayMonth(statementDate: string, dueDate: string | null): Month {
  return monthOf(dueDate ?? statementDate)
}
