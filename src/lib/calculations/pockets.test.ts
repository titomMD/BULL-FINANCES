import { describe, expect, it } from 'vitest'
import type { Pocket, PocketMove } from '../../types/domain'
import {
  adjustmentFor,
  pocketBalance,
  pocketBorrowed,
  pocketLent,
  summarizePockets,
  totalInPockets,
} from './pockets'

const pocket = (id: string, over: Partial<Pocket> = {}): Pocket => ({
  id,
  name: id,
  goal: null,
  coversReceivable: false,
  sortOrder: 0,
  archivedAt: null,
  ...over,
})
let n = 0
const move = (
  pocketId: string,
  amount: number,
  kind: PocketMove['kind'] = 'deposit',
): PocketMove => ({
  id: `m${(n += 1)}`,
  pocketId,
  amount,
  kind,
  date: '2026-10-25',
  note: null,
  linkId: null,
})

describe('bolsillos', () => {
  it('el saldo es la suma de sus movimientos', () => {
    const moves = [move('a', 1_000_000), move('a', -250_000, 'withdraw'), move('b', 5)]
    expect(pocketBalance(moves, 'a')).toBe(750_000)
  })

  it('el caso del semestre: 13.704.000 − 5.998.500 prestados + 2.000.000 devueltos = 9.705.500', () => {
    const moves = [
      move('sem', 13_704_000),
      move('sem', -5_998_500, 'loan_out'),
      move('sem', 2_000_000, 'loan_back'),
    ]
    expect(pocketBalance(moves, 'sem')).toBe(9_705_500)
    expect(pocketLent(moves, 'sem')).toBe(3_998_500)
    const [summary] = summarizePockets([pocket('sem', { goal: 13_704_000 })], moves)
    expect(summary.missing).toBe(3_998_500)
    expect(summary.lent).toBe(3_998_500)
  })

  it('lo prestado nunca baja de 0 aunque devuelvan de más', () => {
    const moves = [move('a', -100, 'loan_out'), move('a', 300, 'loan_back')]
    expect(pocketLent(moves, 'a')).toBe(0)
  })

  it('el bolsillo que recibe prestado lo ve como deuda hasta devolver', () => {
    const moves = [move('b', 500, 'loan_in'), move('b', -200, 'loan_return')]
    expect(pocketBorrowed(moves, 'b')).toBe(300)
  })

  it('avance y faltante respecto a la meta, con tope en 100 %', () => {
    const moves = [move('bata', 172_100), move('over', 3_000_000)]
    const list = summarizePockets(
      [pocket('bata', { goal: 2_000_000 }), pocket('over', { goal: 2_000_000 })],
      moves,
    )
    expect(list.find((e) => e.pocket.id === 'bata')).toMatchObject({
      missing: 1_827_900,
      progressBp: 860,
    })
    expect(list.find((e) => e.pocket.id === 'over')).toMatchObject({
      missing: 0,
      progressBp: 10_000,
    })
  })

  it('sin meta no hay avance ni faltante', () => {
    const [entry] = summarizePockets([pocket('libre')], [move('libre', 108_000)])
    expect(entry.missing).toBeNull()
    expect(entry.progressBp).toBeNull()
  })

  it('ordena por orden y nombre, y el total omite archivados', () => {
    const list = summarizePockets(
      [
        pocket('z', { sortOrder: 1 }),
        pocket('b'),
        pocket('a'),
        pocket('old', { archivedAt: '2026-01-01T00:00:00Z' }),
      ],
      [move('z', 10), move('b', 20), move('a', 30), move('old', 999)],
    )
    expect(list.map((e) => e.pocket.id)).toEqual(['a', 'b', 'old', 'z'])
    expect(totalInPockets(list)).toBe(60)
  })

  it('ajuste para igualar el saldo a Bancolombia', () => {
    expect(adjustmentFor(9_705_500, 9_700_000)).toBe(-5_500)
    expect(adjustmentFor(100, 100)).toBe(0)
  })
})
