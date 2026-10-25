// "Lo que queda" del periodo (decidido 2026-10-18). Reúsa summarizePeriod: el restante de cada
// persona es PersonSummary.left =
//   su parte de los ingresos − su parte de los gastos (según el split, no lo que pagó)
//   − transferencias enviadas + recibidas
// Los gastos con tarjeta cuentan al cargarse (como en Reportes) y los pagos de tarjeta no, así
// que no se cuentan dos veces. A diferencia del saldo disponible (available.ts), no arrastra
// meses anteriores. Las transferencias solo mueven el restante: no son gasto (spec §16).

import { endOfMonth, parseDay } from '../dates'
import type { PeriodSummary } from './reports'

/** Restante del hogar: la suma de los restantes de cada uno (las transferencias se anulan). */
export function householdRemaining(summary: PeriodSummary): number {
  return summary.people.reduce((sum, person) => sum + person.left, 0)
}

/** Días que faltan del mes contando hoy (hoy es el último día → 1). */
export function daysLeftInMonth(today: string): number {
  return parseDay(endOfMonth(today)).day - parseDay(today).day + 1
}

/**
 * Cuánto se puede gastar por día hasta fin de mes sin pasarse, redondeado hacia abajo a pesos.
 * 0 si no queda nada.
 */
export function dailyAllowance(remaining: number, today: string): number {
  if (remaining <= 0) return 0
  return Math.floor(remaining / daysLeftInMonth(today))
}

export interface PeriodRemaining {
  incomes: number
  expenses: number
  /** incomes − expenses: igual a la suma de los restantes de cada uno. */
  left: number
  /** Porcentaje de lo que entró ya gastado, en puntos básicos; null si no entró nada. */
  spentBp: number | null
}

/** Ingresos − Gastos = Queda, del hogar, para la tarjeta de Reportes. */
export function periodRemaining(summary: PeriodSummary): PeriodRemaining {
  const incomes = summary.totalIncomes
  const expenses = summary.totalExpenses
  return {
    incomes,
    expenses,
    left: householdRemaining(summary),
    spentBp: incomes > 0 ? Math.floor((expenses * 10000) / incomes) : null,
  }
}
