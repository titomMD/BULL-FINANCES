import { describe, expect, it } from 'vitest'
import type { Expense, Income, Movement, Transfer } from '../../types/domain'
import {
  buildLedger,
  calculateBalance,
  calculateBalances,
  movementEffect,
  settleDebts,
  toBalanceInput,
} from './balance'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'
const C = 'cccccccc-0000-4000-8000-000000000003'

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

const balanceOf = (movements: Movement[]) => calculateBalance(toBalanceInput(movements, [A, B]))

describe('calculateBalance: casos mínimos de la spec §56', () => {
  it('Caso 1: A paga 100 al 50/50 → B debe 50', () => {
    const result = balanceOf([expense(A, 100, { [A]: 50, [B]: 50 })])
    expect(result.balances).toEqual({ [A]: 50, [B]: -50 })
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 50 }])
  })

  it('Caso 2: A paga 100 al 50/50 y B paga 50 → B debe 0', () => {
    // "B paga 50" se modela como transferencia de B a A (un abono).
    const result = balanceOf([expense(A, 100, { [A]: 50, [B]: 50 }), transfer(B, A, 50)])
    expect(result.balances).toEqual({ [A]: 0, [B]: 0 })
    expect(result.debts).toEqual([])
  })

  it('Caso 3: A paga 100 al 70/30 → B debe 30', () => {
    const result = balanceOf([expense(A, 100, { [A]: 70, [B]: 30 })])
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 30 }])
  })

  it('Caso 4: A paga 100 al 50/50 y B transfiere 25 → B debe 25', () => {
    const result = balanceOf([expense(A, 100, { [A]: 50, [B]: 50 }), transfer(B, A, 25)])
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 25 }])
  })

  it('Caso 5: A paga 100 y B paga 100, ambos 50/50 → saldo 0', () => {
    const result = balanceOf([
      expense(A, 100, { [A]: 50, [B]: 50 }),
      expense(B, 100, { [A]: 50, [B]: 50 }),
    ])
    expect(result.balances).toEqual({ [A]: 0, [B]: 0 })
    expect(result.debts).toEqual([])
  })
})

describe('calculateBalance: reglas adicionales', () => {
  it('Ejemplo de la spec §9: 1.000.000 al 50/50 y abono de 300.000 → B debe 200.000', () => {
    const result = balanceOf([
      expense(A, 1_000_000, { [A]: 500_000, [B]: 500_000 }),
      transfer(B, A, 300_000),
    ])
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 200_000 }])
  })

  it('una transferencia mayor que la deuda invierte quién debe', () => {
    const result = balanceOf([expense(A, 100, { [A]: 50, [B]: 50 }), transfer(B, A, 80)])
    expect(result.debts).toEqual([{ debtor: A, creditor: B, amount: 30 }])
  })

  it('ignora movimientos anulados', () => {
    const result = balanceOf([
      expense(A, 100, { [A]: 50, [B]: 50 }),
      expense(B, 999, { [A]: 500, [B]: 499 }, { status: 'voided' }),
      transfer(B, A, 50, { status: 'voided' }),
    ])
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 50 }])
  })

  it('los ingresos no generan deuda', () => {
    const movements = [income(A, 3_000_000), income(B, 1_500_000)]
    expect(balanceOf(movements).balances).toEqual({ [A]: 0, [B]: 0 })
  })

  it('montos impares: la suma de saldos es exactamente 0', () => {
    const balances = calculateBalances(
      toBalanceInput([
        expense(B, 100_001, { [A]: 50_001, [B]: 50_000 }),
        expense(A, 95_000, { [A]: 66_500, [B]: 28_500 }),
      ]),
    )
    expect(Object.values(balances).reduce((sum, value) => sum + value, 0)).toBe(0)
  })

  it('es determinista: el orden de entrada no cambia el resultado', () => {
    const movements = [
      expense(A, 1_000_000, { [A]: 500_000, [B]: 500_000 }),
      expense(B, 120_000, { [A]: 60_000, [B]: 60_000 }),
      transfer(B, A, 300_000),
    ]
    expect(balanceOf([...movements].reverse())).toEqual(balanceOf(movements))
  })

  it('reproduce el dato de control del seed: Beto debe 266.050 a Ana', () => {
    const result = balanceOf([
      expense(A, 1_000_000, { [A]: 500_000, [B]: 500_000 }),
      expense(A, 240_000, { [A]: 120_000, [B]: 120_000 }),
      expense(A, 95_000, { [A]: 66_500, [B]: 28_500 }),
      expense(B, 120_000, { [A]: 60_000, [B]: 60_000 }),
      expense(B, 44_900, { [A]: 22_450, [B]: 22_450 }),
      transfer(B, A, 300_000),
    ])
    expect(result.debts).toEqual([{ debtor: B, creditor: A, amount: 266_050 }])
  })
})

describe('settleDebts con más de dos personas', () => {
  it('empareja deudores y acreedores sin dejar residuos', () => {
    const debts = settleDebts({ [A]: 90, [B]: -60, [C]: -30 })
    expect(debts).toEqual([
      { debtor: B, creditor: A, amount: 60 },
      { debtor: C, creditor: A, amount: 30 },
    ])
  })

  it('reparte un deudor entre varios acreedores', () => {
    expect(settleDebts({ [A]: 40, [B]: 20, [C]: -60 })).toEqual([
      { debtor: C, creditor: A, amount: 40 },
      { debtor: C, creditor: B, amount: 20 },
    ])
  })
})

describe('movementEffect', () => {
  const fifty = expense(A, 100, { [A]: 50, [B]: 50 })

  it('gasto que pagué: sube mi saldo en la parte del otro', () => {
    expect(movementEffect(fifty, A)).toBe(50)
  })

  it('gasto que pagó el otro: baja mi saldo en mi parte', () => {
    expect(movementEffect(fifty, B)).toBe(-50)
  })

  it('un pago de tarjeta no mueve el saldo entre los dos', () => {
    const payment = {
      ...transfer(A, B, 30),
      kind: 'card_payment' as const,
      userId: A,
    }
    expect(movementEffect(payment, A)).toBe(0)
    expect(movementEffect(payment, B)).toBe(0)
  })

  it('transferencia: enviar sube mi saldo, recibir lo baja', () => {
    const payment = transfer(B, A, 30)
    expect(movementEffect(payment, B)).toBe(30)
    expect(movementEffect(payment, A)).toBe(-30)
  })

  it('anulados e ingresos no tienen efecto', () => {
    expect(movementEffect({ ...fifty, status: 'voided' }, A)).toBe(0)
    expect(movementEffect(income(A, 500), A)).toBe(0)
    const shared = income(A, 1_000_000, {
      splits: [
        { userId: A, shareBp: 5000, amount: 500_000 },
        { userId: B, shareBp: 5000, amount: 500_000 },
      ],
    })
    expect(movementEffect(shared, A)).toBe(0)
    expect(movementEffect(shared, B)).toBe(0)
    expect(balanceOf([shared])).toEqual(balanceOf([]))
  })
})

describe('buildLedger', () => {
  const movements: Movement[] = [
    transfer(B, A, 300_000, { date: '2026-10-06' }),
    expense(A, 95_000, { [A]: 66_500, [B]: 28_500 }, { date: '2026-10-05' }),
    expense(B, 44_900, { [A]: 22_450, [B]: 22_450 }, { date: '2026-10-04' }),
    expense(A, 999, { [A]: 500, [B]: 499 }, { date: '2026-10-04', status: 'voided' }),
    expense(A, 1_000_000, { [A]: 500_000, [B]: 500_000 }, { date: '2026-10-01' }),
  ]

  it('cierra cada día con el saldo acumulado de quien mira', () => {
    const ledger = buildLedger(movements, A)
    expect(ledger.map((day) => [day.date, day.closingBalance])).toEqual([
      ['2026-10-06', 206_050],
      ['2026-10-05', 506_050],
      ['2026-10-04', 477_550],
      ['2026-10-01', 500_000],
    ])
  })

  it('el cierre del día más reciente es el saldo actual', () => {
    const [today] = buildLedger(movements, A)
    const balances = calculateBalances(toBalanceInput(movements))
    expect(today.closingBalance).toBe(balances[A])
  })

  it('desde el otro lado los cierres tienen signo opuesto', () => {
    const fromA = buildLedger(movements, A).map((day) => day.closingBalance)
    const fromB = buildLedger(movements, B).map((day) => day.closingBalance)
    expect(fromB).toEqual(fromA.map((value) => -value))
  })

  it('oculta anulados salvo que se pidan, sin alterar los cierres', () => {
    const hidden = buildLedger(movements, A)
    const shown = buildLedger(movements, A, { includeVoided: true })
    expect(hidden.find((day) => day.date === '2026-10-04')?.entries).toHaveLength(1)
    expect(shown.find((day) => day.date === '2026-10-04')?.entries).toHaveLength(2)
    expect(shown.map((day) => day.closingBalance)).toEqual(hidden.map((day) => day.closingBalance))
  })

  it('limitDays recorta los días devueltos sin cambiar sus cierres', () => {
    const limited = buildLedger(movements, A, { limitDays: 2 })
    expect(limited.map((day) => day.closingBalance)).toEqual([206_050, 506_050])
  })
})
