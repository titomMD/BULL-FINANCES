import { describe, expect, it } from 'vitest'
import type { DebtCardExpense, DebtPayment, DebtStatement } from '../../types/domain'
import {
  accruedInterest,
  cardExpenseTotals,
  currencyDue,
  dailyInterest,
  daysBetween,
  expensesSinceCut,
  interestSaved,
  interestTimeline,
  minimumBreakdown,
  nextCutDate,
  paymentTotals,
  statementDues,
  usdToCop,
} from './cards'

const RATE = 21_593 // 2,1593 % mensual

describe('intereses', () => {
  it('calcula el interés diario y el de varios días', () => {
    expect(dailyInterest(3_000_000, RATE)).toBe(2_159)
    expect(accruedInterest(3_000_000, RATE, 30)).toBe(64_779)
    expect(accruedInterest(0, RATE, 30)).toBe(0)
    expect(accruedInterest(1_000_000, 0, 30)).toBe(0)
    expect(accruedInterest(1_000_000, RATE, -3)).toBe(0)
  })

  it('días entre fechas', () => {
    expect(daysBetween('2026-10-05', '2026-10-20')).toBe(15)
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
  })

  it('el interés día a día acumula sin perder pesos', () => {
    const line = interestTimeline(3_000_000, RATE, '2026-10-05', 30)
    expect(line).toHaveLength(30)
    expect(line[0].date).toBe('2026-10-06')
    expect(line[29].accumulated).toBe(accruedInterest(3_000_000, RATE, 30))
    expect(line.reduce((t, d) => t + d.interest, 0)).toBe(line[29].accumulated)
  })

  it('interés ahorrado por un abono: nunca más que la deuda', () => {
    expect(interestSaved(500_000, 3_000_000, RATE, '2026-10-05', '2026-10-20')).toBe(
      accruedInterest(500_000, RATE, 15),
    )
    expect(interestSaved(9_000_000, 1_000_000, RATE, '2026-10-05', '2026-10-20')).toBe(
      accruedInterest(1_000_000, RATE, 15),
    )
    expect(interestSaved(500_000, 3_000_000, RATE, '2026-10-20', '2026-10-05')).toBe(0)
  })
})

describe('mínimo y cuota de manejo', () => {
  it('la cuota de manejo sale del mínimo', () => {
    expect(minimumBreakdown(243_388, 17_250)).toEqual({ debt: 226_138, fee: 17_250 })
    expect(minimumBreakdown(10_000, 17_250)).toEqual({ debt: 0, fee: 10_000 })
    expect(minimumBreakdown(243_388, null)).toEqual({ debt: 243_388, fee: 0 })
  })
})

const payment = (over: Partial<DebtPayment>): DebtPayment => ({
  id: 'p',
  accountId: 'a',
  statementId: 's',
  currency: 'COP',
  amount: 100_000,
  kind: 'extra',
  paidOn: '2026-10-05',
  fxRateCents: null,
  note: null,
  ...over,
})

describe('pagos por moneda', () => {
  it('separa pesos y dólares y convierte los dólares con su tasa', () => {
    const totals = paymentTotals([
      payment({}),
      payment({ amount: 50_000 }),
      payment({ currency: 'USD', amount: 300, fxRateCents: 390_000 }),
    ])
    expect(totals).toEqual({ cop: 150_000, usd: 300, usdAsCop: 11_700 })
  })

  it('USD a COP: US$ 3,00 a $3.900', () => {
    expect(usdToCop(300, 390_000)).toBe(11_700)
  })

  it('estado de cada moneda del extracto', () => {
    expect(currencyDue(500_000, 50_000, 60_000)).toMatchObject({
      pending: 440_000,
      minimumPending: 0,
      minimumMet: true,
    })
    expect(currencyDue(300, 300, 0)).toMatchObject({ pending: 300, minimumMet: false })
  })

  it('statementDues deja pesos y dólares por separado', () => {
    const dues = statementDues({
      totalDue: 2_976_719,
      minimumDue: 243_388,
      paidAmount: 243_388,
      usdTotalDue: 6_500,
      usdMinimumDue: 300,
      usdPaid: 0,
    } as DebtStatement)
    expect(dues.cop.minimumMet).toBe(true)
    expect(dues.usd.minimumMet).toBe(false)
    expect(dues.usd.pending).toBe(6_500)
  })
})

const expense = (over: Partial<DebtCardExpense>): DebtCardExpense => ({
  id: 'e',
  accountId: 'a',
  expenseDate: '2026-10-10',
  description: 'Rappi',
  currency: 'COP',
  amount: 40_000,
  fxRateCents: null,
  ...over,
})

describe('gastos del mes con la tarjeta', () => {
  it('suma por moneda y filtra los posteriores al corte', () => {
    const list = [
      expense({}),
      expense({ id: 'f', currency: 'USD', amount: 1_250 }),
      expense({ id: 'g', expenseDate: '2026-09-20' }),
    ]
    expect(cardExpenseTotals(list)).toEqual({ cop: 80_000, usd: 1_250 })
    expect(expensesSinceCut(list, '2026-10-01')).toHaveLength(2)
    expect(expensesSinceCut(list, null)).toHaveLength(3)
  })
})

describe('próximo corte', () => {
  it('usa el día de corte de la tarjeta', () => {
    expect(nextCutDate('2026-10-25', 15)).toBe('2026-11-15')
    expect(nextCutDate('2026-10-10', 15)).toBe('2026-10-15')
    expect(nextCutDate('2026-12-20', 5)).toBe('2027-01-05')
    expect(nextCutDate('2026-01-31', 31)).toBe('2026-02-28')
  })
  it('sin día de corte, un mes después del último extracto', () => {
    expect(nextCutDate('2026-10-25', null, '2026-09-15')).toBe('2026-10-15')
  })
})
