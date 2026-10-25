import { describe, expect, it } from 'vitest'
import { periodTitle, statementToText } from '../statementText'
import { buildStatement } from './statement'
import { A, B, expense, income, transfer } from './test-fixtures'

const october = { from: '2026-10-01', to: '2026-10-31' }
const movements = [
  income('2026-10-01', A, 2_000_000),
  income('2026-10-02', B, 1_000_000),
  expense('2026-10-03', 300_000, [150_000, 150_000], { categoryId: 'comida' }),
  expense('2026-10-05', 100_000, [70_000, 30_000], {
    categoryId: 'transporte',
    paidBy: B,
    paidWithCard: true,
  }),
  expense('2026-10-04', 50_000, [25_000, 25_000], {
    categoryId: 'comida',
    extraCategoryIds: ['salud'],
  }),
  expense('2026-10-06', 999_000, [999_000, 0], { status: 'voided' }),
  expense('2026-09-30', 80_000, [40_000, 40_000]), // fuera del periodo
  transfer('2026-10-07', A, B, 200_000),
]

describe('buildStatement', () => {
  const statement = buildStatement(movements, [A, B], october)

  it('resume ingresos, gastos y lo que queda (transferencias aparte)', () => {
    expect(statement.totals).toEqual({
      incomes: 3_000_000,
      expenses: 450_000,
      cardExpenses: 100_000,
      transfers: 200_000,
      expenseCount: 3,
      left: 2_550_000,
    })
  })

  it('cada gasto cuenta una vez, en su categoría principal: las categorías suman el total', () => {
    expect(statement.categories.map((category) => [category.categoryId, category.total])).toEqual([
      ['comida', 350_000],
      ['transporte', 100_000],
    ])
    const sum = statement.categories.reduce((total, category) => total + category.total, 0)
    expect(sum).toBe(statement.totals.expenses)
    expect(statement.categories[0].shareBp).toBe(7778)
  })

  it('la parte de cada persona por categoría suma su parte de los gastos', () => {
    expect(statement.categories[0].byPerson).toEqual({ [A]: 175_000, [B]: 175_000 })
    for (const person of statement.people) {
      const sum = statement.categories.reduce(
        (total, category) => total + (category.byPerson[person.userId] ?? 0),
        0,
      )
      expect(sum).toBe(person.share)
    }
  })

  it('detalle en orden de fecha; sin anulados ni fuera del periodo', () => {
    expect(statement.categories[0].expenses.map((item) => item.date)).toEqual([
      '2026-10-03',
      '2026-10-04',
    ])
    expect(statement.incomes).toHaveLength(2)
    expect(statement.transfers).toHaveLength(1)
  })

  it('periodo sin movimientos', () => {
    const empty = buildStatement([], [A, B], october)
    expect(empty.categories).toEqual([])
    expect(empty.totals.left).toBe(0)
  })
})

describe('statementToText (para pedirle el informe a Claude)', () => {
  const text = statementToText(buildStatement(movements, [A, B], october), {
    household: 'Casa',
    period: periodTitle(october),
    generatedOn: '2026-10-20',
    personName: (id) => (id === A ? 'Camilo' : 'Nicolás'),
    categoryName: (id) => ({ comida: 'Comida', transporte: 'Transporte', salud: 'Salud' })[id!]!,
  })

  it('empieza con la instrucción y trae resumen, personas, categorías y detalle', () => {
    expect(text.startsWith('Hazme un informe')).toBe(true)
    expect(text).toContain('Periodo: 1 al 31 de octubre de 2026. Generado el 20 de octubre de 2026')
    expect(text).toContain('- Gastos: $450.000 (3 gastos; con tarjeta $100.000)')
    expect(text).toContain('- Queda (ingresos − gastos): +$2.550.000')
    expect(text).toContain(
      '| Camilo | $2.000.000 | $350.000 | $245.000 | $0 | $200.000 | +$1.555.000 |',
    )
    expect(text).toContain('| Comida | $350.000 | 78 % | 2 | $175.000 | $175.000 |')
    expect(text).toContain('### Transporte · $100.000')
    expect(text).toContain('pagó Nicolás con tarjeta')
    expect(text).toContain('también: Salud')
    expect(text).toContain('Camilo → Nicolás · $200.000')
    expect(text).not.toContain('999.000')
  })
})

describe('periodTitle', () => {
  it('mismo mes, meses distintos y años distintos', () => {
    expect(periodTitle({ from: '2026-10-13', to: '2026-10-19' })).toBe(
      '13 al 19 de octubre de 2026',
    )
    expect(periodTitle({ from: '2026-09-28', to: '2026-10-04' })).toBe(
      '28 de septiembre al 4 de octubre de 2026',
    )
    expect(periodTitle({ from: '2025-12-29', to: '2026-01-04' })).toBe(
      '29 de diciembre de 2025 al 4 de enero de 2026',
    )
  })
})
