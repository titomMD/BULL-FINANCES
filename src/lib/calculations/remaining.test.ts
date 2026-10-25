import { describe, expect, it } from 'vitest'
import type { Expense, Income, Movement, Transfer } from '../../types/domain'
import { summarizePeriod } from './reports'
import { dailyAllowance, daysLeftInMonth, householdRemaining } from './remaining'

const A = 'a-user'
const B = 'b-user'
const october = { from: '2026-10-01', to: '2026-10-31' }
const audit = {
  createdBy: A,
  createdAt: '2026-10-01T00:00:00Z',
  updatedBy: A,
  updatedAt: '2026-10-01T00:00:00Z',
}

let seq = 0
const expense = (
  paidBy: string,
  amount: number,
  shares: [number, number],
  extra: Partial<Expense> = {},
): Expense => ({
  kind: 'expense',
  id: `e-${++seq}`,
  description: 'x',
  amount,
  currency: 'COP',
  date: '2026-10-05',
  categoryId: 'comida',
  paidBy,
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

const income = (userId: string, amount: number): Income => ({
  kind: 'income',
  id: `i-${++seq}`,
  userId,
  source: 'x',
  amount,
  currency: 'COP',
  date: '2026-10-01',
  categoryId: null,
  splitType: 'equal',
  splits: [{ userId, shareBp: 10000, amount }],
  notes: null,
  status: 'active',
  ...audit,
})

const transfer = (fromUser: string, toUser: string, amount: number): Transfer => ({
  kind: 'transfer',
  id: `t-${++seq}`,
  fromUser,
  toUser,
  amount,
  currency: 'COP',
  date: '2026-10-10',
  notes: null,
  status: 'active',
  ...audit,
})

const summarize = (movements: Movement[]) => summarizePeriod(movements, [A, B], october)
const leftOf = (movements: Movement[], userId: string) =>
  summarize(movements).people.find((person) => person.userId === userId)!.left

describe('lo que queda del periodo', () => {
  it('1.000.000 de ingreso y 600.000 de gastos: quedan 400.000', () => {
    const movements = [income(A, 1_000_000), expense(A, 600_000, [600_000, 0])]
    expect(leftOf(movements, A)).toBe(400_000)
    expect(householdRemaining(summarize(movements))).toBe(400_000)
  })

  it('cuenta la parte de cada uno según el split, no quién pagó', () => {
    const movements = [
      income(A, 1_000_000),
      income(B, 1_000_000),
      expense(A, 600_000, [300_000, 300_000]),
    ]
    expect(leftOf(movements, A)).toBe(700_000)
    expect(leftOf(movements, B)).toBe(700_000)
  })

  it('una transferencia de A a B mueve el restante de cada uno y deja igual el total', () => {
    const base = [income(A, 1_000_000), income(B, 500_000), expense(A, 600_000, [300_000, 300_000])]
    const withTransfer = [...base, transfer(A, B, 100_000)]
    const before = summarize(base)
    const after = summarize(withTransfer)
    expect(leftOf(withTransfer, A)).toBe(leftOf(base, A) - 100_000)
    expect(leftOf(withTransfer, B)).toBe(leftOf(base, B) + 100_000)
    expect(householdRemaining(after)).toBe(householdRemaining(before))
    // La transferencia no es gasto.
    expect(after.totalExpenses).toBe(before.totalExpenses)
  })

  it('restante negativo cuando se gasta más de lo que entró', () => {
    const movements = [income(A, 200_000), expense(A, 500_000, [500_000, 0])]
    expect(leftOf(movements, A)).toBe(-300_000)
    expect(householdRemaining(summarize(movements))).toBe(-300_000)
  })

  it('mes sin ingresos: el restante es menos lo gastado', () => {
    const movements = [expense(B, 80_000, [40_000, 40_000])]
    expect(leftOf(movements, A)).toBe(-40_000)
    expect(leftOf(movements, B)).toBe(-40_000)
    expect(householdRemaining(summarize([]))).toBe(0)
  })

  it('los gastos con tarjeta cuentan al cargarse y los anulados no cuentan', () => {
    const movements = [
      income(A, 1_000_000),
      expense(A, 100_000, [100_000, 0], { paidWithCard: true }),
      expense(A, 50_000, [50_000, 0], { status: 'voided' }),
    ]
    expect(leftOf(movements, A)).toBe(900_000)
  })
})

describe('días y ritmo hasta fin de mes', () => {
  it('cuenta los días que faltan incluyendo hoy', () => {
    expect(daysLeftInMonth('2026-10-01')).toBe(31)
    expect(daysLeftInMonth('2026-10-31')).toBe(1)
    expect(daysLeftInMonth('2026-02-20')).toBe(9)
  })

  it('reparte lo que queda por día, en pesos enteros', () => {
    expect(dailyAllowance(400_000, '2026-10-19')).toBe(30_769)
    expect(dailyAllowance(400_000, '2026-10-31')).toBe(400_000)
    expect(Number.isInteger(dailyAllowance(100_001, '2026-10-01'))).toBe(true)
  })

  it('no hay ritmo diario si no queda nada', () => {
    expect(dailyAllowance(0, '2026-10-19')).toBe(0)
    expect(dailyAllowance(-50_000, '2026-10-19')).toBe(0)
  })
})
