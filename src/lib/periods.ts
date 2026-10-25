import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from './dates'
import type { DateRange } from './calculations/reports'

// Periodos de la spec §19, siempre calculados sobre el "hoy" de Bogotá.

export type PeriodPreset =
  'week' | 'previousWeek' | 'month' | 'previousMonth' | 'last3Months' | 'all' | 'custom'

export const periodLabels: Record<PeriodPreset, string> = {
  week: 'Esta semana',
  previousWeek: 'Semana pasada',
  month: 'Este mes',
  previousMonth: 'Mes anterior',
  last3Months: 'Últimos 3 meses',
  all: 'Todo',
  custom: 'Rango personalizado',
}

export function resolvePeriod(
  preset: PeriodPreset,
  today: string,
  custom?: Partial<DateRange>,
): DateRange {
  switch (preset) {
    case 'week':
      return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
    case 'previousWeek': {
      const monday = addDays(startOfWeek(today), -7)
      return { from: monday, to: addDays(monday, 6) }
    }
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'previousMonth': {
      const previous = addMonths(startOfMonth(today), -1)
      return { from: previous, to: endOfMonth(previous) }
    }
    case 'last3Months':
      return { from: addMonths(startOfMonth(today), -2), to: endOfMonth(today) }
    case 'all':
      return { from: '2000-01-01', to: '2100-12-31' }
    case 'custom': {
      const from = custom?.from || startOfMonth(today)
      const to = custom?.to || today
      return from <= to ? { from, to } : { from: to, to: from }
    }
  }
}

export function isPeriodPreset(value: string | null): value is PeriodPreset {
  return value !== null && value in periodLabels
}
