import { describe, expect, it } from 'vitest'
import type { CardPayment, Expense, Income, Movement, Transfer } from '../../types/domain'
import { buildLedger, calculateBalances, toBalanceInput } from './balance'
import {
  availableEffects,
  cardPendingByPerson,
  availableSummary,
  buildAvailableLedger,
  usingFromOthers,
} from './available'
import { annotateLedger, limitEntries } from './ledger'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'

let sequence = 0
const audit = () => {
  sequence += 1
  const createdAt = new Date(Date.UTC(2026, 9, 1, 0, 0, sequence)).toISOString()
  return { createdBy: A, createdAt, updatedBy: A, updatedAt: createdAt }
}

function expense(
  paidBy: string,
  amount: number,
  shares: Record<string, number>,
  extra: Partial<Expense> = {},
): Expense {
  return {
    kind: 'expense',
    id: `e${(sequence += 1)}`,
    description: 'Gasto',
    amount,
    currency: 'COP',
    date: '2026-10-01',
    categoryId: 'cat',
    paidBy,
    splitType: 'percentage',
    splits: Object.entries(shares).map(([userId, splitAmount]) => ({
      userId,
      shareBp: Math.round((splitAmount / amount) * 10000),
      amount: splitAmount,
    })),
    notes: null,
    status: 'active',
    extraCategoryIds: [],
    paidWithCard: false,
    recurringExpenseId: null,
    ...audit(),
    ...extra,
  }
}

function transfer(
  fromUser: string,
  toUser: string,
  amount: number,
  extra: Partial<Transfer> = {},
): Transfer {
  return {
    kind: 'transfer',
    id: `t${(sequence += 1)}`,
    fromUser,
    toUser,
    amount,
    currency: 'COP',
    date: '2026-10-01',
    notes: null,
    status: 'active',
    ...audit(),
    ...extra,
  }
}

function income(userId: string, amount: number, extra: Partial<Income> = {}): Income {
  return {
    kind: 'income',
    id: `i${(sequence += 1)}`,
    userId,
    source: 'Salario',
    amount,
    currency: 'COP',
    date: '2026-10-01',
    categoryId: null,
    splitType: 'equal',
    splits: [{ userId, shareBp: 10000, amount }],
    notes: null,
    status: 'active',
    ...audit(),
    ...extra,
  }
}

// Más reciente primero, como llegan de la base de datos.
const movements: Movement[] = [
  transfer(B, A, 300_000, { date: '2026-10-06' }),
  expense(B, 120_000, { [A]: 60_000, [B]: 60_000 }, { date: '2026-10-06' }),
  income(A, 3_000_000, { date: '2026-10-05' }),
  expense(A, 95_000, { [A]: 66_500, [B]: 28_500 }, { date: '2026-10-05' }),
  expense(A, 999, { [A]: 500, [B]: 499 }, { date: '2026-10-04', status: 'voided' }),
  expense(B, 44_900, { [A]: 22_450, [B]: 22_450 }, { date: '2026-09-28' }),
  expense(A, 1_000_000, { [A]: 500_000, [B]: 500_000 }, { date: '2026-09-15' }),
]

describe('annotateLedger', () => {
  const days = annotateLedger(buildLedger(movements, A, { includeVoided: true }))
  const entries = days.flatMap((day) => day.entries)

  it('el saldo después de la fila más reciente es el saldo actual', () => {
    expect(entries[0].after).toBe(calculateBalances(toBalanceInput(movements))[A])
  })

  it('cada fila encadena con la siguiente: su "antes" es el "después" de la anterior', () => {
    for (let index = 0; index < entries.length - 1; index += 1) {
      expect(entries[index].before).toBe(entries[index + 1].after)
    }
    expect(entries.at(-1)?.before).toBe(0)
  })

  it('after = before + effect en todas las filas', () => {
    for (const entry of entries) expect(entry.after).toBe(entry.before + entry.effect)
  })

  it('el abono de B a A baja el saldo de A en 300.000', () => {
    const payment = entries.find((entry) => entry.movement.kind === 'transfer')!
    expect(payment.effect).toBe(-300_000)
    expect(payment.after).toBe(payment.before - 300_000)
    expect(payment.after).toBe(entries[0].after)
  })

  it('los anulados e ingresos no mueven el saldo', () => {
    for (const entry of entries.filter(
      (item) => item.movement.kind === 'income' || item.movement.status === 'voided',
    ))
      expect(entry.before).toBe(entry.after)
  })

  it('desde el otro lado todos los saldos tienen signo opuesto', () => {
    const fromB = annotateLedger(buildLedger(movements, B, { includeVoided: true })).flatMap(
      (day) => day.entries,
    )
    expect(fromB.map((entry) => entry.after)).toEqual(entries.map((entry) => -entry.after || 0))
  })
})

describe('limitEntries', () => {
  const days = buildLedger(movements, A)

  it('corta en el número de filas pedido, aunque el último día quede a medias', () => {
    const limited = limitEntries(days, 3)
    expect(limited.flatMap((day) => day.entries)).toHaveLength(3)
    expect(limited.map((day) => day.date)).toEqual(['2026-10-06', '2026-10-05'])
    expect(limited[1].entries).toHaveLength(1)
  })

  it('no cambia los cierres de día', () => {
    const limited = limitEntries(days, 3)
    expect(limited.map((day) => day.closingBalance)).toEqual(
      days.slice(0, 2).map((day) => day.closingBalance),
    )
  })

  it('si hay menos filas que el límite devuelve todo', () => {
    expect(limitEntries(days, 100)).toEqual(days)
  })
})

describe('saldo disponible', () => {
  const october = { from: '2026-10-01', to: '2026-10-31' }

  it('el ejemplo: 100.000 cada uno y un gasto de 30.000 al 50 % deja 85.000 a cada uno', () => {
    const list: Movement[] = [
      expense(A, 30_000, { [A]: 15_000, [B]: 15_000 }, { date: '2026-10-03' }),
      income(A, 100_000, { date: '2026-10-02' }),
      income(B, 100_000, { date: '2026-10-02' }),
    ]
    const people = availableSummary(list, [A, B], october)
    expect(people.map((person) => person.balance)).toEqual([85_000, 85_000])
    // Quién pagó no importa: si lo paga B, queda igual.
    const paidByB = [{ ...list[0], paidBy: B } as Expense, ...list.slice(1)]
    expect(availableSummary(paidByB, [A, B], october).map((p) => p.balance)).toEqual([
      85_000, 85_000,
    ])
  })

  it('un gasto descuenta la parte de cada uno; una transferencia pasa saldo de uno al otro', () => {
    const spend = expense(B, 120_000, { [A]: 60_000, [B]: 60_000 })
    expect(Object.fromEntries(availableEffects(spend))).toEqual({ [A]: -60_000, [B]: -60_000 })
    expect(Object.fromEntries(availableEffects(transfer(B, A, 300_000)))).toEqual({
      [A]: 300_000,
      [B]: -300_000,
    })
    expect(availableEffects(expense(A, 999, { [A]: 999 }, { status: 'voided' })).size).toBe(0)
  })

  it('arrastra el saldo de los meses anteriores y separa lo del periodo', () => {
    const [a, b] = availableSummary(movements, [A, B], october)
    expect(a).toEqual({
      userId: A,
      carried: -522_450,
      incomes: 3_000_000,
      share: 126_500,
      cardCharged: 0,
      cardPaid: 0,
      received: 300_000,
      sent: 0,
      balance: 2_651_050,
      cardPending: 0,
    })
    expect(b).toEqual({
      userId: B,
      carried: -522_450,
      incomes: 0,
      share: 88_500,
      cardCharged: 0,
      cardPaid: 0,
      received: 0,
      sent: 300_000,
      balance: -910_950,
      cardPending: 0,
    })
  })

  it('ignora lo posterior al periodo', () => {
    const september = { from: '2026-09-01', to: '2026-09-30' }
    expect(availableSummary(movements, [A, B], september).map((p) => p.balance)).toEqual([
      -522_450, -522_450,
    ])
  })

  it('solo hay dependencia cuando el saldo se agota, y hasta donde alcance el del otro', () => {
    const people = availableSummary(movements, [A, B], october)
    expect(usingFromOthers(people, A)).toBe(0)
    expect(usingFromOthers(people, B)).toBe(910_950)
    // B queda en −360.000 pero a A solo le sobran 240.000: no puede usar más que eso.
    const short = availableSummary(movements.slice(0, 2), [A, B], october)
    expect(usingFromOthers(short, B)).toBe(240_000)
  })

  it('el libro diario encadena el saldo disponible y cierra en el saldo actual', () => {
    const entries = annotateLedger(
      buildAvailableLedger(movements, A, { includeVoided: true }),
    ).flatMap((day) => day.entries)
    expect(entries[0].after).toBe(2_651_050)
    for (let index = 0; index < entries.length - 1; index += 1)
      expect(entries[index].before).toBe(entries[index + 1].after)
    expect(entries.at(-1)?.before).toBe(0)
    const voided = entries.find((entry) => entry.movement.status === 'voided')!
    expect(voided.effect).toBe(0)
  })
})

function cardPayment(
  userId: string,
  amount: number,
  extra: Partial<CardPayment> = {},
): CardPayment {
  return {
    kind: 'card_payment',
    id: `p${(sequence += 1)}`,
    userId,
    amount,
    currency: 'COP',
    date: '2026-10-01',
    notes: null,
    status: 'active',
    ...audit(),
    ...extra,
  }
}

describe('tarjeta', () => {
  const october = { from: '2026-10-01', to: '2026-10-31' }
  const base: Movement[] = [
    income(A, 100_000, { date: '2026-10-02' }),
    income(B, 100_000, { date: '2026-10-02' }),
  ]

  it('un gasto con tarjeta no baja el saldo: queda por pagar la parte de cada uno', () => {
    const card = expense(
      A,
      30_000,
      { [A]: 15_000, [B]: 15_000 },
      {
        date: '2026-10-03',
        paidWithCard: true,
      },
    )
    const people = availableSummary([card, ...base], [A, B], october)
    expect(people.map((p) => p.balance)).toEqual([100_000, 100_000])
    expect(people.map((p) => p.cardPending)).toEqual([15_000, 15_000])
    expect(people.map((p) => p.cardCharged)).toEqual([15_000, 15_000])
    expect(people.map((p) => p.share)).toEqual([0, 0])
  })

  it('al pagar su parte, baja su saldo y lo que tiene por pagar; el otro no cambia', () => {
    const list: Movement[] = [
      cardPayment(B, 15_000, { date: '2026-10-20' }),
      expense(A, 30_000, { [A]: 15_000, [B]: 15_000 }, { date: '2026-10-03', paidWithCard: true }),
      ...base,
    ]
    const [a, b] = availableSummary(list, [A, B], october)
    expect([a.balance, a.cardPending]).toEqual([100_000, 15_000])
    expect([b.balance, b.cardPending, b.cardPaid]).toEqual([85_000, 0, 15_000])
    expect(Object.fromEntries(cardPendingByPerson(list))).toEqual({ [A]: 15_000, [B]: 0 })
  })

  it('lo pendiente se arrastra entre meses y un pago anulado no cuenta', () => {
    const list: Movement[] = [
      cardPayment(A, 15_000, { date: '2026-10-05', status: 'voided' }),
      expense(A, 30_000, { [A]: 30_000 }, { date: '2026-09-20', paidWithCard: true }),
    ]
    const [a] = availableSummary(list, [A, B], october)
    expect([a.carried, a.cardPending, a.balance]).toEqual([0, 30_000, 0])
  })
})
