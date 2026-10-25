import { ArrowsClockwiseIcon, CurrencyDollarIcon } from '@phosphor-icons/react'
import { useDollar } from '../../hooks/useDollar'
import { formatRate } from '../../lib/usd'

/** Cuánto vale hoy el dólar en pesos. Se actualiza solo cada pocas horas. */
export function DollarBox() {
  const { rate, loading, refresh } = useDollar()
  return (
    <section
      aria-label="Dólar del día"
      className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <CurrencyDollarIcon aria-hidden="true" className="size-7 text-fg-muted" />
        <div>
          <p className="text-sm text-fg-muted">Dólar hoy</p>
          {rate ? (
            <>
              <p data-money className="tabular text-xl font-semibold">
                {formatRate(rate.cents)}
              </p>
              <p className="text-xs text-fg-muted">
                {rate.source === 'TRM' ? 'TRM oficial' : 'Tasa de mercado'} · actualizado{' '}
                {new Date(rate.fetchedAt).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Bogota',
                })}
              </p>
            </>
          ) : (
            <p className="text-sm">{loading ? 'Consultando…' : 'No pudimos consultarlo ahora.'}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        aria-label="Actualizar el valor del dólar"
        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2 disabled:opacity-50"
      >
        <ArrowsClockwiseIcon
          aria-hidden="true"
          className={`size-5 ${loading ? 'animate-spin' : ''}`}
        />
      </button>
    </section>
  )
}
