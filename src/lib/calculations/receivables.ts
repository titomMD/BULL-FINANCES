// Cuenta con mamá: cuánto te debe (cobros − pagos) y los cobros que se repiten. Puro y determinista.

import { addDays, addMonths, parseDay } from '../dates'
import type { ReceivableEntry, ReceivableRule } from '../../types/domain'

/** Lo que te deben hoy: cobros − pagos (puede ser negativo si pagó de más). */
export function receivableBalance(entries: ReceivableEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (entry.kind === 'charge' ? entry.amount : -entry.amount),
    0,
  )
}

export interface ReceivableRow {
  entry: ReceivableEntry
  /** Lo que te debía después de este movimiento. */
  runningBalance: number
}

/** Libreta ordenada del más reciente al más antiguo, con el saldo acumulado en cada línea. */
export function receivableLedger(entries: ReceivableEntry[]): ReceivableRow[] {
  const ascending = [...entries].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
  )
  let running = 0
  const rows = ascending.map((entry) => {
    running += entry.kind === 'charge' ? entry.amount : -entry.amount
    return { entry, runningBalance: running }
  })
  return rows.reverse()
}

/** Fechas en que la regla cobra, entre su inicio y `until` (incluidas). */
export function ruleDates(rule: ReceivableRule, until: string): string[] {
  const end = rule.endsOn && rule.endsOn < until ? rule.endsOn : until
  const dates: string[] = []
  if (rule.startsOn > end) return dates
  if (rule.frequency === 'weekly') {
    for (let day = rule.startsOn; day <= end; day = addDays(day, 7)) dates.push(day)
  } else {
    const anchor = parseDay(rule.startsOn).day
    for (
      let i = 0, day = rule.startsOn;
      day <= end;
      i += 1, day = addMonths(rule.startsOn, i, anchor)
    ) {
      dates.push(day)
    }
  }
  return dates
}

export interface PendingCharge {
  ruleId: string
  date: string
  amount: number
  note: string
}

/**
 * Cobros automáticos que ya tocaban hasta hoy y todavía no se registraron: los posteriores al
 * último día generado de cada regla (`generatedUntil`). Así, un cobro que borras a mano no vuelve.
 */
export function pendingCharges(rules: ReceivableRule[], today: string): PendingCharge[] {
  return rules
    .filter((rule) => rule.active)
    .flatMap((rule) =>
      ruleDates(rule, today)
        .filter((date) => !rule.generatedUntil || date > rule.generatedUntil)
        .map((date) => ({ ruleId: rule.id, date, amount: rule.amount, note: rule.label })),
    )
}

/** Cuánto cobra la regla en un mes típico (semanal ≈ 52/12 veces), redondeado al peso. */
export function monthlyEquivalent(rule: ReceivableRule): number {
  return rule.frequency === 'monthly' ? rule.amount : Math.round((rule.amount * 52) / 12)
}
