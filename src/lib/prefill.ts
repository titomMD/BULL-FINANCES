import type { DebtCurrency } from '../types/domain'
import { parseUsdInput } from './usd'

export interface Prefill {
  description: string
  /** Pesos enteros (si la moneda es COP). */
  pesos: number | null
  /** El valor tal como llegó, para mostrarlo en dólares. */
  amountText: string
  currency: DebtCurrency
  card: string
  /** Tarjeta débito (T.Deb): es dinero personal, no una tarjeta de crédito. */
  debit: boolean
  date: string | null
}

/** Lee ?monto=&desc=&tarjeta=&tipo=&moneda=&fecha= del enlace (para los atajos del iPhone). */
export function parsePrefill(params: URLSearchParams): Prefill | null {
  const raw = params.get('monto')
  if (!raw && !params.get('desc')) return null
  const currency: DebtCurrency = params.get('moneda')?.toUpperCase() === 'USD' ? 'USD' : 'COP'
  const cents = raw ? parseUsdInput(raw) : null
  const date = params.get('fecha')
  return {
    description: (params.get('desc') ?? '').slice(0, 120),
    pesos: cents === null ? null : Math.round(cents / 100),
    amountText: raw ?? '',
    currency,
    card: (params.get('tarjeta') ?? '').replace(/^\*+/, '').trim(),
    debit: /deb/i.test(params.get('tipo') ?? ''),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  }
}
