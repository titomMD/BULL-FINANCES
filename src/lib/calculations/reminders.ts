// Fechas de pago y avisos: qué hay que pagar pronto (o ya se venció) según el día de pago de cada
// línea del plan. Puro y determinista: recibe «hoy» como parámetro.

import { daysInMonth, formatDayKey, parseDay } from '../dates'
import type { PlanCheck, PlanEntry, PlanItem } from '../../types/domain'
import { isActiveInMonth, monthOf } from './plan'
import { daysBetween } from './cards'

/** Fecha de pago de un mes ('YYYY-MM') para un día de pago (se ajusta a meses cortos). */
export function dueDateIn(month: string, dueDay: number): string {
  const [year, m] = month.split('-').map(Number)
  return formatDayKey({ year, month: m, day: Math.min(dueDay, daysInMonth(year, m)) })
}

export interface UpcomingPayment {
  item: PlanItem
  dueDate: string
  /** Días que faltan (negativo = ya pasó). */
  daysLeft: number
  overdue: boolean
}

/** ¿Ya se pagó este mes? Marcada como pagada, o (si lleva registros) con algún registro. */
export function isSettled(
  item: PlanItem,
  month: string,
  checks: PlanCheck[],
  entries: PlanEntry[],
): boolean {
  if (checks.some((c) => c.planItemId === item.id && c.month === month)) return true
  return item.tracked && entries.some((e) => e.planItemId === item.id && monthOf(e.date) === month)
}

/**
 * Pagos del mes actual que faltan y ya están dentro de su ventana de aviso (o vencidos).
 * Ordenados por fecha: primero lo más urgente.
 */
export function upcomingPayments(
  items: PlanItem[],
  checks: PlanCheck[],
  entries: PlanEntry[],
  today: string,
): UpcomingPayment[] {
  const month = monthOf(today)
  return items
    .filter(
      (item) => item.kind === 'expense' && item.dueDay !== null && isActiveInMonth(item, month),
    )
    .filter((item) => !isSettled(item, month, checks, entries))
    .map((item) => {
      const dueDate = dueDateIn(month, item.dueDay!)
      const daysLeft = daysBetween(today, dueDate)
      return { item, dueDate, daysLeft, overdue: daysLeft < 0 }
    })
    .filter((payment) => payment.daysLeft <= payment.item.remindDays)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.item.name.localeCompare(b.item.name))
}

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const compact = (day: string) => day.replaceAll('-', '')

/**
 * Archivo de calendario (.ics) con un evento mensual por cada línea con día de pago y una alarma
 * `remindDays` días antes (a las 9:00). Al abrirlo en el iPhone, el calendario avisa solo.
 */
export function buildIcs(items: PlanItem[], today: string, stamp: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Freyapp//Pagos//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Pagos Freyapp',
  ]
  for (const item of items) {
    if (item.kind !== 'expense' || item.dueDay === null) continue
    const month = monthOf(today)
    let first = dueDateIn(month, item.dueDay)
    if (first < today) {
      const { year, month: m } = parseDay(`${month}-01`)
      const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
      first = dueDateIn(next, item.dueDay)
    }
    const day = item.dueDay > 28 ? -1 : item.dueDay
    const trigger = item.remindDays > 0 ? `-P${item.remindDays - 1}DT15H` : 'PT9H'
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@freyapp`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(first)}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
      `SUMMARY:${escapeText(`Pagar ${item.name}`)}`,
      `DESCRIPTION:${escapeText(`Tope del mes: $${item.amount.toLocaleString('es-CO')}. Regístralo en Freyapp.`)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Pagar ${item.name}`)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
