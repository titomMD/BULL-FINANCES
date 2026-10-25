// Dólares: enteros en centavos (65,00 → 6500). Tasa de cambio: pesos por dólar × 100.

import { usdToCop } from './calculations/cards'
import { formatMoney } from './money'

/** «65,00», «65.5», «1.234,56», «1,234.56», «65» → centavos, o null si no sirve. */
export function parseUsdInput(raw: string): number | null {
  const text = raw.replace(/[^\d.,]/g, '')
  if (!/\d/.test(text)) return null
  const last = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'))
  const afterLast = last >= 0 ? text.length - last - 1 : 0
  // Un solo separador con 1–2 dígitos después es decimal; con 3 es de miles.
  const decimal = last >= 0 && afterLast > 0 && afterLast <= 2
  const whole = (decimal ? text.slice(0, last) : text).replace(/[.,]/g, '')
  const fraction = decimal ? text.slice(last + 1).padEnd(2, '0') : '00'
  const cents = Number(whole || '0') * 100 + Number(fraction)
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000_000 ? cents : null
}

/** 6500 → «US$ 65,00». */
export function formatUsd(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const units = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}US$ ${units.toLocaleString('es-CO')},${rest}`
}

/** 391245 → «$ 3.912,45 por dólar». */
export function formatRate(fxCents: number): string {
  const units = Math.floor(fxCents / 100)
  return `$ ${units.toLocaleString('es-CO')},${String(fxCents % 100).padStart(2, '0')}`
}

/** «US$ 15,99 ≈ $ 62.000» con la tasa dada. */
export function usdWithCop(usdCents: number, fxCents: number | null): string {
  return fxCents
    ? `${formatUsd(usdCents)} ≈ ${formatMoney(usdToCop(usdCents, fxCents))}`
    : formatUsd(usdCents)
}
