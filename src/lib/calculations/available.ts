// Saldo disponible de cada persona (decidido 2026-10-12): no hay deudas entre ustedes.
//   saldo = su parte de los ingresos − su parte de los gastos (sin tarjeta) − sus pagos de tarjeta
//           + transferencias recibidas − enviadas
// Quién pagó un gasto no importa: a cada uno se le descuenta su parte. Si el saldo de alguien
// queda negativo, está usando el saldo de los demás.
// Tarjeta (2026-10-13): un gasto con tarjeta no baja el saldo todavía; la parte de cada uno queda
// "por pagar de tarjeta" hasta que registra un pago de tarjeta, que es lo que sí baja su saldo.
// TypeScript puro y determinista; solo cuentan movimientos activos y se acumula entre meses.

import type { Movement } from '../../types/domain'
import type { LedgerDay } from './balance'
import { inRange, type DateRange } from './reports'

/** Cuánto cambia el saldo disponible de cada persona con un movimiento (vacío si está anulado). */
export function availableEffects(movement: Movement): Map<string, number> {
  const effects = new Map<string, number>()
  if (movement.status !== 'active') return effects
  const add = (userId: string, amount: number) =>
    effects.set(userId, (effects.get(userId) ?? 0) + amount)
  if (movement.kind === 'transfer') {
    add(movement.fromUser, -movement.amount)
    add(movement.toUser, movement.amount)
  } else if (movement.kind === 'card_payment') {
    add(movement.userId, -movement.amount)
  } else if (movement.kind === 'income') {
    for (const split of movement.splits) add(split.userId, split.amount)
  } else if (!movement.paidWithCard) {
    for (const split of movement.splits) add(split.userId, -split.amount)
  }
  return effects
}

/** Cuánto cambia lo que cada persona tiene por pagar de tarjeta con un movimiento. */
export function cardEffects(movement: Movement): Map<string, number> {
  const effects = new Map<string, number>()
  if (movement.status !== 'active') return effects
  if (movement.kind === 'card_payment') effects.set(movement.userId, -movement.amount)
  else if (movement.kind === 'expense' && movement.paidWithCard)
    for (const split of movement.splits)
      effects.set(split.userId, (effects.get(split.userId) ?? 0) + split.amount)
  return effects
}

export const availableEffect = (movement: Movement, userId: string) =>
  availableEffects(movement).get(userId) ?? 0

export interface AvailableSummary {
  userId: string
  /** Saldo con el que llegó al periodo (todo lo anterior a range.from). */
  carried: number
  /** Su parte de los ingresos del periodo. */
  incomes: number
  /** Su parte de los gastos del periodo sin tarjeta, los pagara quien los pagara. */
  share: number
  /** Su parte de los gastos del periodo con tarjeta (aún no baja el saldo). */
  cardCharged: number
  /** Lo que abonó a la tarjeta en el periodo. */
  cardPaid: number
  received: number
  sent: number
  /** carried + incomes − share − cardPaid + received − sent. */
  balance: number
  /** Lo que le queda por pagar de tarjeta al cierre del periodo (todo el historial). */
  cardPending: number
}

/** Saldo disponible de cada persona al cierre del periodo, con lo que pasó dentro de él. */
export function availableSummary(
  movements: ReadonlyArray<Movement>,
  memberIds: ReadonlyArray<string>,
  range: DateRange,
): AvailableSummary[] {
  const people = new Map<string, AvailableSummary>()
  const person = (userId: string) => {
    let entry = people.get(userId)
    if (!entry) {
      entry = {
        userId,
        carried: 0,
        incomes: 0,
        share: 0,
        cardCharged: 0,
        cardPaid: 0,
        received: 0,
        sent: 0,
        balance: 0,
        cardPending: 0,
      }
      people.set(userId, entry)
    }
    return entry
  }
  for (const id of memberIds) person(id)

  for (const movement of movements) {
    if (movement.status !== 'active' || movement.date > range.to) continue
    for (const [userId, effect] of cardEffects(movement)) person(userId).cardPending += effect
    if (movement.date < range.from) {
      for (const [userId, effect] of availableEffects(movement)) person(userId).carried += effect
      continue
    }
    if (!inRange(movement.date, range)) continue
    if (movement.kind === 'transfer') {
      person(movement.fromUser).sent += movement.amount
      person(movement.toUser).received += movement.amount
    } else if (movement.kind === 'card_payment') {
      person(movement.userId).cardPaid += movement.amount
    } else {
      for (const split of movement.splits) {
        const entry = person(split.userId)
        if (movement.kind === 'income') entry.incomes += split.amount
        else if (movement.paidWithCard) entry.cardCharged += split.amount
        else entry.share += split.amount
      }
    }
  }

  for (const entry of people.values())
    entry.balance =
      entry.carried + entry.incomes - entry.share - entry.cardPaid + entry.received - entry.sent
  return [...people.values()]
}

/**
 * Cuánto del saldo de otros está usando `userId`: lo que le falta (saldo negativo), hasta donde
 * alcance lo que les sobra a los demás. 0 si su saldo no es negativo.
 */
export function usingFromOthers(people: ReadonlyArray<AvailableSummary>, userId: string): number {
  const me = people.find((person) => person.userId === userId)
  if (!me || me.balance >= 0) return 0
  const spare = people
    .filter((person) => person.userId !== userId && person.balance > 0)
    .reduce((sum, person) => sum + person.balance, 0)
  return Math.min(-me.balance, spare)
}

/**
 * Libro diario con el saldo disponible de quien mira: días del más reciente al más antiguo, cada
 * uno con su saldo al cierre. Los movimientos deben venir del más reciente al más antiguo (como
 * los da el servicio). Mismo formato que buildLedger, para anotarlo con annotateLedger.
 */
export function buildAvailableLedger(
  movements: ReadonlyArray<Movement>,
  viewerId: string,
  options: { includeVoided?: boolean } = {},
): LedgerDay[] {
  let running = 0
  for (const movement of movements) running += availableEffect(movement, viewerId)

  const days: LedgerDay[] = []
  for (const movement of movements) {
    const effect = availableEffect(movement, viewerId)
    let day = days.at(-1)
    if (!day || day.date !== movement.date) {
      day = { date: movement.date, closingBalance: running, entries: [] }
      days.push(day)
    }
    running -= effect
    if (movement.status === 'active' || options.includeVoided)
      day.entries.push({ movement, effect })
  }
  return days.filter((day) => day.entries.length > 0)
}

/** Lo que cada persona tiene por pagar de tarjeta, contando todo el historial activo. */
export function cardPendingByPerson(movements: ReadonlyArray<Movement>): Map<string, number> {
  const pending = new Map<string, number>()
  for (const movement of movements)
    for (const [userId, effect] of cardEffects(movement))
      pending.set(userId, (pending.get(userId) ?? 0) + effect)
  return pending
}
