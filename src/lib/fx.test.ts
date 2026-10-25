import { describe, expect, it } from 'vitest'
import { isFresh, parseMarketRate, parseTrm, ratioToCents } from './fx'

describe('dólar del día', () => {
  it('convierte la tasa a «pesos × 100»', () => {
    expect(ratioToCents(3912.45)).toBe(391_245)
    expect(ratioToCents('3912.45')).toBe(391_245)
    expect(ratioToCents(1.2)).toBeNull()
    expect(ratioToCents('abc')).toBeNull()
  })
  it('lee la respuesta de mercado', () => {
    expect(parseMarketRate({ result: 'success', rates: { COP: 3912.4521 } })).toBe(391_245)
    expect(parseMarketRate({ rates: {} })).toBeNull()
    expect(parseMarketRate(null)).toBeNull()
  })
  it('lee la TRM de datos.gov.co', () => {
    expect(parseTrm([{ valor: '3905.50' }])).toBe(390_550)
    expect(parseTrm([])).toBeNull()
  })
  it('sabe si la tasa guardada sigue fresca', () => {
    const rate = { cents: 1, source: 'TRM' as const, fetchedAt: '2026-10-25T10:00:00.000Z' }
    expect(isFresh(rate, Date.parse('2026-10-25T12:00:00.000Z'))).toBe(true)
    expect(isFresh(rate, Date.parse('2026-10-25T20:00:00.000Z'))).toBe(false)
  })
})
