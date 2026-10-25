import { describe, expect, it } from 'vitest'
import { allocateAmounts, equalShares } from './splits'

// Mismos casos que los tests pgTAP de supabase/tests/database/03_finance.test.sql: la vista
// previa debe coincidir con lo que guardará la base de datos.
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

describe('allocateAmounts', () => {
  it('50/50 de 1.000.000', () => {
    expect(allocateAmounts(1_000_000, equalShares([A, B])).map((entry) => entry.amount)).toEqual([
      500_000, 500_000,
    ])
  })

  it('70/30 de 100.000', () => {
    const result = allocateAmounts(100_000, [
      { userId: A, shareBp: 7000 },
      { userId: B, shareBp: 3000 },
    ])
    expect(result.map((entry) => entry.amount)).toEqual([70_000, 30_000])
  })

  it('montos impares: el peso sobrante va al menor user_id', () => {
    const result = allocateAmounts(100_001, equalShares([B, A]))
    expect(result).toEqual([
      { userId: A, shareBp: 5000, amount: 50_001 },
      { userId: B, shareBp: 5000, amount: 50_000 },
    ])
  })

  it('33,33 / 66,67 de 100 suma exacto', () => {
    const result = allocateAmounts(100, [
      { userId: A, shareBp: 3333 },
      { userId: B, shareBp: 6667 },
    ])
    expect(result.reduce((sum, entry) => sum + entry.amount, 0)).toBe(100)
  })

  it('tres personas en partes iguales', () => {
    const shares = equalShares([A, B, C])
    expect(shares.map((share) => share.shareBp)).toEqual([3334, 3333, 3333])
    const result = allocateAmounts(100, shares)
    expect(result.map((entry) => entry.amount)).toEqual([34, 33, 33])
  })
})
