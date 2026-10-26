import { describe, expect, it } from 'vitest'
import type { DebtPayment, DebtStatement, PlanCheck, PlanEntry, PlanItem } from '../../types/domain'
import { usdToCop } from './cards'
import { debtProgress, monthProgress, planBuckets, defaultPayMonth } from './planMonth'

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 'x',
  kind: 'expense',
  name: 'x',
  groupName: null,
  amount: 1000,
  currency: 'COP',
  startsOn: null,
  endsOn: null,
  sortOrder: 0,
  tracked: false,
  dueDay: null,
  remindDays: 3,
  ...over,
})

const plan: PlanItem[] = [
  item({ id: 'in', kind: 'income', name: 'Ingresos', amount: 3_550_000 }),
  item({ id: 'gym', name: 'Gimnasio', amount: 120_000 }),
  item({ id: 'gas', name: 'Gasolina', amount: 650_000, tracked: true }),
  item({ id: 'ic', name: 'iCloud', amount: 21_000, groupName: 'Membresías' }),
  item({ id: 'cl', name: 'Claude', amount: 66_000, groupName: 'Membresías' }),
  item({ id: 'sv', kind: 'saving', name: 'Ahorro mensual', amount: 1_200_000 }),
]
// libre = 3.550.000 − (120.000 + 650.000 + 87.000) − 1.200.000 = 1.493.000
const FREE = 1_493_000

const entry = (id: string, amount: number, date = '2026-10-05'): PlanEntry => ({
  id,
  planItemId: 'gas',
  date,
  amount,
  note: null,
  filePath: null,
  fileName: null,
})
const statement = (over: Partial<DebtStatement>): DebtStatement => ({
  id: 's',
  accountId: 'a',
  statementDate: '2026-10-15',
  dueDate: '2026-10-30',
  payMonth: '2026-10',
  totalDue: 500_000,
  minimumDue: 50_000,
  previousBalance: null,
  interest: null,
  purchases: null,
  paidAmount: 0,
  paidOn: null,
  usdTotalDue: 0,
  usdMinimumDue: 0,
  usdPaid: 0,
  feeAmount: null,
  monthlyRatePpm: null,
  notes: null,
  lines: [],
  filePath: null,
  fileName: null,
  ...over,
})

describe('monthProgress', () => {
  it('sin nada marcado: Dinero mío es lo que deja el plan', () => {
    const p = monthProgress(plan, [], [], [], '2026-10')
    expect(p.summary.free).toBe(FREE)
    expect(p.money).toBe(FREE)
    expect(p.fixedPaid).toBe(0)
    expect(p.overspend).toBe(0)
  })

  it('marcar pagado suma a lo pagado del grupo', () => {
    const checks: PlanCheck[] = [{ id: 'c', planItemId: 'ic', month: '2026-10', paidAmount: null }]
    const p = monthProgress(plan, checks, [], [], '2026-10')
    const group = p.groups.find((g) => g.name === 'Membresías')!
    expect(group.spent).toBe(21_000)
    expect(group.paidCount).toBe(1)
    expect(p.fixedPaid).toBe(21_000)
  })

  it('una marca de otro mes no cuenta', () => {
    const checks: PlanCheck[] = [{ id: 'c', planItemId: 'gym', month: '2026-09', paidAmount: null }]
    expect(monthProgress(plan, checks, [], [], '2026-10').fixedPaid).toBe(0)
  })

  it('las tanqueadas del mes se restan de la gasolina', () => {
    const p = monthProgress(plan, [], [entry('1', 200_000), entry('2', 150_000)], [], '2026-10')
    const gas = p.groups.flatMap((g) => g.items).find((i) => i.item.id === 'gas')!
    expect(gas.spent).toBe(350_000)
    expect(gas.remaining).toBe(300_000)
    expect(p.money).toBe(FREE)
  })

  it('las tanqueadas de otro mes no cuentan', () => {
    const p = monthProgress(plan, [], [entry('1', 200_000, '2026-09-30')], [], '2026-10')
    expect(p.fixedPaid).toBe(0)
  })

  it('pasarse de la gasolina se descuenta de Dinero mío', () => {
    const p = monthProgress(plan, [], [entry('1', 700_000)], [], '2026-10')
    expect(p.overspend).toBe(50_000)
    expect(p.money).toBe(FREE - 50_000)
  })

  it('los extractos pagados restan del ahorro mensual', () => {
    const p = monthProgress(
      plan,
      [],
      [],
      [
        statement({ id: 'a', paidAmount: 500_000 }),
        statement({ id: 'b', totalDue: 300_000, paidAmount: 100_000 }),
        statement({ id: 'c', payMonth: '2026-11', paidAmount: 999 }),
      ],
      '2026-10',
    )
    expect(p.debt.paid).toBe(600_000)
    expect(p.debt.due).toBe(800_000)
    expect(p.debt.pending).toBe(200_000)
    expect(p.debt.remaining).toBe(600_000)
    expect(p.money).toBe(FREE)
  })

  it('pagar más tarjetas de lo apartado baja Dinero mío', () => {
    const p = monthProgress(plan, [], [], [statement({ paidAmount: 1_300_000 })], '2026-10')
    expect(p.debt.over).toBe(100_000)
    expect(p.money).toBe(FREE - 100_000)
  })
})

describe('planBuckets', () => {
  it('arma libre, grupos y tarjetas', () => {
    const p = monthProgress(
      plan,
      [],
      [entry('1', 700_000)],
      [statement({ paidAmount: 400_000 })],
      '2026-10',
    )
    const buckets = planBuckets(p, 100_000)
    const libre = buckets.find((b) => b.key === 'libre')!
    expect(libre.planned).toBe(FREE)
    expect(libre.spent).toBe(150_000)
    expect(libre.remaining).toBe(FREE - 150_000)
    expect(buckets.find((b) => b.label === 'Gasolina')!.remaining).toBe(-50_000)
    expect(buckets.find((b) => b.kind === 'debt')!.remaining).toBe(800_000)
  })
})

describe('defaultPayMonth', () => {
  it('usa la fecha límite y, si no hay, el corte', () => {
    expect(defaultPayMonth('2026-10-28', '2026-11-12')).toBe('2026-11')
    expect(defaultPayMonth('2026-10-28', null)).toBe('2026-10')
  })
})

describe('cuota de manejo y dólares', () => {
  it('una marca con valor distinto cuenta lo realmente pagado', () => {
    const checks: PlanCheck[] = [
      { id: 'c', planItemId: 'ic', month: '2026-10', paidAmount: 17_250 },
    ]
    const p = monthProgress(plan, checks, [], [], '2026-10')
    expect(p.groups.find((g) => g.name === 'Membresías')!.spent).toBe(17_250)
  })

  it('la cuota de manejo no cuenta como pago ni como deuda de la tarjeta', () => {
    const s = statement({
      totalDue: 500_000,
      minimumDue: 60_000,
      paidAmount: 60_000,
      feeAmount: 17_250,
    })
    const d = debtProgress([s], 1_200_000, '2026-10')
    expect(d.paid).toBe(42_750)
    expect(d.due).toBe(482_750)
    expect(d.minimum).toBe(42_750)
  })

  it('los dólares pagados cuentan en pesos con la tasa de cada pago', () => {
    const s = statement({ usdTotalDue: 6_500, usdMinimumDue: 300, usdPaid: 300 })
    const pay: DebtPayment = {
      id: 'p',
      accountId: 'a',
      statementId: 's',
      currency: 'USD',
      amount: 300,
      kind: 'minimum',
      paidOn: '2026-10-05',
      fxRateCents: 390_000,
      note: null,
    }
    const d = debtProgress([s], 0, '2026-10', [pay], 400_000)
    expect(d.paid).toBe(11_700)
    expect(d.pending).toBe(500_000 + usdToCop(6_200, 400_000))
  })
})
