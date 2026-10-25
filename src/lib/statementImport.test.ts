import { describe, expect, it } from 'vitest'
import {
  parseAmountText,
  parseDateText,
  parseLinesText,
  parseStatementPaste,
} from './statementImport'

describe('statementImport', () => {
  it('lee montos con puntos y símbolo', () => {
    expect(parseAmountText('$ 1.234.567')).toBe(1_234_567)
    expect(parseAmountText('abc')).toBeNull()
  })

  it('lee fechas en varios formatos', () => {
    expect(parseDateText('2026-10-02')).toBe('2026-10-02')
    expect(parseDateText('2/10/26')).toBe('2026-10-02')
    expect(parseDateText('31/13/2026')).toBeNull()
    expect(parseDateText('hola')).toBeNull()
  })

  it('lee movimientos línea por línea e ignora lo que no entiende', () => {
    const lines = parseLinesText(
      '02/10/2026 ; Rappi ; 35.000\nbasura\n2026-10-05;Netflix;ok;19.900',
    )
    expect(lines).toEqual([
      { date: '2026-10-02', detail: 'Rappi', amount: 35_000 },
      { date: '2026-10-05', detail: 'Netflix ok', amount: 19_900 },
    ])
  })

  it('lee un JSON completo y descarta valores inválidos', () => {
    const parsed = parseStatementPaste(
      JSON.stringify({
        statementDate: '2026-10-15',
        dueDate: 'mañana',
        totalDue: 480000.4,
        minimumDue: -5,
        lines: [{ date: '2026-10-02', detail: 'Rappi', amount: 35000 }, { amount: 'x' }],
      }),
    )
    expect(parsed).toMatchObject({ statementDate: '2026-10-15', totalDue: 480000 })
    expect(parsed?.dueDate).toBeUndefined()
    expect(parsed?.minimumDue).toBeUndefined()
    expect(parsed?.lines).toHaveLength(1)
  })

  it('devuelve null si no sirve', () => {
    expect(parseStatementPaste('{malo')).toBeNull()
    expect(parseStatementPaste('')).toBeNull()
    expect(parseStatementPaste('nada útil')).toBeNull()
  })
})
