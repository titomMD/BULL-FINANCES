import { describe, expect, it } from 'vitest'
import type { PlanItem } from '../../types/domain'
import {
  freeLeft,
  installmentOf,
  isActiveInMonth,
  monthsInclusive,
  planSummary,
  shiftMonth,
} from './plan'

let seq = 0
const item = (over: Partial<PlanItem> & Pick<PlanItem, 'kind' | 'name' | 'amount'>): PlanItem => ({
  id: `i${++seq}`,
  groupName: null,
  currency: 'COP',
  startsOn: null,
  endsOn: null,
  sortOrder: seq,
  tracked: false,
  ...over,
})

// El plan real del usuario (octubre 2026).
const fund = item({
  kind: 'income',
  name: 'Fondo semestral (cuota)',
  amount: 2_050_000,
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
})
const plan: PlanItem[] = [
  fund,
  item({ kind: 'income', name: 'Mamá', amount: 600_000 }),
  item({ kind: 'income', name: 'Mamá (extra)', amount: 150_000 }),
  item({ kind: 'income', name: 'Abuelo (bolsillos)', amount: 550_000 }),
  item({ kind: 'income', name: 'Restante mes anterior', amount: 200_000 }),
  item({ kind: 'expense', name: 'Gimnasio', amount: 120_000 }),
  item({ kind: 'expense', name: 'Gasolina', amount: 650_000 }),
  ...[21_000, 18_000, 15_000, 31_000, 31_000, 44_000, 33_000, 34_000, 66_000].map((amount, n) =>
    item({ kind: 'expense', name: `Tarjeta ${n + 1}`, groupName: 'Tarjeta', amount }),
  ),
  item({ kind: 'saving', name: 'Ahorro', amount: 1_200_000 }),
]

describe('meses', () => {
  it('suma y resta meses cruzando el año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-10', 0)).toBe('2026-10')
  })
  it('cuenta meses con ambos extremos', () => {
    expect(monthsInclusive('2026-07', '2026-12')).toBe(6)
    expect(monthsInclusive('2026-10', '2026-10')).toBe(1)
  })
})

describe('isActiveInMonth', () => {
  it('sin fechas cuenta siempre', () => {
    expect(isActiveInMonth(plan[1], '2030-01')).toBe(true)
  })
  it('con rango cuenta de su primer a su último mes', () => {
    expect(isActiveInMonth(fund, '2026-06')).toBe(false)
    expect(isActiveInMonth(fund, '2026-07')).toBe(true)
    expect(isActiveInMonth(fund, '2026-12')).toBe(true)
    expect(isActiveInMonth(fund, '2027-01')).toBe(false)
  })
})

describe('installmentOf', () => {
  it('el fondo son 6 cuotas de 2.050.000 = 12.300.000', () => {
    expect(installmentOf(fund, '2026-10')).toEqual({
      current: 4,
      total: 6,
      totalAmount: 12_300_000,
    })
  })
  it('una línea sin rango no es en cuotas; fuera del rango tampoco', () => {
    expect(installmentOf(plan[1], '2026-10')).toBeNull()
    expect(installmentOf(fund, '2027-02')).toBeNull()
  })
})

describe('planSummary', () => {
  it('octubre: ingresos 3.550.000, gastos 1.063.000, ahorro 1.200.000, Dinero mío 1.287.000', () => {
    const summary = planSummary(plan, '2026-10')
    expect(summary.totalIncome).toBe(3_550_000)
    expect(summary.totalExpenses).toBe(1_063_000)
    expect(summary.totalSavings).toBe(1_200_000)
    expect(summary.free).toBe(1_287_000)
  })
  it('agrupa los gastos de tarjeta en 293.000', () => {
    const groups = planSummary(plan, '2026-10').expenseGroups
    const card = groups.find((group) => group.name === 'Tarjeta')
    expect(card?.total).toBe(293_000)
    expect(card?.items).toHaveLength(9)
    expect(groups.filter((group) => group.name === null)).toHaveLength(2)
  })
  it('en enero ya no entra el fondo y el plan no alcanza (negativo)', () => {
    const summary = planSummary(plan, '2027-01')
    expect(summary.totalIncome).toBe(1_500_000)
    expect(summary.free).toBe(1_500_000 - 1_063_000 - 1_200_000)
    expect(summary.free).toBeLessThan(0)
  })
  it('un plan vacío da 0', () => {
    expect(planSummary([], '2026-10').free).toBe(0)
  })
})

describe('freeLeft', () => {
  it('descuenta lo gastado y suma lo que entró aparte', () => {
    expect(freeLeft(1_287_000, { periodIncomes: 0, periodExpenses: 300_000 })).toBe(987_000)
    expect(freeLeft(1_287_000, { periodIncomes: 100_000, periodExpenses: 0 })).toBe(1_387_000)
  })
})
