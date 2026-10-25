import { describe, expect, it } from 'vitest'
import { formatRate, formatUsd, parseUsdInput } from './usd'

describe('dólares', () => {
  it('lee montos en varios formatos', () => {
    expect(parseUsdInput('65,00')).toBe(6_500)
    expect(parseUsdInput('65.5')).toBe(6_550)
    expect(parseUsdInput('1.234,56')).toBe(123_456)
    expect(parseUsdInput('1,234.56')).toBe(123_456)
    expect(parseUsdInput('65')).toBe(6_500)
    expect(parseUsdInput('1.234')).toBe(123_400)
    expect(parseUsdInput('')).toBeNull()
    expect(parseUsdInput('abc')).toBeNull()
  })
  it('da formato', () => {
    expect(formatUsd(6_500)).toBe('US$ 65,00')
    expect(formatUsd(5)).toBe('US$ 0,05')
    expect(formatRate(391_245)).toBe('$ 3.912,45')
  })
})
