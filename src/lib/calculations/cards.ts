// Tarjetas: intereses día a día, intereses ahorrados por un abono, pagos por moneda y gastos del mes.
// Pesos = enteros en COP. Dólares = enteros en centavos. Tasa de cambio = pesos por dólar × 100.
// Tasa mensual en millonésimas (2,1593 % = 21593). Los intereses son una ESTIMACIÓN: el banco manda.

import { addMonths, daysInMonth, formatDayKey, parseDay } from '../dates'
import type { DebtCardExpense, DebtPayment, DebtStatement } from '../../types/domain'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** Días entre dos fechas 'YYYY-MM-DD' (b − a). */
export function daysBetween(a: string, b: string): number {
  const x = parseDay(a)
  const y = parseDay(b)
  return Math.round(
    (Date.UTC(y.year, y.month - 1, y.day) - Date.UTC(x.year, x.month - 1, x.day)) / 86_400_000,
  )
}

/** Pesos equivalentes de centavos de dólar, con la tasa (pesos por dólar × 100). */
export function usdToCop(usdCents: number, fxCents: number): number {
  return Math.round((usdCents * fxCents) / 10_000)
}

/** Interés que causa un saldo en `days` días (mes comercial de 30 días). */
export function accruedInterest(balance: number, monthlyRatePpm: number, days: number): number {
  if (balance <= 0 || days <= 0 || monthlyRatePpm <= 0) return 0
  return Math.round((balance * monthlyRatePpm * days) / 30_000_000)
}

/** Interés de un solo día sobre el saldo. */
export function dailyInterest(balance: number, monthlyRatePpm: number): number {
  return accruedInterest(balance, monthlyRatePpm, 1)
}

export interface InterestDay {
  date: string
  /** Interés de ese día. */
  interest: number
  /** Interés acumulado desde el inicio. */
  accumulated: number
}

/** Interés día tras día de un saldo que no se paga, desde `from` durante `days` días. */
export function interestTimeline(
  balance: number,
  monthlyRatePpm: number,
  from: string,
  days: number,
): InterestDay[] {
  const out: InterestDay[] = []
  let previous = 0
  for (let i = 1; i <= days; i++) {
    const accumulated = accruedInterest(balance, monthlyRatePpm, i)
    const { year, month, day } = parseDay(from)
    const date = new Date(Date.UTC(year, month - 1, day + i)).toISOString().slice(0, 10)
    out.push({ date, interest: accumulated - previous, accumulated })
    previous = accumulated
  }
  return out
}

/**
 * Interés que te ahorras por abonar `amount` el día `paidOn` en vez de dejarlo hasta `until`
 * (normalmente el próximo corte). Nunca se ahorra más de lo que debías.
 */
export function interestSaved(
  amount: number,
  balance: number,
  monthlyRatePpm: number,
  paidOn: string,
  until: string,
): number {
  const days = daysBetween(paidOn, until)
  return accruedInterest(Math.min(amount, Math.max(0, balance)), monthlyRatePpm, days)
}

/**
 * El pago mínimo del banco incluye la cuota de manejo. Esa parte se descuenta de Membresías
 * (no cuenta como pago de deuda); el resto sí baja la deuda de la tarjeta.
 */
export function minimumBreakdown(
  minimum: number,
  fee: number | null,
): { debt: number; fee: number } {
  const feePart = Math.min(Math.max(0, fee ?? 0), minimum)
  return { debt: minimum - feePart, fee: feePart }
}

/** Pagos de un extracto (u otro conjunto) por moneda, y su equivalente en pesos. */
export function paymentTotals(payments: DebtPayment[]): {
  cop: number
  usd: number
  usdAsCop: number
} {
  const cop = sum(payments.filter((p) => p.currency === 'COP').map((p) => p.amount))
  const usdPayments = payments.filter((p) => p.currency === 'USD')
  return {
    cop,
    usd: sum(usdPayments.map((p) => p.amount)),
    usdAsCop: sum(usdPayments.map((p) => (p.fxRateCents ? usdToCop(p.amount, p.fxRateCents) : 0))),
  }
}

export interface CurrencyDue {
  total: number
  minimum: number
  paid: number
  pending: number
  minimumPending: number
  /** El mínimo ya está cubierto. */
  minimumMet: boolean
}

/** Estado de una moneda del extracto: lo que piden, lo pagado y lo que falta. */
export function currencyDue(total: number, minimum: number, paid: number): CurrencyDue {
  return {
    total,
    minimum,
    paid,
    pending: Math.max(0, total - paid),
    minimumPending: Math.max(0, minimum - paid),
    minimumMet: paid >= minimum,
  }
}

export interface StatementDues {
  cop: CurrencyDue
  usd: CurrencyDue
}

/** Las dos cuentas bien separadas de un extracto: pesos y dólares. */
export function statementDues(statement: DebtStatement): StatementDues {
  return {
    cop: currencyDue(statement.totalDue, statement.minimumDue, statement.paidAmount),
    usd: currencyDue(statement.usdTotalDue, statement.usdMinimumDue, statement.usdPaid),
  }
}

/** Gastos de la tarjeta aún sin extracto, por moneda. */
export function cardExpenseTotals(expenses: DebtCardExpense[]): { cop: number; usd: number } {
  return {
    cop: sum(expenses.filter((e) => e.currency === 'COP').map((e) => e.amount)),
    usd: sum(expenses.filter((e) => e.currency === 'USD').map((e) => e.amount)),
  }
}

/** Gastos posteriores al último corte: son los que saldrán en el próximo extracto. */
export function expensesSinceCut(
  expenses: DebtCardExpense[],
  lastCut: string | null,
): DebtCardExpense[] {
  return lastCut ? expenses.filter((e) => e.expenseDate > lastCut) : expenses
}

/** Próxima fecha de corte (después de `today`) según el día de corte de la tarjeta. */
export function nextCutDate(
  today: string,
  cutDay: number | null,
  lastStatementDate?: string,
): string {
  if (!cutDay) return addMonths(lastStatementDate ?? today, 1)
  const { year, month } = parseDay(today)
  const pick = (y: number, m: number) =>
    formatDayKey({ year: y, month: m, day: Math.min(cutDay, daysInMonth(y, m)) })
  const thisMonth = pick(year, month)
  if (thisMonth > today) return thisMonth
  return month === 12 ? pick(year + 1, 1) : pick(year, month + 1)
}
