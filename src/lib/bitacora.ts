// Importa la bitácora de «Mamá me debe» desde texto libre (pegado desde Notas, WhatsApp…).
// Cada línea «Detalle: 120.000» es un cobro; «Mamá me paga 2.000.000» es un pago; las líneas
// «Total: …» NO se importan: sirven para comprobar que la suma coincide con la bitácora.
// Puro y determinista: recibe la fecha de inicio como parámetro.

import { addDays, daysInMonth, formatDayKey, parseDay } from './dates'
import { formatMoney } from './money'

export interface BitacoraEntry {
  kind: 'charge' | 'payment'
  amount: number
  /** 'YYYY-MM-DD' */
  date: string
  note: string
}

export interface BitacoraMismatch {
  /** Número de línea (desde 1) del «Total:» que no cuadra. */
  line: number
  /** Lo que dice la bitácora. */
  written: number
  /** Lo que suman las líneas importadas. */
  computed: number
}

export interface BitacoraResult {
  entries: BitacoraEntry[]
  /** Saldo anterior a la primera línea, deducido del primer «Total:» (0 si no hay). */
  opening: number
  /** Saldo final según las líneas importadas (incluye el saldo anterior). */
  balance: number
  /** Último «Total:» escrito en la bitácora, si hay. */
  writtenTotal: number | null
  mismatches: BitacoraMismatch[]
  /** Líneas con texto que no se pudieron leer. */
  skipped: Array<{ line: number; text: string }>
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const MONTH_ABBR: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dic: 12,
}

const MONEY = /-?\d{1,3}(?:\.\d{3})+/g
const parseMoney = (token: string) => Number(token.replace(/\./g, ''))

/** Quita caracteres invisibles que dejan las listas copiadas de otras apps. */
const clean = (raw: string) =>
  raw
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()

function monthNumber(word: string): number | null {
  const lower = word.toLowerCase().replace('.', '')
  const full = MONTHS.indexOf(lower)
  if (full >= 0) return full + 1
  return MONTH_ABBR[lower] ?? null
}

/** «5 de enero», «03 noviembre», «(9 feb)» → { day, month }. */
function explicitDate(label: string): { day: number; month: number } | null {
  const match = label.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,10})\.?/i)
  if (!match) return null
  const month = monthNumber(match[2])
  const day = Number(match[1])
  return month && day >= 1 && day <= 31 ? { day, month } : null
}

// \b de JavaScript no entiende las tildes, así que los límites de palabra se arman a mano.
const WORD_END = '(?![a-záéíóúñ])'
const WORD_START = '(?<![a-záéíóúñ])'
const MOM = new RegExp(`${WORD_START}(mam[aá]|mami|madre)${WORD_END}`, 'i')
const PAYS = new RegExp(`${WORD_START}(paga|pag[oó]|da)${WORD_END}`, 'i')

const isPayment = (label: string, amount: number) =>
  amount < 0 || (MOM.test(label) && PAYS.test(label))

/**
 * @param text bitácora completa (si está repetida, se usa la última copia)
 * @param startDate fecha del primer movimiento ('YYYY-MM-DD'); da el año de partida
 * @param reconcile si un «Total:» no cuadra, agrega un ajuste por la diferencia
 */
export function parseBitacora(text: string, startDate: string, reconcile = true): BitacoraResult {
  const lines = dedupe(text).split('\n')
  const entries: BitacoraEntry[] = []
  const mismatches: BitacoraMismatch[] = []
  const skipped: Array<{ line: number; text: string }> = []
  let cursor = startDate
  let running = 0
  let opening = 0
  let sawTotal = false
  let writtenTotal: number | null = null

  // Fecha de una línea: explícita (con el año deducido del orden) o la última vista.
  const dateFor = (label: string): string => {
    const found = explicitDate(label)
    if (!found) return cursor
    const base = parseDay(cursor)
    let year = base.year
    if (found.month < base.month) year += 1
    const day = Math.min(found.day, daysInMonth(year, found.month))
    const date = formatDayKey({ year, month: found.month, day })
    cursor = date
    return date
  }

  for (let index = 0; index < lines.length; index += 1) {
    const original = clean(lines[index])
    if (!original) continue
    const number = index + 1

    const total = original.match(/^total\s*:?\s*(-?\d{1,3}(?:\.\d{3})+)\s*$/i)
    if (total) {
      const written = parseMoney(total[1])
      writtenTotal = written
      if (!sawTotal) {
        // El primer total fija el saldo anterior (lo que ya se debía antes de empezar).
        opening = written - running
        running = written
        sawTotal = true
      } else if (written !== running) {
        mismatches.push({ line: number, written, computed: running })
        if (reconcile) {
          // La suma de las líneas no coincide con el «Total:» escrito: se registra la diferencia
          // para que la libreta termine en el mismo número que tu bitácora.
          const diff = written - running
          entries.push({
            kind: diff > 0 ? 'charge' : 'payment',
            amount: Math.abs(diff),
            date: cursor,
            note: `Ajuste: la bitácora decía Total ${formatMoney(written)} y las líneas sumaban ${formatMoney(running)}`,
          })
        }
        running = written
      }
      continue
    }

    // Desglose («- Arena gatos 120.000»): ya está incluido en la línea anterior.
    if (/^[-•–]/.test(original) && entries.length > 0) {
      const last = entries[entries.length - 1]
      last.note = `${last.note} (${original.replace(/^[-•–]\s*/, '')})`.slice(0, 200)
      continue
    }

    let label = original
    let money = original.match(MONEY)
    // «Almuerzos 6 de octubre:» con el valor en la línea siguiente.
    if (!money && /:$/.test(original)) {
      const next = clean(lines[index + 1] ?? '')
      if (/^-?\d{1,3}(?:\.\d{3})+$/.test(next)) {
        money = [next]
        label = original.slice(0, -1)
        index += 1
      }
    }
    if (!money) {
      skipped.push({ line: number, text: original })
      continue
    }

    const amountSigned = parseMoney(money[0])
    const at = label.indexOf(money[0])
    const head = (at >= 0 ? label.slice(0, at) : label).replace(/[:\s]+$/, '').trim()
    const tail = at >= 0 ? label.slice(at + money[0].length).trim() : ''
    const name = head || 'Sin detalle'
    const payment = isPayment(name, amountSigned)
    const amount = Math.abs(amountSigned)
    if (amount === 0) continue
    const note = (tail ? `${name} ${tail}` : name).slice(0, 200)
    entries.push({ kind: payment ? 'payment' : 'charge', amount, date: dateFor(name), note })
    running += payment ? -amount : amount
  }

  // Si el saldo anterior es distinto de 0, se registra como primer cobro.
  const all = [...entries]
  if (opening !== 0) {
    all.unshift({
      kind: opening > 0 ? 'charge' : 'payment',
      amount: Math.abs(opening),
      date: startDate,
      note: 'Saldo anterior',
    })
  }
  const balance = all.reduce((t, e) => t + (e.kind === 'charge' ? e.amount : -e.amount), 0)
  return { entries: all, opening, balance, writtenTotal, mismatches, skipped }
}

/** Si la bitácora quedó pegada dos veces, se queda con la última copia completa. */
function dedupe(text: string): string {
  const first = text.split('\n').find((line) => clean(line))
  if (!first) return text
  const key = clean(first)
  const at = text.lastIndexOf(key)
  return at > 0 && text.indexOf(key) < at ? text.slice(at) : text
}

/** Para pruebas y vistas previas: fecha siguiente a la última del texto. */
export function dayAfter(date: string): string {
  return addDays(date, 1)
}
