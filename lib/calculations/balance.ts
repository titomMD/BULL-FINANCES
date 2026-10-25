// Motor de balance (spec §9-§11). TypeScript puro: sin React, sin red, determinista.
//
// Convención única (docs/DATABASE.md):
//   saldo(persona) = Σ gastos que pagó − Σ su parte de los gastos
//                  + Σ transferencias que envió − Σ transferencias que recibió
//   saldo > 0 → le deben dinero · saldo < 0 → debe dinero · Σ saldos = 0
// Solo cuentan los registros activos. Los ingresos no afectan el saldo.

import type { Movement, RecordStatus } from '../../types/domain'

export interface BalanceExpense {
  paidBy: string
  amount: number
  status: RecordStatus
  splits: ReadonlyArray<{ userId: string; amount: number }>
}

export interface BalanceTransfer {
  fromUser: string
  toUser: string
  amount: number
  status: RecordStatus
}

export interface BalanceInput {
  expenses: ReadonlyArray<BalanceExpense>
  transfers: ReadonlyArray<BalanceTransfer>
  /** Miembros que deben aparecer aunque no tengan movimientos. */
  memberIds?: ReadonlyArray<string>
}

export interface Debt {
  debtor: string
  creditor: string
  amount: number
}

export interface BalanceResult {
  balances: Record<string, number>
  debts: Debt[]
}

function add(balances: Record<string, number>, userId: string, amount: number) {
  balances[userId] = (balances[userId] ?? 0) + amount
}

/** Saldo neto de cada persona. */
export function calculateBalances(input: BalanceInput): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const id of input.memberIds ?? []) balances[id] = 0

  for (const expense of input.expenses) {
    if (expense.status !== 'active') continue
    add(balances, expense.paidBy, expense.amount)
    for (const split of expense.splits) add(balances, split.userId, -split.amount)
  }

  for (const transfer of input.transfers) {
    if (transfer.status !== 'active') continue
    add(balances, transfer.fromUser, transfer.amount)
    add(balances, transfer.toUser, -transfer.amount)
  }

  return balances
}

/**
 * Quién le paga a quién para quedar en cero. Con dos personas es una sola deuda; con más,
 * empareja de forma voraz al mayor deudor con el mayor acreedor (desempate por id).
 */
export function settleDebts(balances: Record<string, number>): Debt[] {
  const byAmountThenId = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : 1)

  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .sort(byAmountThenId)
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([id, amount]): [string, number] => [id, -amount])
    .sort(byAmountThenId)

  const debts: Debt[] = []
  let c = 0
  let d = 0
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c][1], debtors[d][1])
    debts.push({ debtor: debtors[d][0], creditor: creditors[c][0], amount })
    creditors[c][1] -= amount
    debtors[d][1] -= amount
    if (creditors[c][1] === 0) c += 1
    if (debtors[d][1] === 0) d += 1
  }
  return debts
}

/** Punto de entrada de la spec §10: saldos por persona y deudas resultantes. */
export function calculateBalance(input: BalanceInput): BalanceResult {
  const balances = calculateBalances(input)
  return { balances, debts: settleDebts(balances) }
}

/** Separa una lista de movimientos en la entrada del motor. */
export function toBalanceInput(
  movements: ReadonlyArray<Movement>,
  memberIds?: string[],
): BalanceInput {
  const expenses: BalanceExpense[] = []
  const transfers: BalanceTransfer[] = []
  for (const movement of movements) {
    if (movement.kind === 'expense') expenses.push(movement)
    else if (movement.kind === 'transfer') transfers.push(movement)
  }
  return { expenses, transfers, memberIds }
}

/** Cuánto cambia el saldo de `userId` por un movimiento (0 si está anulado o no le afecta). */
export function movementEffect(movement: Movement, userId: string): number {
  if (movement.status !== 'active') return 0
  switch (movement.kind) {
    case 'expense': {
      const share = movement.splits.find((split) => split.userId === userId)?.amount ?? 0
      return (movement.paidBy === userId ? movement.amount : 0) - share
    }
    case 'transfer':
      if (movement.fromUser === userId) return movement.amount
      if (movement.toUser === userId) return -movement.amount
      return 0
    case 'income':
    case 'card_payment':
      return 0
  }
}

export interface LedgerEntry {
  movement: Movement
  /** Efecto en el saldo de quien mira. */
  effect: number
}

export interface LedgerDay {
  date: string
  /** Saldo de quien mira al cierre de ese día, contando todo el historial. */
  closingBalance: number
  entries: LedgerEntry[]
}

/**
 * Libro diario: movimientos agrupados por día (más reciente primero) con el saldo de `viewerId`
 * al cierre de cada día. `movements` debe venir ordenado de más reciente a más antiguo y
 * contener el historial completo para que los cierres sean correctos; `limitDays` solo recorta
 * lo que se devuelve.
 */
export function buildLedger(
  movements: ReadonlyArray<Movement>,
  viewerId: string,
  options: { includeVoided?: boolean; limitDays?: number } = {},
): LedgerDay[] {
  let running = 0
  for (const movement of movements) running += movementEffect(movement, viewerId)

  const days: LedgerDay[] = []
  for (const movement of movements) {
    const effect = movementEffect(movement, viewerId)
    let day = days.at(-1)
    if (!day || day.date !== movement.date) {
      day = { date: movement.date, closingBalance: running, entries: [] }
      days.push(day)
    }
    running -= effect
    if (movement.status === 'active' || options.includeVoided)
      day.entries.push({ movement, effect })
  }

  const visible = days.filter((day) => day.entries.length > 0)
  return options.limitDays === undefined ? visible : visible.slice(0, options.limitDays)
}
