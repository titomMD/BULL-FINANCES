// Dinero personal (pedido del usuario, 2026-10-20): lo que cada persona lleva aparte del hogar.
//   disponible personal = Σ ingresos personales − Σ gastos personales (acumulado, todos los meses)
// Solo cuentan los activos. No toca el saldo disponible del hogar (available.ts) ni lo que queda
// (remaining.ts): esos cálculos nunca reciben movimientos personales.

import type { PersonalMovement } from '../../types/domain'

export interface PersonalSummary {
  /** Ingresos − gastos de siempre. Negativo si se gastó más de lo que entró. */
  available: number
  /** Del periodo pedido (normalmente el mes). */
  periodIncomes: number
  periodExpenses: number
}

export function personalSummary(
  movements: PersonalMovement[],
  period: { from: string; to: string },
): PersonalSummary {
  let available = 0
  let periodIncomes = 0
  let periodExpenses = 0
  for (const movement of movements) {
    if (movement.status !== 'active') continue
    const inPeriod = movement.date >= period.from && movement.date <= period.to
    if (movement.kind === 'income') {
      available += movement.amount
      if (inPeriod) periodIncomes += movement.amount
    } else {
      available -= movement.amount
      if (inPeriod) periodExpenses += movement.amount
    }
  }
  return { available, periodIncomes, periodExpenses }
}

export interface PersonalDay {
  date: string
  movements: PersonalMovement[]
  /** Disponible personal al cierre del día (solo activos). */
  closing: number
}

/**
 * Movimientos agrupados por día, del más reciente al más antiguo, con el disponible al cierre
 * de cada día. Los anulados se listan pero no mueven el saldo.
 */
export function personalDays(movements: PersonalMovement[]): PersonalDay[] {
  const ordered = [...movements].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )
  const days: PersonalDay[] = []
  let running = 0
  for (const movement of ordered) {
    if (movement.status === 'active')
      running += movement.kind === 'income' ? movement.amount : -movement.amount
    const last = days.at(-1)
    if (last && last.date === movement.date) {
      last.movements.push(movement)
      last.closing = running
    } else {
      days.push({ date: movement.date, movements: [movement], closing: running })
    }
  }
  for (const day of days) day.movements.reverse()
  return days.reverse()
}
