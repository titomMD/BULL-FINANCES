import { describe, expect, it } from 'vitest'
import { parseBitacora } from './bitacora'

const balanceOf = (entries: Array<{ kind: string; amount: number }>) =>
  entries.reduce((t, e) => t + (e.kind === 'charge' ? e.amount : -e.amount), 0)

const SAMPLE = `Mi mamá me paga: 3.500.000

Total: 487.000

Tarjeta septiembre 354.300
Parqueadero septiembre 150.000
Almuerzos 1 de septiembre: 120.000

Total: 1.111.300

Almuerzos 6 de octubre:
120.000

Total: 1.231.300

Mami me da 300.000

Total: 931.300

Almuerzos 5 enero: 120.000
Cuota tarjeta mayo: 638.000
- ⁠arena gatos 120.000
Te he prestado (9 feb) 90.000

Total: 1.779.300`

describe('parseBitacora', () => {
  it('lee cobros y pagos, y deduce el saldo anterior del primer Total', () => {
    const result = parseBitacora(SAMPLE, '2025-09-01')
    expect(result.opening).toBe(3_987_000)
    expect(result.entries[0]).toMatchObject({
      kind: 'charge',
      amount: 3_987_000,
      note: 'Saldo anterior',
    })
    expect(result.entries.filter((e) => e.kind === 'payment').map((e) => e.amount)).toEqual([
      3_500_000, 300_000,
    ])
    expect(result.balance).toBe(1_779_300)
    expect(result.writtenTotal).toBe(1_779_300)
    expect(result.mismatches).toEqual([])
  })

  it('deduce fechas y año del orden de la bitácora', () => {
    const result = parseBitacora(SAMPLE, '2025-09-01')
    const dates = Object.fromEntries(result.entries.map((e) => [e.note, e.date]))
    expect(dates['Almuerzos 1 de septiembre']).toBe('2025-09-01')
    expect(dates['Almuerzos 6 de octubre']).toBe('2025-10-06')
    expect(dates['Almuerzos 5 enero']).toBe('2026-01-05')
    expect(dates['Te he prestado (9 feb)']).toBe('2026-02-09')
  })

  it('un valor en la línea siguiente cuenta, y el desglose con guion no se suma', () => {
    const result = parseBitacora(SAMPLE, '2025-09-01')
    expect(
      result.entries.some(
        (e) => e.note.startsWith('Almuerzos 6 de octubre') && e.amount === 120_000,
      ),
    ).toBe(true)
    const card = result.entries.find((e) => e.note.startsWith('Cuota tarjeta mayo'))
    expect(card?.amount).toBe(638_000)
    expect(card?.note).toContain('arena gatos 120.000')
    expect(result.entries.filter((e) => e.amount === 120_000 && e.note.includes('arena'))).toEqual(
      [],
    )
  })

  it('si un Total no cuadra, agrega un ajuste y avisa', () => {
    const text =
      'Almuerzos 1 de septiembre: 120.000\n\nTotal: 120.000\n\nParqueadero: 150.000\n\nTotal: 230.000'
    const result = parseBitacora(text, '2025-09-01')
    expect(result.mismatches).toEqual([{ line: 7, written: 230_000, computed: 270_000 }])
    expect(result.balance).toBe(230_000)
    expect(result.entries.at(-1)).toMatchObject({ kind: 'payment', amount: 40_000 })
    expect(balanceOf(parseBitacora(text, '2025-09-01', false).entries)).toBe(270_000)
  })

  it('si la bitácora está pegada dos veces usa la última copia', () => {
    const once =
      'Mami me da 100.000\n\nTotal: 500.000\n\nAlmuerzos 1 de septiembre: 120.000\n\nTotal: 620.000'
    const result = parseBitacora(`${once}\n\n${once}`, '2025-09-01')
    expect(result.entries.filter((e) => e.kind === 'payment')).toHaveLength(1)
    expect(result.balance).toBe(620_000)
  })

  it('lista lo que no pudo leer', () => {
    const result = parseBitacora('Hola mamá\nAlmuerzos 1 de septiembre: 120.000', '2025-09-01')
    expect(result.skipped).toEqual([{ line: 1, text: 'Hola mamá' }])
  })

  it('pagos con signo negativo', () => {
    const result = parseBitacora('Mamá paga: -600.000', '2025-09-01')
    expect(result.entries[0]).toMatchObject({ kind: 'payment', amount: 600_000 })
  })
})
