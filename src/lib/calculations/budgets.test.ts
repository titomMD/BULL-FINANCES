import { describe, expect, it } from 'vitest'
import type { Budget, Expense } from '../../types/domain'
import { budgetProgress, budgetRange } from './budgets'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'

let sequence = 0
function expense(
  date: string,
  shares: Record<string, number>,
  extra: Partial<Expense> = {},
): Expense {
  sequence += 1
  const amount = Object.values(shares).reduce((sum, value) => sum + value, 0)
  return {
    kind: 'expense',
    id: `e${sequence}`,
    description: 'Gasto',
    amount,
    currency: 'COP',
    date,
    categoryId: 'comida',
    extraCategoryIds: [],
    paidBy: A,
    splitType: 'percentage',
    splits: Object.entries(shares).map(([userId, value]) => ({
      userId,
      shareBp: Math.round((value / amount) * 10000),
      amount: value,
    })),
    notes: null,
    paidWithCard: false,
    status: 'active',
    recurringExpenseId: null,
    createdBy: A,
    createdAt: '2026-10-01T00:00:00Z',
    updatedBy: A,
    updatedAt: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

const budget = (extra: Partial<Budget>): Budget => ({
  id: 'b1',
  name: 'Presupuesto',
  kind: 'total',
  categoryId: null,
  amount: 100_000,
  period: 'month',
  createdAt: '2026-10-01T00:00:00Z',
  expenseIds: [],
  ...extra,
})

describe('budgetRange', () => {
  it('el mes va del 1 al último día', () => {
    expect(budgetRange('month', '2026-10-13')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('la semana va de lunes a domingo, aunque cruce de mes', () => {
    expect(budgetRange('week', '2026-10-13')).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(budgetRange('week', '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })
})

describe('budgetProgress', () => {
  const movements = [
    expense('2026-10-13', { [A]: 15_000, [B]: 15_000 }, { paidWithCard: true }),
    expense('2026-10-10', { [A]: 40_000 }, { categoryId: 'salidas', extraCategoryIds: ['comida'] }),
    expense('2026-10-05', { [B]: 50_000 }),
    expense('2026-10-04', { [A]: 99_999 }, { status: 'voided' }),
    expense('2026-09-30', { [A]: 70_000 }),
  ]

  it('tope total: suma solo mi parte de lo activo del mes, con tarjeta o sin ella', () => {
    const progress = budgetProgress(budget({}), movements, A, '2026-10-13')
    expect(progress.spent).toBe(55_000)
    expect(progress.left).toBe(45_000)
    expect(progress.expenses.map((item) => item.id)).toEqual(['e1', 'e2'])
  })

  it('por categoría: cuenta la principal y las adicionales', () => {
    const food = budget({ kind: 'category', categoryId: 'comida', amount: 50_000 })
    const progress = budgetProgress(food, movements, A, '2026-10-13')
    expect(progress.spent).toBe(55_000)
    expect(progress.left).toBe(-5_000)
  })

  it('libre semanal: solo los gastos asignados de esta semana', () => {
    const outings = budget({ kind: 'free', period: 'week', expenseIds: ['e1', 'e2'] })
    const progress = budgetProgress(outings, movements, A, '2026-10-13')
    expect(progress.range).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(progress.spent).toBe(15_000)
  })

  it('cada uno ve su propia parte', () => {
    expect(budgetProgress(budget({}), movements, B, '2026-10-13').spent).toBe(65_000)
  })
})
