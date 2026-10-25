import { describe, expect, it } from 'vitest'
import {
  chartMonths,
  compareCategories,
  incomeVsExpenseByMonth,
  monthPace,
  previousRange,
  remainingByMonth,
} from './charts'
import { periodRemaining } from './remaining'
import { summarizePeriod } from './reports'
import { A, B, expense, income, transfer } from './test-fixtures'

const october = { from: '2026-10-01', to: '2026-10-31' }

describe('periodRemaining (tarjeta de Reportes)', () => {
  it('Ingresos − Gastos = Queda, con % del ingreso gastado', () => {
    const summary = summarizePeriod(
      [income('2026-10-01', A, 1_000_000), expense('2026-10-02', 600_000, [300_000, 300_000])],
      [A, B],
      october,
    )
    expect(periodRemaining(summary)).toEqual({
      incomes: 1_000_000,
      expenses: 600_000,
      left: 400_000,
      spentBp: 6000,
    })
  })

  it('sin ingresos no hay porcentaje y las transferencias no son gasto', () => {
    const summary = summarizePeriod(
      [expense('2026-10-02', 50_000, [25_000, 25_000]), transfer('2026-10-03', A, B, 80_000)],
      [A, B],
      october,
    )
    expect(periodRemaining(summary)).toEqual({
      incomes: 0,
      expenses: 50_000,
      left: -50_000,
      spentBp: null,
    })
  })
})

describe('chartMonths', () => {
  it('al menos 6 meses terminando en el mes del periodo', () => {
    expect(chartMonths(october)).toEqual([
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ])
  })

  it('más si el periodo es más largo', () => {
    expect(chartMonths({ from: '2026-01-15', to: '2026-10-31' })).toHaveLength(10)
  })
})

describe('incomeVsExpenseByMonth', () => {
  it('suma ingresos y gastos por mes, sin transferencias ni anulados', () => {
    const rows = incomeVsExpenseByMonth(
      [
        income('2026-09-01', A, 2_000_000),
        expense('2026-09-10', 500_000, [250_000, 250_000]),
        income('2026-10-01', A, 1_000_000),
        expense('2026-10-05', 1_200_000, [600_000, 600_000]),
        expense('2026-10-06', 99_000, [99_000, 0], { status: 'voided' }),
        transfer('2026-10-07', A, B, 300_000),
      ],
      october,
    )
    expect(rows.at(-2)).toEqual({
      month: '2026-09-01',
      incomes: 2_000_000,
      expenses: 500_000,
      left: 1_500_000,
    })
    expect(rows.at(-1)).toEqual({
      month: '2026-10-01',
      incomes: 1_000_000,
      expenses: 1_200_000,
      left: -200_000,
    })
    expect(rows[0]).toEqual({ month: '2026-05-01', incomes: 0, expenses: 0, left: 0 })
  })
})

describe('remainingByMonth', () => {
  it('lo que le quedó a cada uno, con transferencias y partes del split', () => {
    const rows = remainingByMonth(
      [
        income('2026-10-01', A, 1_000_000),
        income('2026-10-01', B, 400_000),
        expense('2026-10-05', 600_000, [300_000, 300_000]),
        transfer('2026-10-07', A, B, 100_000),
      ],
      october,
      [A, B],
    )
    expect(rows.at(-1)!.byPerson).toEqual({ [A]: 600_000, [B]: 200_000 })
    // La suma por persona es igual a ingresos − gastos del hogar.
    expect(rows.at(-1)!.byPerson[A] + rows.at(-1)!.byPerson[B]).toBe(800_000)
  })
})

describe('monthPace (ritmo del mes)', () => {
  const movements = [
    income('2026-10-01', A, 3_000_000),
    // Arriendo recurrente: cuenta una sola vez en la proyección.
    expense('2026-10-01', 1_400_000, [700_000, 700_000], { recurringExpenseId: 'r1' }),
    expense('2026-10-02', 100_000, [50_000, 50_000]),
    expense('2026-10-09', 200_000, [100_000, 100_000]),
    expense('2026-10-20', 999_000, [999_000, 0]), // aún no llega
  ]

  it('acumula día a día hasta hoy y proyecta el resto', () => {
    const pace = monthPace(movements, october, '2026-10-10')
    expect(pace.month).toBe('2026-10-01')
    expect(pace.days).toBe(31)
    expect(pace.elapsed).toBe(10)
    expect(pace.incomes).toBe(3_000_000)
    expect(pace.spent).toBe(1_700_000)
    // 1.400.000 fijo + 300.000 × 31 / 10
    expect(pace.projected).toBe(1_400_000 + 930_000)
    expect(pace.points[0]).toMatchObject({ day: 1, spent: 1_400_000, projected: null })
    expect(pace.points[9]).toMatchObject({ day: 10, spent: 1_700_000, projected: 1_700_000 })
    expect(pace.points[10].spent).toBeNull()
    expect(pace.points[30]).toMatchObject({ day: 31, spent: null, projected: 2_330_000 })
  })

  it('un mes que ya terminó no proyecta', () => {
    const pace = monthPace(movements, october, '2026-11-03')
    expect(pace.elapsed).toBe(31)
    expect(pace.projected).toBe(pace.spent)
    expect(pace.spent).toBe(2_699_000)
    expect(pace.points.every((point) => point.projected === null)).toBe(true)
  })

  it('si el periodo no incluye hoy, mira el mes donde termina', () => {
    const pace = monthPace(movements, { from: '2026-09-01', to: '2026-09-30' }, '2026-10-10')
    expect(pace.month).toBe('2026-09-01')
    expect(pace.spent).toBe(0)
  })

  it('montos siempre enteros', () => {
    const pace = monthPace(
      [expense('2026-10-01', 100_001, [100_001, 0]), income('2026-10-01', A, 1)],
      october,
      '2026-10-03',
    )
    expect(pace.points.every((point) => Number.isInteger(point.projected ?? 0))).toBe(true)
  })
})

describe('previousRange', () => {
  it('mes completo → mes anterior', () => {
    expect(previousRange(october)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(previousRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('varios meses → los mismos meses antes', () => {
    expect(previousRange({ from: '2026-08-01', to: '2026-10-31' })).toEqual({
      from: '2026-05-01',
      to: '2026-07-31',
    })
  })

  it('una semana → la semana anterior', () => {
    expect(previousRange({ from: '2026-10-12', to: '2026-10-18' })).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    })
  })
})

describe('compareCategories', () => {
  it('sube, baja y aparece, ordenado por cuánto cambió', () => {
    const { previous, changes } = compareCategories(
      [
        expense('2026-09-05', 200_000, [100_000, 100_000], { categoryId: 'comida' }),
        expense('2026-09-06', 100_000, [50_000, 50_000], { categoryId: 'transporte' }),
        expense('2026-10-05', 300_000, [150_000, 150_000], { categoryId: 'comida' }),
        expense('2026-10-06', 40_000, [20_000, 20_000], { categoryId: 'transporte' }),
        expense('2026-10-07', 10_000, [5_000, 5_000], { categoryId: 'salud' }),
      ],
      october,
    )
    expect(previous).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(changes).toEqual([
      {
        categoryId: 'comida',
        current: 300_000,
        previous: 200_000,
        change: 100_000,
        changeBp: 5000,
      },
      {
        categoryId: 'transporte',
        current: 40_000,
        previous: 100_000,
        change: -60_000,
        changeBp: -6000,
      },
      { categoryId: 'salud', current: 10_000, previous: 0, change: 10_000, changeBp: null },
    ])
  })

  it('con "mi parte" usa solo la parte de quien mira', () => {
    const { changes } = compareCategories(
      [
        expense('2026-09-05', 200_000, [100_000, 100_000]),
        expense('2026-10-05', 200_000, [150_000, 50_000]),
      ],
      october,
      { userId: A },
    )
    expect(changes[0]).toMatchObject({ current: 150_000, previous: 100_000, change: 50_000 })
  })
})
