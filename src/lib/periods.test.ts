import { describe, expect, it } from 'vitest'
import { resolvePeriod } from './periods'

const today = '2026-10-15' // jueves

describe('resolvePeriod', () => {
  it('esta semana va de lunes a domingo', () => {
    expect(resolvePeriod('week', today)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
  })

  it('semana pasada: lunes a domingo anteriores', () => {
    expect(resolvePeriod('previousWeek', today)).toEqual({ from: '2026-10-05', to: '2026-10-11' })
  })

  it('este mes y mes anterior', () => {
    expect(resolvePeriod('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolvePeriod('previousMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(resolvePeriod('previousMonth', '2026-01-10')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('últimos 3 meses incluye el mes en curso', () => {
    expect(resolvePeriod('last3Months', today)).toEqual({ from: '2026-08-01', to: '2026-10-31' })
  })

  it('rango personalizado ordena las fechas invertidas', () => {
    expect(resolvePeriod('custom', today, { from: '2026-10-10', to: '2026-10-01' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-10',
    })
  })
})
