// Fechas financieras: strings 'YYYY-MM-DD' interpretadas en America/Bogota (spec §43).
// El día nunca se calcula con la zona horaria del navegador.

export const TIME_ZONE = 'America/Bogota'

const isoDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Día actual en Bogotá, 'YYYY-MM-DD'. */
export function todayBogota(now: Date = new Date()): string {
  return isoDayFormatter.format(now)
}

/** Día en Bogotá de un instante (timestamptz). */
export function toBogotaDay(instant: string | Date): string {
  return isoDayFormatter.format(typeof instant === 'string' ? new Date(instant) : instant)
}

export interface DayParts {
  year: number
  month: number // 1-12
  day: number
}

export function parseDay(day: string): DayParts {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return { year, month, day: dayOfMonth }
}

export function formatDayKey({ year, month, day }: DayParts): string {
  const pad = (value: number, size: number) => String(value).padStart(size, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const { year, month, day: d } = parseDay(day)
  return month >= 1 && month <= 12 && d >= 1 && d <= daysInMonth(year, month)
}

/** Mediodía UTC del día: seguro para formatear sin corrimientos de zona horaria. */
function dayToUtcNoon(day: string): Date {
  const { year, month, day: d } = parseDay(day)
  return new Date(Date.UTC(year, month - 1, d, 12))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDays(day: string, amount: number): string {
  const date = dayToUtcNoon(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

/** Suma meses conservando el día de anclaje (31 → último día del mes cuando no existe). */
export function addMonths(day: string, amount: number, anchorDay?: number): string {
  const { year, month, day: d } = parseDay(day)
  const total = year * 12 + (month - 1) + amount
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12) + 1
  const targetDay = Math.min(anchorDay ?? d, daysInMonth(targetYear, targetMonth))
  return formatDayKey({ year: targetYear, month: targetMonth, day: targetDay })
}

export function startOfMonth(day: string): string {
  const { year, month } = parseDay(day)
  return formatDayKey({ year, month, day: 1 })
}

export function endOfMonth(day: string): string {
  const { year, month } = parseDay(day)
  return formatDayKey({ year, month, day: daysInMonth(year, month) })
}

/** Lunes de la semana del día dado. */
export function startOfWeek(day: string): string {
  const weekday = dayToUtcNoon(day).getUTCDay() // 0 = domingo
  return addDays(day, -((weekday + 6) % 7))
}

const weekdayShort = new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' })
const dayMonth = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const dayMonthYear = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthLong = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
const monthShortYear = new Intl.DateTimeFormat('es-CO', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

// Intl en español añade puntos ("oct.") y "de" ("6 de oct"); se limpian para columnas compactas.
const tidy = (text: string) =>
  text
    .replace(/\./g, '')
    .replace(/\s+de\s+/g, ' ')
    .trim()

/** "lun" */
export function formatWeekday(day: string): string {
  return tidy(weekdayShort.format(dayToUtcNoon(day)))
}

/** "6 oct", o "6 oct 2025" si no es del año en curso. */
export function formatDay(day: string, today: string = todayBogota()): string {
  const sameYear = parseDay(day).year === parseDay(today).year
  return tidy((sameYear ? dayMonth : dayMonthYear).format(dayToUtcNoon(day)))
}

/** "octubre" */
export function formatMonthName(day: string): string {
  return monthLong.format(dayToUtcNoon(day))
}

/** "oct 25" (ejes de gráficos). */
export function formatMonthShort(day: string): string {
  return tidy(monthShortYear.format(dayToUtcNoon(day)))
}

/** "oct" (ejes de gráficas angostas; el año va en el tooltip). */
export function formatMonthAbbr(day: string): string {
  return tidy(monthShort.format(dayToUtcNoon(day)))
}

/** Encabezado de un día en el libro: "Hoy", "Ayer" o "lun 6 oct". */
export function formatDayHeading(day: string, today: string = todayBogota()): string {
  if (day === today) return 'Hoy'
  if (day === addDays(today, -1)) return 'Ayer'
  return `${formatWeekday(day)} ${formatDay(day, today)}`
}
