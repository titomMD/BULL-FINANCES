// Alertas de gasto del mes (dentro de la app, sin notificaciones). Usan la regla del restante
// (remaining.ts) y la proyección de monthPace (charts.ts). TypeScript puro y determinista.
//
// Una sola alerta del hogar a la vez, la más grave:
//   1. "over"      el restante del hogar es negativo (se gastó más de lo que entró).
//   2. "pace"      a este ritmo, el gasto a fin de mes supera lo que entró.
//   3. "threshold" ya se gastó el umbral (80 % por defecto) de lo que entró.
// Además, si el hogar no está en rojo, una "over" por cada persona con restante negativo que sí
// registró ingresos (sin ingresos registrados no es alarma: aún no anotó lo que le entró).

import type { Movement } from '../../types/domain'
import { endOfMonth, startOfMonth } from '../dates'
import { monthPace, PACE_MIN_DAYS } from './charts'
import { dailyAllowance, householdRemaining } from './remaining'
import type { PeriodSummary } from './reports'

export type SpendAlert =
  | { kind: 'over'; /** null = el hogar */ userId: string | null; amount: number }
  | {
      kind: 'pace'
      projected: number
      incomes: number
      overBy: number
      /** Cuánto pueden gastar por día hasta fin de mes para no pasarse. */
      perDay: number
    }
  | {
      kind: 'threshold'
      percent: number
      spent: number
      incomes: number
      left: number
      perDay: number
    }

export interface AlertOptions {
  /** Porcentaje de lo que entró a partir del cual se avisa (50-90). */
  threshold: number
}

/**
 * Alertas del mes de `today`. `summary` debe ser summarizePeriod del mismo mes, sin filtros.
 * Sin ingresos en el mes no hay con qué comparar: no hay alertas.
 */
export function spendAlerts(
  summary: PeriodSummary,
  movements: ReadonlyArray<Movement>,
  today: string,
  { threshold }: AlertOptions,
): SpendAlert[] {
  const incomes = summary.totalIncomes
  if (incomes <= 0) return []

  const left = householdRemaining(summary)
  if (left < 0) return [{ kind: 'over', userId: null, amount: -left }]

  const alerts: SpendAlert[] = []
  for (const person of summary.people)
    if (person.left < 0 && person.incomes + person.transfersReceived > 0)
      alerts.push({ kind: 'over', userId: person.userId, amount: -person.left })

  const month = { from: startOfMonth(today), to: endOfMonth(today) }
  const pace = monthPace(movements, month, today)
  const spent = summary.totalExpenses
  if (pace.elapsed >= PACE_MIN_DAYS && pace.projected > incomes)
    alerts.push({
      kind: 'pace',
      projected: pace.projected,
      incomes,
      overBy: pace.projected - incomes,
      perDay: dailyAllowance(left, today),
    })
  else if (spent * 100 >= threshold * incomes)
    alerts.push({
      kind: 'threshold',
      percent: Math.floor((spent * 100) / incomes),
      spent,
      incomes,
      left,
      perDay: dailyAllowance(left, today),
    })
  return alerts
}

/** Identifica el estado de una alerta: cerrarla dura hasta que este valor cambie. */
export function alertKey(alert: SpendAlert, today: string): string {
  const month = startOfMonth(today)
  return alert.kind === 'over'
    ? `${month}:over:${alert.userId ?? 'hogar'}`
    : `${month}:${alert.kind}`
}
