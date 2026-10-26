import { describe, expect, it } from 'vitest'
import { parseBill } from './billPdf'

describe('lectura aproximada de recibos', () => {
  it('toma el total y la fecha límite en la misma línea', () => {
    expect(
      parseBill(['Empresa de Energía', 'Total a pagar $ 182.450,00', 'Pague hasta 12/11/2026']),
    ).toEqual({ amount: 182_450, dueDate: '2026-11-12' })
  })
  it('acepta el valor en la línea siguiente y fechas con mes en palabras', () => {
    expect(parseBill(['VALOR A PAGAR', '$95.300', 'Fecha de vencimiento 05 nov 2026'])).toEqual({
      amount: 95_300,
      dueDate: '2026-11-05',
    })
    expect(parseBill(['Vence: 7 de noviembre de 2026'])).toEqual({ dueDate: '2026-11-07' })
  })
  it('devuelve null si no entiende nada', () => {
    expect(parseBill(['Hola', 'sin datos'])).toBeNull()
  })
})
