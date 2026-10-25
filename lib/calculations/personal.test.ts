import { describe, expect, it } from 'vitest'
import type { PersonalMovement } from '../../types/domain'
import { personalDays, personalSummary } from './personal'

const october = { from: '2026-10-01', to: '2026-10-31' }

let seq = 0
const movement = (
  kind: PersonalMovement['kind'],
  amount: number,
  date: string,
  extra: Partial<PersonalMovement> = {},
): PersonalMovement => {
  seq += 1
  return {
    id: `p-${seq}`,
    kind,
    description: 'x',
    amount,
    currency: 'COP',
    date,
    categoryId: null,
    notes: null,
    status: 'active',
    createdBy: 'a',
    createdAt: `2026-10-01T00:00:${String(seq).padStart(2, '0')}Z`,
    updatedBy: 'a',
    updatedAt: '2026-10-01T00:00:00Z',
    ...extra,
  }
}

describe('personalSummary', () => {
  it('sin movimientos todo es cero', () => {
    expect(personalSummary([], october)).toEqual({
      available: 0,
      periodIncomes: 0,
      periodExpenses: 0,
    })
  })

  it('ejemplo del usuario: gana 500.000 personales y gasta 120.000 de eso', () => {
    const summary = personalSummary(
      [movement('income', 500_000, '2026-10-05'), movement('expense', 120_000, '2026-10-10')],
      october,
    )
    expect(summary).toEqual({ available: 380_000, periodIncomes: 500_000, periodExpenses: 120_000 })
  })

  it('el disponible arrastra meses anteriores; el periodo no', () => {
    const summary = personalSummary(
      [
        movement('income', 200_000, '2026-09-20'),
        movement('expense', 50_000, '2026-09-25'),
        movement('expense', 30_000, '2026-10-02'),
      ],
      october,
    )
    expect(summary).toEqual({ available: 120_000, periodIncomes: 0, periodExpenses: 30_000 })
  })

  it('los anulados no cuentan', () => {
    const summary = personalSummary(
      [
        movement('income', 100_000, '2026-10-01'),
        movement('expense', 90_000, '2026-10-02', { status: 'voided' }),
      ],
      october,
    )
    expect(summary.available).toBe(100_000)
    expect(summary.periodExpenses).toBe(0)
  })

  it('puede quedar negativo si se gasta más de lo que entró', () => {
    expect(personalSummary([movement('expense', 10_000, '2026-10-03')], october).available).toBe(
      -10_000,
    )
  })

  it('los extremos del periodo cuentan', () => {
    const summary = personalSummary(
      [movement('income', 1, '2026-10-01'), movement('income', 2, '2026-10-31')],
      october,
    )
    expect(summary.periodIncomes).toBe(3)
  })
})

describe('personalDays', () => {
  it('agrupa por día, del más reciente al más antiguo, con el saldo al cierre', () => {
    const income = movement('income', 500_000, '2026-10-05')
    const lunch = movement('expense', 30_000, '2026-10-06')
    const taxi = movement('expense', 20_000, '2026-10-06')
    const days = personalDays([lunch, income, taxi])
    expect(days.map((day) => day.date)).toEqual(['2026-10-06', '2026-10-05'])
    expect(days[0].closing).toBe(450_000)
    expect(days[1].closing).toBe(500_000)
    // Dentro del día, lo último registrado primero.
    expect(days[0].movements.map((item) => item.id)).toEqual([taxi.id, lunch.id])
  })

  it('un anulado aparece pero no mueve el saldo', () => {
    const income = movement('income', 100_000, '2026-10-01')
    const voided = movement('expense', 40_000, '2026-10-02', { status: 'voided' })
    const days = personalDays([income, voided])
    expect(days[0].movements).toEqual([voided])
    expect(days[0].closing).toBe(100_000)
  })
})
