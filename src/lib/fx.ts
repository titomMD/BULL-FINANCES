// Dólar del día en pesos. Google no ofrece una API pública, así que se consulta (sin llaves):
//   1) open.er-api.com — tasa de mercado, se actualiza una vez al día.
//   2) datos.gov.co — la TRM oficial del Banco de la República (respaldo).
// La tasa se guarda como «pesos por dólar × 100» (entero): 3.912,45 → 391245.
// El resultado se guarda en el navegador y se vuelve a pedir pasadas unas horas.

export interface DollarRate {
  /** Pesos por dólar × 100. */
  cents: number
  source: 'mercado' | 'TRM'
  /** Momento en que se consultó (ISO). */
  fetchedAt: string
}

const STORE_KEY = 'freyapp:dollar'
export const REFRESH_MS = 6 * 60 * 60 * 1000

export function ratioToCents(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 100 || number > 100_000)
    return null
  return Math.round(number * 100)
}

/** Respuesta de open.er-api.com → centavos de peso, o null. */
export function parseMarketRate(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const rates = (data as { rates?: unknown }).rates
  if (!rates || typeof rates !== 'object') return null
  return ratioToCents((rates as Record<string, unknown>).COP)
}

/** Respuesta de datos.gov.co (lista con `valor`) → centavos de peso, o null. */
export function parseTrm(data: unknown): number | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0] as { valor?: unknown } | null
  return first ? ratioToCents(first.valor) : null
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`fx ${response.status}`)
  return response.json()
}

export async function fetchDollarRate(): Promise<DollarRate | null> {
  const now = new Date().toISOString()
  try {
    const cents = parseMarketRate(await getJson('https://open.er-api.com/v6/latest/USD'))
    if (cents) return { cents, source: 'mercado', fetchedAt: now }
  } catch (error) {
    console.warn('No se pudo leer el dólar de mercado', error)
  }
  try {
    const cents = parseTrm(
      await getJson(
        'https://www.datos.gov.co/resource/32sa-8pi3.json?$select=valor&$order=vigenciadesde%20DESC&$limit=1',
      ),
    )
    if (cents) return { cents, source: 'TRM', fetchedAt: now }
  } catch (error) {
    console.warn('No se pudo leer la TRM', error)
  }
  return null
}

export function readCachedRate(): DollarRate | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<DollarRate>
    if (
      typeof data.cents === 'number' &&
      (data.source === 'mercado' || data.source === 'TRM') &&
      typeof data.fetchedAt === 'string'
    )
      return data as DollarRate
  } catch {
    // sin almacenamiento: se vuelve a pedir
  }
  return null
}

export function cacheRate(rate: DollarRate): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(rate))
  } catch {
    // modo privado: no pasa nada
  }
}

export const isFresh = (rate: DollarRate, now: number = Date.now()) =>
  now - new Date(rate.fetchedAt).getTime() < REFRESH_MS
