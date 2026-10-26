import { describe, expect, it } from 'vitest'
import type { PlanCheck, PlanEntry, PlanItem } from '../../types/domain'
import { buildIcs, dueDateIn, upcomingPayments } from './reminders'

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 'x',
  kind: 'expense',
  name: 'Luz',
  groupName: null,
  amount: 180_000,
  currency: 'COP',
  startsOn: null,
  endsOn: null,
  sortOrder: 0,
  tracked: true,
  dueDay: 12,
  remindDays: 3,
  ...over,
})

describe('fecha de pago', () => {
  it('se ajusta a meses cortos', () => {
    expect(dueDateIn('2026-02', 31)).toBe('2026-02-28')
    expect(dueDateIn('2026-10', 12)).toBe('2026-10-12')
  })
})

describe('próximos pagos', () => {
  const luz = item({ id: 'luz' })
  it('avisa dentro de la ventana, no antes', () => {
    expect(upcomingPayments([luz], [], [], '2026-10-08')).toHaveLength(0)
    const [p] = upcomingPayments([luz], [], [], '2026-10-09')
    expect(p).toMatchObject({ dueDate: '2026-10-12', daysLeft: 3, overdue: false })
  })
  it('marca vencido lo que ya pasó sin pagar', () => {
    const [p] = upcomingPayments([luz], [], [], '2026-10-15')
    expect(p).toMatchObject({ daysLeft: -3, overdue: true })
  })
  it('no avisa si ya se registró el recibo del mes', () => {
    const entry: PlanEntry = {
      id: 'e',
      planItemId: 'luz',
      date: '2026-10-05',
      amount: 170_000,
      note: null,
      filePath: null,
      fileName: null,
    }
    expect(upcomingPayments([luz], [], [entry], '2026-10-10')).toHaveLength(0)
  })
  it('no avisa si está marcado como pagado (línea sin registros)', () => {
    const fixed = item({ id: 'gym', tracked: false, name: 'Gimnasio' })
    const check: PlanCheck = { id: 'c', planItemId: 'gym', month: '2026-10', paidAmount: null }
    expect(upcomingPayments([fixed], [check], [], '2026-10-11')).toHaveLength(0)
    expect(upcomingPayments([fixed], [], [], '2026-10-11')).toHaveLength(1)
  })
  it('ignora líneas sin día de pago o fuera de su rango de meses', () => {
    expect(upcomingPayments([item({ dueDay: null })], [], [], '2026-10-11')).toHaveLength(0)
    expect(upcomingPayments([item({ endsOn: '2026-09-30' })], [], [], '2026-10-11')).toHaveLength(0)
  })
  it('ordena por fecha', () => {
    const a = item({ id: 'a', name: 'Agua', dueDay: 14 })
    const b = item({ id: 'b', name: 'Gas', dueDay: 12 })
    expect(upcomingPayments([a, b], [], [], '2026-10-11').map((p) => p.item.name)).toEqual([
      'Gas',
      'Agua',
    ])
  })
})

describe('calendario .ics', () => {
  it('crea un evento mensual con alarma días antes', () => {
    const ics = buildIcs(
      [item({ id: 'luz', dueDay: 12, remindDays: 3 })],
      '2026-10-25',
      '20261025T000000Z',
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20261112')
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=12')
    expect(ics).toContain('TRIGGER:-P2DT15H')
    expect(ics).toContain('SUMMARY:Pagar Luz')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('día 31 → último día del mes, y sin día de pago no hay evento', () => {
    const ics = buildIcs(
      [item({ dueDay: 31 }), item({ id: 'z', name: 'Sin día', dueDay: null })],
      '2026-10-05',
      '20261005T000000Z',
    )
    expect(ics).toContain('BYMONTHDAY=-1')
    expect(ics).not.toContain('Sin día')
  })
})
