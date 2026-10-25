import { describe, expect, it } from 'vitest'
import type { Expense, Income, Movement, Transfer } from '../../types/domain'
import { expenseCategoryIds, expensesByCategory, monthlyExpenses, summarizePeriod } from './reports'

const A = 'a-user'
const B = 'b-user'
const audit = {
  createdBy: A,
  createdAt: '2026-10-01T00:00:00Z',
  updatedBy: A,
  updatedAt: '2026-10-01T00:00:00Z',
}

const expense = (
  date: string,
  paidBy: string,
  amount: number,
  categoryId: string,
  shares: [number, number],
  status: Expense['status'] = 'active',
): Expense => ({
  kind: 'expense',
  id: `${date}-${amount}`,
  description: 'x',
  amount,
  currency: 'COP',
  date,
  categoryId,
  paidBy,
  splitType: 'percentage',
  splits: [
    { userId: A, shareBp: 0, amount: shares[0] },
    { userId: B, shareBp: 0, amount: shares[1] },
  ],
  notes: null,
  status,
  extraCategoryIds: [],
  paidWithCard: false,
  recurringExpenseId: null,
  ...audit,
})

const income = (
  date: string,
  userId: string,
  amount: number,
  splits: Income['splits'] = [{ userId, shareBp: 10000, amount }],
): Income => ({
  kind: 'income',
  id: `i-${date}`,
  userId,
  source: 'x',
  amount,
  currency: 'COP',
  date,
  categoryId: null,
  splitType: 'equal',
  splits,
  notes: null,
  status: 'active',
  ...audit,
})

const transfer = (date: string, fromUser: string, toUser: string, amount: number): Transfer => ({
  kind: 'transfer',
  id: `t-${date}`,
  fromUser,
  toUser,
  amount,
  currency: 'COP',
  date,
  notes: null,
  status: 'active',
  ...audit,
})

const movements: Movement[] = [
  expense('2026-10-01', A, 1_000_000, 'vivienda', [500_000, 500_000]),
  expense('2026-10-03', A, 240_000, 'comida', [120_000, 120_000]),
  expense('2026-10-04', B, 120_000, 'transporte', [60_000, 60_000]),
  expense('2026-10-05', B, 50_000, 'comida', [25_000, 25_000], 'voided'),
  expense('2026-09-20', B, 80_000, 'comida', [40_000, 40_000]),
  income('2026-10-01', A, 3_200_000),
  transfer('2026-10-06', B, A, 300_000),
]

const october = { from: '2026-10-01', to: '2026-10-31' }

describe('summarizePeriod', () => {
  it('suma por persona lo pagado, su parte, ingresos y transferencias', () => {
    const summary = summarizePeriod(movements, [A, B], october)
    expect(summary.totalExpenses).toBe(1_360_000)
    expect(summary.expenseCount).toBe(3)
    expect(summary.totalIncomes).toBe(3_200_000)
    expect(summary.totalTransfers).toBe(300_000)
    expect(summary.people).toEqual([
      {
        userId: A,
        paid: 1_240_000,
        share: 680_000,
        incomes: 3_200_000,
        left: 2_820_000,
        transfersSent: 0,
        transfersReceived: 300_000,
      },
      {
        userId: B,
        paid: 120_000,
        share: 680_000,
        incomes: 0,
        left: -980_000,
        transfersSent: 300_000,
        transfersReceived: 0,
      },
    ])
  })

  it('la contribución total coincide con el total gastado', () => {
    const summary = summarizePeriod(movements, [A, B], october)
    const paid = summary.people.reduce((sum, person) => sum + person.paid, 0)
    const share = summary.people.reduce((sum, person) => sum + person.share, 0)
    expect(paid).toBe(summary.totalExpenses)
    expect(share).toBe(summary.totalExpenses)
  })
})

describe('summarizePeriod con ingresos compartidos', () => {
  it('cada persona suma su parte del ingreso, no quien lo recibió', () => {
    const shared = income('2026-10-02', A, 800_001, [
      { userId: A, shareBp: 5000, amount: 400_001 },
      { userId: B, shareBp: 5000, amount: 400_000 },
    ])
    const summary = summarizePeriod([shared], [A, B], october)
    expect(summary.totalIncomes).toBe(800_001)
    expect(summary.people.map((person) => person.incomes)).toEqual([400_001, 400_000])
  })
})

describe('summarizePeriod: lo que le queda a cada uno', () => {
  it('ingreso de 2.000.000 repartido y un gasto solo mío de 30.000', () => {
    const shared = income('2026-10-02', A, 2_000_000, [
      { userId: A, shareBp: 5000, amount: 1_000_000 },
      { userId: B, shareBp: 5000, amount: 1_000_000 },
    ])
    const mine = expense('2026-10-03', A, 30_000, 'comida', [30_000, 0])
    const people = summarizePeriod([shared, mine], [A, B], october).people
    expect(people.map((person) => person.left)).toEqual([970_000, 1_000_000])
  })

  it('un gasto compartido descuenta la parte de cada uno, sin importar quién pagó', () => {
    const shared = income('2026-10-02', A, 2_000_000, [
      { userId: A, shareBp: 5000, amount: 1_000_000 },
      { userId: B, shareBp: 5000, amount: 1_000_000 },
    ])
    const groceries = expense('2026-10-03', B, 100_000, 'comida', [50_000, 50_000])
    const people = summarizePeriod([shared, groceries], [A, B], october).people
    expect(people.map((person) => person.left)).toEqual([950_000, 950_000])
  })

  it('una transferencia pasa saldo de quien envía a quien recibe', () => {
    const withTransfer = summarizePeriod(movements, [A, B], october).people
    const without = summarizePeriod(
      movements.filter((movement) => movement.kind !== 'transfer'),
      [A, B],
      october,
    ).people
    expect(withTransfer.map((person) => person.left)).toEqual([
      without[0].left + 300_000,
      without[1].left - 300_000,
    ])
  })

  it('lo que queda entre todos = ingresos − gastos del periodo', () => {
    const summary = summarizePeriod(movements, [A, B], october)
    const left = summary.people.reduce((sum, person) => sum + person.left, 0)
    expect(left).toBe(summary.totalIncomes - summary.totalExpenses)
  })

  it('solo cuenta el periodo pedido', () => {
    const september = summarizePeriod(movements, [A, B], {
      from: '2026-09-01',
      to: '2026-09-30',
    }).people
    expect(september.map((person) => person.left)).toEqual([-40_000, -40_000])
  })
})

describe('expensesByCategory', () => {
  it('ordena de mayor a menor y los porcentajes suman exactamente 100 %', () => {
    const totals = expensesByCategory(movements, october)
    expect(totals.map((entry) => entry.categoryId)).toEqual(['vivienda', 'comida', 'transporte'])
    expect(totals.reduce((sum, entry) => sum + entry.shareBp, 0)).toBe(10000)
    expect(totals[0]).toEqual({ categoryId: 'vivienda', amount: 1_000_000, shareBp: 7353 })
  })

  it('puede calcular solo la parte de una persona', () => {
    const totals = expensesByCategory(movements, october, { userId: B })
    expect(totals.map((entry) => [entry.categoryId, entry.amount])).toEqual([
      ['vivienda', 500_000],
      ['comida', 120_000],
      ['transporte', 60_000],
    ])
  })

  it('sin gastos devuelve una lista vacía', () => {
    expect(expensesByCategory(movements, { from: '2020-01-01', to: '2020-01-31' })).toEqual([])
  })

  it('un gasto con varias categorías cuenta completo en cada una', () => {
    const mixed: Expense = {
      ...expense('2026-10-09', A, 90_000, 'comida', [45_000, 45_000]),
      extraCategoryIds: ['aseo', 'comida'],
    }
    const totals = expensesByCategory([mixed], october)
    expect(totals.map((entry) => [entry.categoryId, entry.amount])).toEqual([
      ['aseo', 90_000],
      ['comida', 90_000],
    ])
    expect(totals.reduce((sum, entry) => sum + entry.shareBp, 0)).toBe(10000)
    expect(expensesByCategory([mixed], october, { userId: B })[0].amount).toBe(45_000)
  })
})

describe('expenseCategoryIds', () => {
  it('pone primero la principal y no repite', () => {
    expect(expenseCategoryIds({ categoryId: 'a', extraCategoryIds: ['b', 'a', 'b'] })).toEqual([
      'a',
      'b',
    ])
  })
})

describe('summarizePeriod: pagado con tarjeta', () => {
  it('suma aparte lo pagado con tarjeta, solo de gastos activos del periodo', () => {
    const card = (amount: number, status: Expense['status'] = 'active'): Expense => ({
      ...expense('2026-10-10', A, amount, 'comida', [amount / 2, amount / 2], status),
      paidWithCard: true,
    })
    const summary = summarizePeriod(
      [...movements, card(40_000), card(10_000, 'voided')],
      [A, B],
      october,
    )
    expect(summary.cardExpenses).toBe(40_000)
    expect(summary.totalExpenses).toBe(1_360_000 + 40_000)
  })
})

describe('monthlyExpenses', () => {
  it('incluye meses vacíos y separa lo pagado por persona', () => {
    const months = monthlyExpenses(movements, { from: '2026-08-01', to: '2026-10-31' }, [A, B])
    expect(months).toEqual([
      { month: '2026-08-01', total: 0, byPerson: { [A]: 0, [B]: 0 } },
      { month: '2026-09-01', total: 80_000, byPerson: { [A]: 0, [B]: 80_000 } },
      { month: '2026-10-01', total: 1_360_000, byPerson: { [A]: 1_240_000, [B]: 120_000 } },
    ])
  })
})
