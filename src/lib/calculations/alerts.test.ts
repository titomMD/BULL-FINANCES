import { describe, expect, it } from 'vitest'
import type { Movement } from '../../types/domain'
import { alertKey, spendAlerts } from './alerts'
import { summarizePeriod } from './reports'
import { A, B, expense, income, transfer } from './test-fixtures'

const october = { from: '2026-10-01', to: '2026-10-31' }
const alertsFor = (movements: Movement[], today: string, threshold = 80) =>
  spendAlerts(summarizePeriod(movements, [A, B], october), movements, today, { threshold })

describe('spendAlerts', () => {
  it('sin ingresos en el mes no hay alertas', () => {
    expect(alertsFor([expense('2026-10-02', 500_000, [250_000, 250_000])], '2026-10-20')).toEqual(
      [],
    )
  })

  it('todo en orden: sin alertas', () => {
    expect(
      alertsFor(
        [income('2026-10-01', A, 2_000_000), expense('2026-10-02', 200_000, [100_000, 100_000])],
        '2026-10-20',
      ),
    ).toEqual([])
  })

  it('"Atención" al llegar al umbral de lo que entró', () => {
    const movements = [
      income('2026-10-01', A, 1_000_000),
      income('2026-10-01', B, 1_000_000),
      expense('2026-10-25', 1_640_000, [820_000, 820_000]),
    ]
    expect(alertsFor(movements, '2026-10-28')).toEqual([
      {
        kind: 'threshold',
        percent: 82,
        spent: 1_640_000,
        incomes: 2_000_000,
        left: 360_000,
        perDay: 90_000,
      },
    ])
    // Con un umbral más alto ya no avisa.
    expect(alertsFor(movements, '2026-10-28', 90)).toEqual([])
  })

  it('"Gastando más de lo que entra" del hogar: una sola alerta, la más grave', () => {
    const movements = [
      income('2026-10-01', A, 1_000_000),
      expense('2026-10-05', 1_120_000, [560_000, 560_000]),
    ]
    expect(alertsFor(movements, '2026-10-20')).toEqual([
      { kind: 'over', userId: null, amount: 120_000 },
    ])
  })

  it('una persona en rojo aunque el hogar no lo esté (si registró ingresos)', () => {
    const movements = [
      income('2026-10-01', A, 2_000_000),
      income('2026-10-01', B, 100_000),
      expense('2026-10-05', 400_000, [200_000, 200_000]),
    ]
    expect(alertsFor(movements, '2026-10-28')).toEqual([
      { kind: 'over', userId: B, amount: 100_000 },
    ])
  })

  it('sin ingresos propios no es alarma para esa persona', () => {
    const movements = [
      income('2026-10-01', A, 2_000_000),
      expense('2026-10-05', 400_000, [200_000, 200_000]),
    ]
    expect(alertsFor(movements, '2026-10-28')).toEqual([])
  })

  it('una transferencia recibida cuenta como entrada para la persona', () => {
    const movements = [
      income('2026-10-01', A, 2_000_000),
      transfer('2026-10-02', A, B, 50_000),
      expense('2026-10-05', 400_000, [200_000, 200_000]),
    ]
    expect(alertsFor(movements, '2026-10-28')).toEqual([
      { kind: 'over', userId: B, amount: 150_000 },
    ])
  })

  it('"A este ritmo": la proyección supera lo que entró aunque aún no se haya pasado', () => {
    const movements = [
      income('2026-10-01', A, 1_000_000),
      expense('2026-10-03', 300_000, [150_000, 150_000]),
      expense('2026-10-08', 100_000, [50_000, 50_000]),
    ]
    // Día 10: 400.000 × 31 / 10 = 1.240.000 > 1.000.000.
    expect(alertsFor(movements, '2026-10-10')).toEqual([
      { kind: 'pace', projected: 1_240_000, incomes: 1_000_000, overBy: 240_000, perDay: 27_272 },
    ])
  })

  it('no proyecta los primeros días del mes', () => {
    const movements = [
      income('2026-10-01', A, 1_000_000),
      expense('2026-10-02', 200_000, [100_000, 100_000]),
    ]
    expect(alertsFor(movements, '2026-10-03')).toEqual([])
  })

  it('el arriendo recurrente no dispara la proyección por sí solo', () => {
    const movements = [
      income('2026-10-01', A, 3_000_000),
      expense('2026-10-01', 1_400_000, [700_000, 700_000], { recurringExpenseId: 'r1' }),
      expense('2026-10-05', 100_000, [50_000, 50_000]),
    ]
    expect(alertsFor(movements, '2026-10-07')).toEqual([])
  })
})

describe('alertKey', () => {
  it('cambia con el mes, el tipo y la persona', () => {
    expect(alertKey({ kind: 'over', userId: null, amount: 1 }, '2026-10-20')).toBe(
      '2026-10-01:over:hogar',
    )
    expect(alertKey({ kind: 'over', userId: B, amount: 1 }, '2026-10-20')).toBe(
      `2026-10-01:over:${B}`,
    )
    expect(
      alertKey({ kind: 'pace', projected: 2, incomes: 1, overBy: 1, perDay: 0 }, '2026-11-02'),
    ).toBe('2026-11-01:pace')
  })
})
