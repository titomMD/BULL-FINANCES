import { describe, expect, it } from 'vitest'
import { parsePrefill } from './prefill'

const q = (s: string) => new URLSearchParams(s)

describe('gasto prellenado desde un atajo', () => {
  it('lee pesos en varios formatos', () => {
    expect(parsePrefill(q('monto=45000&desc=Rappi&tarjeta=Visa'))).toMatchObject({
      pesos: 45_000,
      description: 'Rappi',
      card: 'Visa',
      currency: 'COP',
    })
    expect(parsePrefill(q('monto=45.000,00'))!.pesos).toBe(45_000)
    expect(parsePrefill(q('monto=1,234,567.00'))!.pesos).toBe(1_234_567)
  })
  it('detecta dólares y fecha', () => {
    const r = parsePrefill(q('monto=15.99&moneda=usd&fecha=2026-10-25'))!
    expect(r.currency).toBe('USD')
    expect(r.amountText).toBe('15.99')
    expect(r.date).toBe('2026-10-25')
  })
  it('ignora fechas raras y enlaces sin datos', () => {
    expect(parsePrefill(q('monto=100&fecha=ayer'))!.date).toBeNull()
    expect(parsePrefill(q(''))).toBeNull()
  })
  it('reconoce la tarjeta débito y quita el asterisco de la tarjeta', () => {
    const r = parsePrefill(q('monto=4.800,00&desc=CEN%20CIAL&tarjeta=*0879&tipo=T.Deb'))!
    expect(r.debit).toBe(true)
    expect(r.card).toBe('0879')
    expect(r.pesos).toBe(4_800)
    expect(parsePrefill(q('monto=1&tipo=T.Cred'))!.debit).toBe(false)
  })
})
