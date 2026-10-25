// Copiar los datos de un extracto sin teclearlos: se pega texto y se llena el formulario.
// Dos formatos: (1) JSON completo (se lo pides a Claude con la foto o el PDF del extracto) y
// (2) solo los movimientos, uno por línea: «fecha ; detalle ; valor».

import type { StatementLine } from '../types/domain'

export interface ImportedStatement {
  /** Últimos 4 dígitos, si el texto los trae. */
  last4?: string
  statementDate?: string
  dueDate?: string
  payMonth?: string
  totalDue?: number
  minimumDue?: number
  previousBalance?: number
  interest?: number
  purchases?: number
  notes?: string
  lines?: StatementLine[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const int = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined

/** «1.234.567», «$ 35.000», «35000» → entero. Null si no es un monto. */
export function parseAmountText(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits || digits.length > 14) return null
  // Un «-» al inicio o al final es un abono (valor negativo).
  return /^\s*[$\s]*-|-\s*$/.test(raw) ? -Number(digits) : Number(digits)
}

/** Acepta 2026-10-02, 02/10/2026 o 2/10/26 (día/mes/año). */
export function parseDateText(raw: string): string | null {
  const text = raw.trim()
  if (DAY.test(text)) return text
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text)
  if (!match) return null
  const [, d, m, y] = match
  const year = y.length === 2 ? `20${y}` : y
  const day = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  return DAY.test(day) && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31
    ? day
    : null
}

export function parseLinesText(text: string): StatementLine[] {
  const lines: StatementLine[] = []
  for (const row of text.split('\n')) {
    const parts = row.split(/[;\t]/).map((part) => part.trim())
    if (parts.length < 3) continue
    const date = parseDateText(parts[0])
    const amount = parseAmountText(parts.at(-1)!)
    if (!date || amount === null) continue
    lines.push({ date, detail: parts.slice(1, -1).join(' ').slice(0, 120), amount })
  }
  return lines
}

/** Devuelve lo que se pudo leer, o null si el texto no sirve. */
export function parseStatementPaste(text: string): ImportedStatement | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    let data: unknown
    try {
      data = JSON.parse(trimmed)
    } catch {
      return null
    }
    if (!data || typeof data !== 'object') return null
    const raw = data as Record<string, unknown>
    const day = (value: unknown) =>
      typeof value === 'string' && DAY.test(value) ? value : undefined
    const lines = Array.isArray(raw.lines)
      ? raw.lines.flatMap((entry): StatementLine[] => {
          if (!entry || typeof entry !== 'object') return []
          const { date, detail, amount } = entry as Record<string, unknown>
          const value =
            typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount) : undefined
          if (value === undefined) return []
          return [
            {
              date: day(date) ?? '',
              detail: typeof detail === 'string' ? detail.slice(0, 120) : '',
              amount: value,
            },
          ]
        })
      : undefined
    return {
      statementDate: day(raw.statementDate),
      dueDate: day(raw.dueDate),
      payMonth:
        typeof raw.payMonth === 'string' && MONTH.test(raw.payMonth) ? raw.payMonth : undefined,
      totalDue: int(raw.totalDue),
      minimumDue: int(raw.minimumDue),
      previousBalance: int(raw.previousBalance),
      interest: int(raw.interest),
      purchases: int(raw.purchases),
      notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : undefined,
      lines,
    }
  }
  const lines = parseLinesText(trimmed)
  return lines.length > 0 ? { lines } : null
}
