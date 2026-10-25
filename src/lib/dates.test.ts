import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatMonthAbbr,
  addMonths,
  endOfMonth,
  formatDayHeading,
  isValidDay,
  startOfWeek,
  todayBogota,
} from './dates'

describe('todayBogota', () => {
  it('usa el día de Bogotá aunque en UTC ya sea el día siguiente', () => {
    // 2026-10-13 03:00 UTC = 2026-10-12 22:00 en Bogotá (UTC-5).
    expect(todayBogota(new Date('2026-10-13T03:00:00Z'))).toBe('2026-10-12')
    expect(todayBogota(new Date('2026-10-13T05:00:00Z'))).toBe('2026-10-13')
  })
})

describe('aritmética de días', () => {
  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('suma meses respetando el día de anclaje', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('calcula fin de mes y lunes de la semana', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12') // lunes
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12') // domingo
  })

  it('valida fechas', () => {
    expect(isValidDay('2026-02-29')).toBe(false)
    expect(isValidDay('2028-02-29')).toBe(true)
    expect(isValidDay('2026-13-01')).toBe(false)
  })
})

describe('formatDayHeading', () => {
  it('usa Hoy / Ayer y luego día abreviado', () => {
    expect(formatDayHeading('2026-10-12', '2026-10-12')).toBe('Hoy')
    expect(formatDayHeading('2026-10-11', '2026-10-12')).toBe('Ayer')
    expect(formatDayHeading('2026-10-06', '2026-10-12')).toMatch(/^mar 6 oct$/)
  })
})

describe('formatMonthAbbr', () => {
  it('mes abreviado sin punto ni año', () => {
    expect(formatMonthAbbr('2026-10-01')).toBe('oct')
    expect(formatMonthAbbr('2026-05-01')).toBe('may')
  })
})
