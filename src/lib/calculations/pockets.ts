// Bolsillos (espejo de Bancolombia): saldo, meta, lo prestado y lo que falta. Puro y determinista.

import type { Pocket, PocketMove } from '../../types/domain'

export interface PocketSummary {
  pocket: Pocket
  /** Suma de todos sus movimientos. */
  balance: number
  /** Cuánto de su dinero está prestado a otros bolsillos o gastos y aún no vuelve (≥ 0). */
  lent: number
  /** Meta − saldo (≥ 0); null si no tiene meta. */
  missing: number | null
  /** Saldo / meta en puntos básicos, limitado a 0–10000; null si no tiene meta. */
  progressBp: number | null
}

export function pocketBalance(moves: PocketMove[], pocketId: string): number {
  return moves.reduce(
    (total, move) => (move.pocketId === pocketId ? total + move.amount : total),
    0,
  )
}

/** Préstamo pendiente que salió de este bolsillo: lo prestado menos lo que ya volvió. */
export function pocketLent(moves: PocketMove[], pocketId: string): number {
  const net = moves.reduce((total, move) => {
    if (move.pocketId !== pocketId) return total
    return move.kind === 'loan_out' || move.kind === 'loan_back' ? total - move.amount : total
  }, 0)
  return Math.max(0, net)
}

/** Lo que este bolsillo le debe a otros (recibió prestado y no devolvió) (≥ 0). */
export function pocketBorrowed(moves: PocketMove[], pocketId: string): number {
  const net = moves.reduce((total, move) => {
    if (move.pocketId !== pocketId) return total
    return move.kind === 'loan_in' || move.kind === 'loan_return' ? total + move.amount : total
  }, 0)
  return Math.max(0, net)
}

export function summarizePockets(pockets: Pocket[], moves: PocketMove[]): PocketSummary[] {
  return [...pockets]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .map((pocket) => {
      const balance = pocketBalance(moves, pocket.id)
      const goal = pocket.goal
      return {
        pocket,
        balance,
        lent: pocketLent(moves, pocket.id),
        missing: goal === null ? null : Math.max(0, goal - balance),
        progressBp:
          goal === null || goal <= 0
            ? null
            : Math.min(10_000, Math.max(0, Math.floor((balance * 10_000) / goal))),
      }
    })
}

/** Dinero total repartido en bolsillos (sin los archivados). */
export function totalInPockets(summaries: PocketSummary[]): number {
  return summaries.reduce(
    (total, entry) => (entry.pocket.archivedAt ? total : total + entry.balance),
    0,
  )
}

/**
 * Ajuste necesario para que el saldo del bolsillo sea `target` (lo que dice Bancolombia hoy).
 * 0 = ya coincide.
 */
export function adjustmentFor(currentBalance: number, target: number): number {
  return target - currentBalance
}
