import { errorMessages, type ErrorKey } from '../i18n/es'

// Traduce errores de Supabase / Postgres a mensajes humanos (spec §41). El detalle técnico solo
// se registra en la consola durante el desarrollo.

interface ErrorLike {
  message?: string
  code?: string
  status?: number
  name?: string
}

function isErrorKey(value: string): value is ErrorKey {
  return value in errorMessages
}

export function errorKey(error: unknown): ErrorKey {
  if (!error || typeof error !== 'object') return 'unknown'
  const { message = '', code, status, name } = error as ErrorLike

  if (isErrorKey(message)) return message
  if (name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(message))
    return 'network'
  if (status === 429 || /rate limit/i.test(message)) return 'rate_limited'
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message))
    return 'invalid_credentials'
  if (code === 'weak_password' || /weak password|at least \d+ characters/i.test(message))
    return 'weak_password'
  if (code === 'user_already_exists' || /already registered/i.test(message)) return 'email_taken'
  if (code === 'signup_disabled' || /signups not allowed/i.test(message)) return 'signup_disabled'
  if (code === '23503' && /categor/i.test(message)) return 'category_in_use'
  if (code === '23505' && /categor/i.test(message)) return 'duplicate_category'
  if (code === 'PGRST301' || /JWT expired/i.test(message)) return 'not_authenticated'
  return 'unknown'
}

export function toUserMessage(error: unknown, fallback?: string): string {
  if (import.meta.env.DEV) console.error('[BULLMILTON]', error)
  const key = errorKey(error)
  if (key === 'unknown' && fallback) return fallback
  return errorMessages[key]
}

interface SupabaseResult {
  data: unknown
  error: unknown
}

/** Datos de una respuesta de Supabase; lanza su error o si vino vacía. */
export function unwrap<R extends SupabaseResult>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error
  if (result.data === null || result.data === undefined) throw new Error('not_found')
  return result.data as NonNullable<R['data']>
}

/** Igual que unwrap, pero una respuesta vacía es válida (maybeSingle). */
export function unwrapMaybe<R extends SupabaseResult>(result: R): R['data'] {
  if (result.error) throw result.error
  return result.data
}

/** Para escrituras sin datos de vuelta: solo lanza el error, si lo hay. */
export function assertOk(result: { error: unknown }): void {
  if (result.error) throw result.error
}
