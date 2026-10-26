import { describe, expect, it } from 'vitest'
import type { ReceivableEntry, ReceivableRule } from '../../types/domain'
import {
  monthlyEquivalent,
  pendingCharges,
  receivableBalance,
  receivableLedger,
  ruleDates,
} from './receivables'

const entry = (
  id: string,
  kind: 'charge' | 'payment',
  amount: number,
  date: string,
): ReceivableEntry => ({ id, kind, amount, date, note: null, ruleId: null })

const rule = (over: Partial<ReceivableRule> = {}): ReceivableRule => ({
  id: 'r1',
  label: 'Almuerzos',
  amount: 120_000,
  frequency: 'weekly',
  startsOn: '2026-10-05',
  endsOn: null,
  active: true,
  generatedUntil: null,
  ...over,
})

describe('cuenta con mamá', () => {
  it('saldo = cobros − pagos', () => {
    const entries = [
      entry('a', 'charge', 5_998_500, '2026-09-01'),
      entry('b', 'payment', 2_000_000, '2026-10-10'),
    ]
    expect(receivableBalance(entries)).toBe(3_998_500)
  })

  it('la libreta muestra el saldo acumulado, lo más nuevo primero', () => {
    const rows = receivableLedger([
      entry('b', 'payment', 2_000_000, '2026-10-10'),
      entry('a', 'charge', 5_998_500, '2026-09-01'),
    ])
    expect(rows.map((r) => r.runningBalance)).toEqual([3_998_500, 5_998_500])
    expect(rows[0].entry.id).toBe('b')
  })

  it('cobro semanal: cada 7 días desde el inicio, hasta hoy', () => {
    expect(ruleDates(rule(), '2026-10-25')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
  })

  it('cobro mensual: mismo día, ajustado a meses cortos', () => {
    const monthly = rule({ frequency: 'monthly', startsOn: '2026-01-31' })
    expect(ruleDates(monthly, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('respeta el fin de la regla y que aún no haya empezado', () => {
    expect(ruleDates(rule({ endsOn: '2026-10-12' }), '2026-12-01')).toEqual([
      '2026-10-05',
      '2026-10-12',
    ])
    expect(ruleDates(rule({ startsOn: '2026-11-01' }), '2026-10-25')).toEqual([])
  })

  it('solo genera lo posterior a generatedUntil (lo borrado no vuelve)', () => {
    const pending = pendingCharges([rule({ generatedUntil: '2026-10-12' })], '2026-10-25')
    expect(pending.map((p) => p.date)).toEqual(['2026-10-19'])
    expect(pending[0]).toMatchObject({ ruleId: 'r1', amount: 120_000, note: 'Almuerzos' })
  })

  it('una regla pausada no genera cobros', () => {
    expect(pendingCharges([rule({ active: false })], '2026-10-25')).toEqual([])
  })

  it('equivalente mensual: semanal ≈ 52/12', () => {
    expect(monthlyEquivalent(rule())).toBe(520_000)
    expect(monthlyEquivalent(rule({ frequency: 'monthly', amount: 600_000 }))).toBe(600_000)
  })
})
