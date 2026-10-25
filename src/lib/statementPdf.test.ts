import { describe, expect, it } from 'vitest'
import { parseBancolombiaStatement } from './statementPdf'

// Líneas inventadas con la misma forma que los extractos de Bancolombia (cifras ficticias).
const personal = `Tarjeta: *********1111
Información de la Tarjeta *1111
Millas acumuladas: 10.50
Moneda: PESOS
Cupo de tu tarjeta Información de pago en pesos
Deuda a la fecha de corte: Periodo facturado Pago Total:
17 ago - 15 sep. 2026 $ 1.000.000,00
$1.000.000,00
Pagar antes de: Pago mínimo:
Cupo total: $ 3.000.000,00
oct. 05, 2026 $ 100.000,00
Disponible: $ 500.000,00
+ Saldo anterior $ 900.000,00
+ Compras del mes $ 50.000,00
+ Intereses corrientes $ 20.000,00
Tarjeta: *********1111
ESTADO DE CUENTA EN: PESOS
15/09/2026 INTERESES CORRIENTES $ 20.000,00 $ 20.000,00 $ 0,00
C11111 03/09/2026 ABONO SUCURSAL VIRTUAL $ -300.000,00 $ -300.000,00 $ 0,00
007618 03/09/2026 TIENDA * XYZ $ 120.000,00 1/12 $ 10.000,00 2,1593 % 29,2215 % $ 110.000,00
006836 20/08/2026 FARMACIA $ 66.000,00 1/1 $ 66.000,00 0,0000 % 00,0000 % $ 0,00
Moneda: DOLARES
17 ago - 15 sep. 2026 $ 65,00
oct. 05, 2026 $ 3,00`.split('\n')

const business = `TARJETA: ************2222
ESTADO DE CUENTA EN: PESOS
Cupo Total Cupo de Avances Período Facturado
$ 1,900,000.00 $ 1,900,000.00 Desde: 30/08/2026 Hasta: 30/09/2026
Disponible Total Disponible Avances Pague antes de Valor Pagado
$ 1,400,000.00 $ 1,400,000.00 19/10/2026
Tasas de interés vigente Resumen Saldo Total Resumen Pago Mínimo
Saldo anterior 800,000.00 Saldo en mora 0.00
+ Compras del mes 400,000.00 + Cuota compras del mes 370,000.00
+ Intereses de mora 500.00 + Intereses de mora 500.00
+ Intereses corrientes 0.00 + Intereses corrientes 0.00
= Pagos total 430,000.00 = Pago mínimo 410,000.00
Resumen Saldo Total
30/09/2026 INTERESES MORA 500.00 500.00 0.00
R29532 19/09/2026 TIENDA UNO 36,000.00 2,1593 29,2215 18,000.00 18,000.00 1/2
C44940 18/09/2026 ABONO DEBITO POR MORA 800,000.00- 800,000.00- 0.00
R82141 17/09/2026 JUEGO 60,000.00 0,0000 00,0000 60,000.00 0.00 1/1`.split('\n')

describe('parseBancolombiaStatement', () => {
  it('lee el formato de tarjetas personales', () => {
    const r = parseBancolombiaStatement(personal)!
    expect(r).toMatchObject({
      last4: '1111',
      statementDate: '2026-09-15',
      dueDate: '2026-10-05',
      payMonth: '2026-10',
      totalDue: 1_000_000,
      minimumDue: 100_000,
      previousBalance: 900_000,
      purchases: 50_000,
      interest: 20_000,
    })
    expect(r.lines).toEqual([
      { date: '2026-09-15', detail: 'INTERESES CORRIENTES', amount: 20_000 },
      { date: '2026-09-03', detail: 'ABONO SUCURSAL VIRTUAL', amount: -300_000 },
      { date: '2026-09-03', detail: 'TIENDA * XYZ (cuota 1/12)', amount: 10_000 },
      { date: '2026-08-20', detail: 'FARMACIA', amount: 66_000 },
    ])
    expect(r.notes).toContain('Millas acumuladas: 10.50')
    expect(r.usdTotalDue).toBe(6_500)
    expect(r.usdMinimumDue).toBe(300)
  })

  it('lee el formato empresarial', () => {
    const r = parseBancolombiaStatement(business)!
    expect(r).toMatchObject({
      last4: '2222',
      statementDate: '2026-09-30',
      dueDate: '2026-10-19',
      totalDue: 430_000,
      minimumDue: 410_000,
      previousBalance: 800_000,
      purchases: 400_000,
    })
    expect(r.lines).toEqual([
      { date: '2026-09-30', detail: 'INTERESES MORA', amount: 500 },
      { date: '2026-09-19', detail: 'TIENDA UNO (cuota 1/2)', amount: 18_000 },
      { date: '2026-09-18', detail: 'ABONO DEBITO POR MORA', amount: -800_000 },
      { date: '2026-09-17', detail: 'JUEGO', amount: 60_000 },
    ])
  })

  it('devuelve null con un PDF que no es un extracto conocido', () => {
    expect(parseBancolombiaStatement(['Factura de luz', 'Total $ 50.000'])).toBeNull()
  })
})

describe('cuota de manejo y tasa', () => {
  it('lee la tasa mensual de las columnas del extracto empresarial', () => {
    expect(parseBancolombiaStatement(business)!.monthlyRatePpm).toBe(21_593)
  })
  it('suma la cuota de manejo cargada como movimiento', () => {
    const lines = [...personal]
    lines.splice(
      lines.findIndex((l) => l.includes('FARMACIA')),
      0,
      '000000 15/09/2026 CUOTA DE MANEJO $ 17.250,00 1/1 $ 17.250,00 0,0000 % 00,0000 % $ 0,00',
    )
    expect(parseBancolombiaStatement(lines)!.feeAmount).toBe(17_250)
  })
})
