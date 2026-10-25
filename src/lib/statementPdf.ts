// Lee los datos de un extracto de tarjeta de Bancolombia a partir de las líneas de texto del PDF
// (ver pdfLines.ts). Conoce los dos formatos que usa el banco:
//   A) Tarjetas personales (Visa, Mastercard Joven): números «1.234.567,00», fechas «oct. 05, 2026».
//   B) Tarjeta empresarial: números «1,234,567.00», fechas «dd/mm/aaaa».
// Solo se leen los PESOS: si el extracto trae una sección en dólares, queda anotada en las notas.
// Nada de esto sale de tu navegador. Si el banco cambia el formato, devuelve null y se llena a mano.

import { formatMoney } from './money'
import type { ImportedStatement } from './statementImport'
import type { StatementLine } from '../types/domain'

export interface ParsedPdfStatement extends ImportedStatement {
  /** Últimos 4 dígitos de la tarjeta del extracto (para avisar si es de otra). */
  last4?: string
}

const MONTHS: Record<string, string> = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  set: '09',
  oct: '10',
  nov: '11',
  dic: '12',
}

const pad = (n: string) => n.padStart(2, '0')

/** «2.976.719,00» (A) o «2,976,719.00» (B), con «-» antes o después → entero en pesos. */
function amount(raw: string, style: 'A' | 'B'): number {
  const negative = raw.includes('-')
  const clean = raw.replace(/[^\d.,]/g, '')
  const decimal = style === 'A' ? ',' : '.'
  const index = clean.lastIndexOf(decimal)
  const whole = (index >= 0 ? clean.slice(0, index) : clean).replace(/[.,]/g, '')
  const fraction = index >= 0 ? clean.slice(index + 1) : '0'
  const value = Math.round(Number(`${whole || '0'}.${fraction || '0'}`))
  return negative ? -value : value
}

/** «65,00» (A) → 6500 centavos. */
function cents(raw: string): number {
  const negative = raw.includes('-')
  const value = Number(raw.replace(/\D/g, '')) || 0
  return negative ? -value : value
}

/** Cuota de manejo: suma de los movimientos que la nombran (el banco la carga como un cargo). */
function feeFrom(movements: StatementLine[] | undefined): number | undefined {
  const fees = (movements ?? []).filter((m) => /cuota\s+(de\s+)?manejo/i.test(m.detail))
  return fees.length ? fees.reduce((total, m) => total + Math.abs(m.amount), 0) : undefined
}

/** Tasa mensual vencida («2.1593 % M.V.» o «M.V. 2,1593») → millonésimas (21593). */
function monthlyRateFrom(lines: string[]): number | undefined {
  for (const line of lines) {
    const hit =
      /(\d{1,2}[.,]\d{2,4})\s*%?\s*(?:M\.?\s?V\.?|MV|mensual vencid)/i.exec(line) ??
      /(?:M\.?\s?V\.?|MV)\s*[:=]?\s*(\d{1,2}[.,]\d{2,4})/i.exec(line) ??
      // Columnas de cada movimiento: «2,1593 29,2215» = tasa M.V. y E.A.
      /(\d{1,2}[.,]\d{4})\s*%?\s+(\d{1,2}[.,]\d{4})\s*%?(?!\d)/.exec(line)
    if (hit) {
      const percent = Number(hit[1].replace(',', '.'))
      if (percent > 0 && percent < 10) return Math.round(percent * 10000)
    }
  }
  return undefined
}

const slashDate = (raw: string) => {
  const [d, m, y] = raw.split('/')
  return `${y}-${m}-${d}`
}

const NUM_A = String.raw`-?[\d.]+,\d{2}-?`
const NUM_B = String.raw`-?[\d,]+\.\d{2}-?`

function parseA(lines: string[]): ParsedPdfStatement | null {
  const result: ParsedPdfStatement = {}
  const movements: StatementLine[] = []
  const notes: string[] = []
  let currency = ''
  const dollars: { total?: string; min?: string } = {}

  for (const line of lines) {
    const moneda = /(?:Moneda|ESTADO DE CUENTA EN):\s*(PESOS|DOLARES)/i.exec(line)
    if (moneda) currency = moneda[1].toUpperCase()

    const card = /Informaci[oó]n de la Tarjeta\s*\*(\d{4})/i.exec(line)
    if (card && !result.last4) result.last4 = card[1]

    const miles = /Millas acumuladas:\s*([\d.,]+)/i.exec(line)
    if (miles) notes.push(`Millas acumuladas: ${miles[1]}`)

    const period = new RegExp(
      String.raw`(\d{1,2}) ([a-z]{3})\.? - (\d{1,2}) ([a-z]{3})\.? (\d{4}) \$\s*(${NUM_A})`,
      'i',
    ).exec(line)
    const due = new RegExp(String.raw`^([a-z]{3})\.? (\d{1,2}), (\d{4}) \$\s*(${NUM_A})`, 'i').exec(
      line,
    )

    if (currency === 'DOLARES') {
      if (period) dollars.total = period[6]
      if (due) dollars.min = due[4]
      continue
    }
    if (currency !== 'PESOS') continue

    if (period && result.totalDue === undefined) {
      const month = MONTHS[period[4].toLowerCase()]
      if (month) result.statementDate = `${period[5]}-${month}-${pad(period[3])}`
      result.totalDue = Math.max(0, amount(period[6], 'A'))
    }
    if (due && result.dueDate === undefined) {
      const month = MONTHS[due[1].toLowerCase()]
      if (month) result.dueDate = `${due[3]}-${month}-${pad(due[2])}`
      result.minimumDue = Math.max(0, amount(due[4], 'A'))
    }
    const cupo = new RegExp(String.raw`Cupo total:\s*\$\s*(${NUM_A})`, 'i').exec(line)
    if (cupo && !notes.some((n) => n.startsWith('Cupo')))
      notes.push(`Cupo total ${formatMoney(amount(cupo[1], 'A'))}`)
    const free = new RegExp(String.raw`Disponible:\s*\$\s*(${NUM_A})`, 'i').exec(line)
    if (free && !notes.some((n) => n.startsWith('Disponible')))
      notes.push(`Disponible ${formatMoney(amount(free[1], 'A'))}`)

    const field = (label: RegExp) => {
      const hit = new RegExp(String.raw`${label.source}\s*\$\s*(${NUM_A})`, 'i').exec(line)
      return hit ? Math.max(0, amount(hit[1], 'A')) : undefined
    }
    result.previousBalance ??= field(/\+ Saldo anterior/)
    result.purchases ??= field(/\+ Compras del mes/)
    result.interest ??= field(/\+ Intereses corrientes/)

    const row = new RegExp(
      String.raw`^(?:[A-Z0-9]{5,7} )?(\d{2}/\d{2}/\d{4}) (.+?) \$\s*(${NUM_A})(?: (\d+)/(\d+) \$\s*(${NUM_A}))?`,
    ).exec(line)
    if (row) {
      const installments = row[4] && Number(row[5]) > 1
      const value = installments ? amount(row[6], 'A') : amount(row[3], 'A')
      const detail = row[2].trim() + (installments ? ` (cuota ${row[4]}/${row[5]})` : '')
      movements.push({ date: slashDate(row[1]), detail: detail.slice(0, 120), amount: value })
    }
  }

  if (result.totalDue === undefined || !result.statementDate) return null
  if (dollars.total) result.usdTotalDue = Math.max(0, cents(dollars.total))
  if (dollars.min) result.usdMinimumDue = Math.max(0, cents(dollars.min))
  if (notes.length) result.notes = notes.join(' · ')
  result.lines = movements
  if (result.dueDate) result.payMonth = result.dueDate.slice(0, 7)
  return result
}

function parseB(lines: string[]): ParsedPdfStatement | null {
  const result: ParsedPdfStatement = {}
  const movements: StatementLine[] = []
  const notes: string[] = []
  let currency = ''
  let usdBalance: string | null = null
  let interest = 0
  let seenInterest = false

  for (const line of lines) {
    const state = /ESTADO DE CUENTA EN:\s*(PESOS|DOLARES)/i.exec(line)
    if (state) currency = state[1].toUpperCase()
    const card = /TARJETA:\s*\*+(\d{4})/i.exec(line)
    if (card && !result.last4) result.last4 = card[1]

    if (currency === 'DOLARES') {
      const saldo = /Saldo a favor\s+([\d.,]+)/i.exec(line)
      if (saldo && Number(saldo[1].replace(/,/g, '')) > 0) usdBalance = saldo[1]
      continue
    }
    if (currency !== 'PESOS') continue

    const period = /Hasta:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(line)
    if (period) result.statementDate = slashDate(period[1])
    const due = new RegExp(String.raw`\$\s*${NUM_B}\s+\$\s*${NUM_B}\s+(\d{2}/\d{2}/\d{4})`).exec(
      line,
    )
    if (due && !result.dueDate) result.dueDate = slashDate(due[1])
    const cupo = new RegExp(String.raw`^\$\s*(${NUM_B})\s+\$\s*${NUM_B}\s+Desde`).exec(line)
    if (cupo) notes.push(`Cupo total ${formatMoney(amount(cupo[1], 'B'))}`)

    const field = (label: string) => {
      const hit = new RegExp(String.raw`${label}\s+(${NUM_B})`, 'i').exec(line)
      return hit ? amount(hit[1], 'B') : undefined
    }
    result.previousBalance ??= field('Saldo anterior')
    if (result.previousBalance !== undefined && result.previousBalance < 0)
      result.previousBalance = 0
    result.purchases ??= field(String.raw`\+ Compras del mes`)
    const total = field('= Pagos total')
    if (total !== undefined) result.totalDue = Math.max(0, total)
    const min = field('= Pago m[ií]nimo')
    if (min !== undefined) result.minimumDue = Math.max(0, min)
    if (!seenInterest) {
      const corrientes = field(String.raw`\+ Intereses corrientes`)
      const mora = field(String.raw`\+ Intereses de mora`)
      if (corrientes !== undefined || mora !== undefined) {
        interest = (corrientes ?? 0) + (mora ?? 0)
        seenInterest = true
      }
    }

    const row = /^(?:[A-Z0-9]{5,7} )?(\d{2}\/\d{2}\/\d{4}) (.+)$/.exec(line)
    if (row) {
      const rest = row[2]
      const first = rest.search(new RegExp(NUM_B))
      if (first > 0) {
        const tokens = rest.slice(first).match(new RegExp(NUM_B, 'g')) ?? []
        const installments = /(\d+)\/(\d+)\s*$/.exec(rest)
        const billed = tokens[1] ?? tokens[0]
        let detail = rest.slice(0, first).trim()
        if (installments && Number(installments[2]) > 1)
          detail += ` (cuota ${installments[1]}/${installments[2]})`
        movements.push({
          date: slashDate(row[1]),
          detail: detail.slice(0, 120),
          amount: amount(billed, 'B'),
        })
      }
    }
  }

  if (result.totalDue === undefined || !result.statementDate) return null
  result.interest = interest
  if (usdBalance) notes.push(`Saldo a favor en dólares: US$ ${usdBalance}`)
  if (notes.length) result.notes = notes.join(' · ')
  result.lines = movements
  if (result.dueDate) result.payMonth = result.dueDate.slice(0, 7)
  return result
}

/** Null si el texto no parece un extracto de Bancolombia que sepamos leer. */
export function parseBancolombiaStatement(lines: string[]): ParsedPdfStatement | null {
  const text = lines.join('\n')
  let result: ParsedPdfStatement | null = null
  if (/Informaci[oó]n de la Tarjeta\s*\*\d{4}/i.test(text)) result = parseA(lines)
  else if (/Resumen Saldo Total/i.test(text) && /TARJETA:\s*\*+\d{4}/i.test(text))
    result = parseB(lines)
  if (!result) return null
  const fee = feeFrom(result.lines)
  if (fee !== undefined) result.feeAmount = fee
  const rate = monthlyRateFrom(lines)
  if (rate !== undefined) result.monthlyRatePpm = rate
  return result
}
