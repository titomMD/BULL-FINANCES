import { describe, expect, it } from 'vitest'
import {
  formatCompactMoney,
  formatAmount,
  formatMoney,
  formatMoneyInput,
  formatShare,
  formatSigned,
  parseMoneyInput,
  parsePercentToBp,
} from './money'

describe('formato de dinero (COP)', () => {
  it('usa puntos de miles y sin decimales', () => {
    expect(formatAmount(1_000_000)).toBe('1.000.000')
    expect(formatMoney(266_050)).toBe('$266.050')
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(-1500)).toBe('−$1.500')
  })

  it('formatea efectos con signo', () => {
    expect(formatSigned(66_500)).toBe('+$66.500')
    expect(formatSigned(-22_450)).toBe('−$22.450')
    expect(formatSigned(0)).toBe('$0')
  })

  it('formatea porcentajes en puntos básicos', () => {
    expect(formatShare(5000)).toBe('50 %')
    expect(formatShare(3333)).toBe('33,33 %')
  })
})

describe('parseMoneyInput', () => {
  it('acepta separadores y símbolos', () => {
    expect(parseMoneyInput('1.000.000')).toBe(1_000_000)
    expect(parseMoneyInput('$ 45 000')).toBe(45_000)
    expect(parseMoneyInput('45000')).toBe(45_000)
  })

  it('rechaza vacíos, cero y montos fuera de rango', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('0')).toBeNull()
    expect(parseMoneyInput('abc')).toBeNull()
    expect(parseMoneyInput('999999999999999999')).toBeNull()
  })

  it('formatea mientras se escribe', () => {
    expect(formatMoneyInput('1000000')).toBe('1.000.000')
    expect(formatMoneyInput('00045')).toBe('45')
    expect(formatMoneyInput('')).toBe('')
  })
})

describe('parsePercentToBp', () => {
  it('convierte porcentajes con hasta dos decimales', () => {
    expect(parsePercentToBp('70')).toBe(7000)
    expect(parsePercentToBp('33,33')).toBe(3333)
    expect(parsePercentToBp('33.3')).toBe(3330)
    expect(parsePercentToBp('100')).toBe(10000)
    expect(parsePercentToBp('0')).toBe(0)
  })

  it('rechaza valores inválidos', () => {
    expect(parsePercentToBp('101')).toBeNull()
    expect(parsePercentToBp('12,345')).toBeNull()
    expect(parsePercentToBp('-5')).toBeNull()
    expect(parsePercentToBp('')).toBeNull()
  })
})

describe('formatCompactMoney (ejes de gráficas)', () => {
  it('abrevia millones y miles', () => {
    expect(formatCompactMoney(1_234_567)).toBe('$1,2 M')
    expect(formatCompactMoney(3_000_000)).toBe('$3 M')
    expect(formatCompactMoney(45_000)).toBe('$45 mil')
    expect(formatCompactMoney(999)).toBe('$999')
    expect(formatCompactMoney(0)).toBe('$0')
  })

  it('negativos con signo menos tipográfico', () => {
    expect(formatCompactMoney(-250_000)).toBe('−$250 mil')
    expect(formatCompactMoney(-1_500_000)).toBe('−$1,5 M')
  })
})
