// Constructores de movimientos para los tests del motor (no se usa en la app).

import type { Expense, Income, Transfer } from '../../types/domain'

export const A = 'a-user'
export const B = 'b-user'

const audit = {
  createdBy: A,
  createdAt: '2026-10-01T00:00:00Z',
  updatedBy: A,
  updatedAt: '2026-10-01T00:00:00Z',
}

let seq = 0

export const expense = (
  date: string,
  amount: number,
  shares: [number, number],
  extra: Partial<Expense> = {},
): Expense => ({
  kind: 'expense',
  id: `e-${++seq}`,
  description: 'x',
  amount,
  currency: 'COP',
  date,
  categoryId: 'comida',
  paidBy: A,
  splitType: 'percentage',
  splits: [
    { userId: A, shareBp: 0, amount: shares[0] },
    { userId: B, shareBp: 0, amount: shares[1] },
  ],
  notes: null,
  status: 'active',
  extraCategoryIds: [],
  paidWithCard: false,
  recurringExpenseId: null,
  ...audit,
  ...extra,
})

export const income = (date: string, userId: string, amount: number): Income => ({
  kind: 'income',
  id: `i-${++seq}`,
  userId,
  source: 'x',
  amount,
  currency: 'COP',
  date,
  categoryId: null,
  splitType: 'equal',
  splits: [{ userId, shareBp: 10000, amount }],
  notes: null,
  status: 'active',
  ...audit,
})

export const transfer = (
  date: string,
  fromUser: string,
  toUser: string,
  amount: number,
): Transfer => ({
  kind: 'transfer',
  id: `t-${++seq}`,
  fromUser,
  toUser,
  amount,
  currency: 'COP',
  date,
  notes: null,
  status: 'active',
  ...audit,
})
