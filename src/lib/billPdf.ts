// Lectura aproximada de un recibo (luz, agua, gas…) a partir del texto de su PDF. Cada empresa
// usa un formato distinto, así que esto solo SUGIERE el total y la fecha límite: siempre se
// muestran para que la persona los revise antes de guardar. Las fotos no se leen (solo se adjuntan).

import { parseUsdInput } from './usd'

export interface BillSuggestion {
  /** Total a pagar, en pesos enteros. */
  amount?: number
  /** Fecha límite 'YYYY-MM-DD'. */
  dueDate?: string
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

const AMOUNT_LABEL =
  /(total\s+a\s+pagar|valor\s+a\s+pagar|total\s+factura|valor\s+total|total\s+del\s+mes|pague\s+este\s+valor|pago\s+total|total\s+a\s+cancelar)/i
const DUE_LABEL =
  /(fecha\s+(?:l[ií]mite|de\s+vencimiento|de\s+pago|m[aá]xima)|pague\s+(?:hasta|antes\s+del?)|vence|vencimiento)/i

const pad = (n: string) => n.padStart(2, '0')

/** Pesos enteros del primer valor monetario de la línea («$ 123.456,00», «123,456»). */
function pesosIn(text: string): number | null {
  const hit = /\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{4,9}(?:[.,]\d{1,2})?)/.exec(text)
  if (!hit) return null
  const cents = parseUsdInput(hit[1])
  if (cents === null) return null
  const pesos = Math.round(cents / 100)
  return pesos > 0 ? pesos : null
}

function dateIn(text: string): string | null {
  const numeric = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text)
  if (numeric) return `${numeric[3]}-${pad(numeric[2])}-${pad(numeric[1])}`
  const worded = /(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*\.?\s*(?:de\s+)?(\d{4})/i.exec(text)
  if (worded) {
    const month = MONTHS[worded[2].toLowerCase()]
    if (month) return `${worded[3]}-${month}-${pad(worded[1])}`
  }
  return null
}

export function parseBill(lines: string[]): BillSuggestion | null {
  const result: BillSuggestion = {}
  lines.forEach((line, index) => {
    if (result.amount === undefined && AMOUNT_LABEL.test(line)) {
      // El valor puede estar en la misma línea o en la siguiente.
      const value =
        pesosIn(line.slice(line.search(AMOUNT_LABEL))) ?? pesosIn(lines[index + 1] ?? '')
      if (value) result.amount = value
    }
    if (result.dueDate === undefined && DUE_LABEL.test(line)) {
      const day = dateIn(line.slice(line.search(DUE_LABEL))) ?? dateIn(lines[index + 1] ?? '')
      if (day) result.dueDate = day
    }
  })
  return result.amount !== undefined || result.dueDate !== undefined ? result : null
}
