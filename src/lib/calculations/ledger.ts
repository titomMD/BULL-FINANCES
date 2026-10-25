// Utilidades del libro diario (filas con saldo antes/después). TypeScript puro y determinista.
// Sirven para cualquier libro con el formato de LedgerDay (hoy, el del saldo disponible).

import type { LedgerDay, LedgerEntry } from './balance'

export interface AnnotatedEntry extends LedgerEntry {
  /** Saldo de quien mira justo antes de este movimiento. */
  before: number
  /** Saldo de quien mira justo después (before + effect). */
  after: number
}

export interface AnnotatedDay extends Omit<LedgerDay, 'entries'> {
  entries: AnnotatedEntry[]
}

/**
 * Añade a cada fila del libro el saldo antes y después de ese movimiento. Los días vienen de
 * `buildAvailableLedger` (más reciente primero, entradas en el mismo orden) y deben estar completos:
 * hay que anotar ANTES de filtrar filas, o los saldos intermedios saldrían mal.
 */
export function annotateLedger(days: ReadonlyArray<LedgerDay>): AnnotatedDay[] {
  return days.map((day) => {
    let after = day.closingBalance
    const entries = day.entries.map((entry) => {
      const annotated = { ...entry, before: after - entry.effect, after }
      after -= entry.effect
      return annotated
    })
    return { ...day, entries }
  })
}

/** Recorta el libro a las `max` filas más recientes (el último día puede quedar parcial). */
export function limitEntries<Day extends { entries: ReadonlyArray<unknown> }>(
  days: ReadonlyArray<Day>,
  max: number,
): Day[] {
  const result: Day[] = []
  let left = max
  for (const day of days) {
    if (left <= 0) break
    const entries = day.entries.slice(0, left)
    result.push({ ...day, entries })
    left -= entries.length
  }
  return result
}
