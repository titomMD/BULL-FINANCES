import {
  accruedInterest,
  dailyInterest,
  daysBetween,
  interestTimeline,
} from '../../lib/calculations/cards'
import { formatDay } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { DebtPayment } from '../../types/domain'

interface Props {
  /** Deuda en pesos que sigue causando intereses (lo que falta pagar). */
  balance: number
  ratePpm: number | null
  today: string
  /** Próximo corte. */
  until: string
  /** Abonos extra en pesos, para sumar lo que te ahorraron. */
  extras: DebtPayment[]
}

/** Intereses estimados día a día y lo que ahorraron tus abonos. Es un cálculo aproximado. */
export function InterestPanel({ balance, ratePpm, today, until, extras }: Props) {
  if (!ratePpm) {
    return (
      <section className="rounded-2xl bg-surface px-4 py-3">
        <h3 className="font-semibold">Intereses</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Pon la tasa mensual en «Editar extracto» (aparece en tu extracto, como M.V.) y aquí verás
          el interés de cada día.
        </p>
      </section>
    )
  }
  const days = Math.max(1, daysBetween(today, until))
  const rows = interestTimeline(balance, ratePpm, today, Math.min(days, 31))
  const saved = extras
    .filter((p) => p.currency === 'COP')
    .reduce(
      (total, p) =>
        total + accruedInterest(p.amount, ratePpm, Math.max(0, daysBetween(p.paidOn, until))),
      0,
    )

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 sm:px-5" data-money>
      <h3 className="font-semibold">Intereses (estimado)</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-muted">Tasa mensual</dt>
        <dd className="text-right tabular font-semibold">
          {(ratePpm / 10000).toLocaleString('es-CO', { maximumFractionDigits: 4 })} %
        </dd>
        <dt className="text-fg-muted">Deuda que causa intereses</dt>
        <dd className="text-right tabular font-semibold">{formatMoney(balance)}</dd>
        <dt className="text-fg-muted">Cada día se causan</dt>
        <dd className="text-right tabular font-semibold">
          {formatMoney(dailyInterest(balance, ratePpm))}
        </dd>
        <dt className="text-fg-muted">Hasta el corte del {formatDay(until)}</dt>
        <dd className="text-right tabular font-semibold">
          {formatMoney(accruedInterest(balance, ratePpm, days))}
        </dd>
        <dt className="text-fg-muted">Ahorrado con tus abonos</dt>
        <dd className="text-right tabular font-semibold">{formatMoney(saved)}</dd>
      </dl>
      {balance > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer text-sm font-medium">
            Ver el interés día por día
          </summary>
          <table className="mt-1 w-full text-sm">
            <thead className="text-left text-fg-muted">
              <tr>
                <th className="py-1 font-medium">Día</th>
                <th className="py-1 text-right font-medium">Ese día</th>
                <th className="py-1 text-right font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.date}>
                  <td className="py-1">{formatDay(row.date)}</td>
                  <td className="py-1 text-right tabular">{formatMoney(row.interest)}</td>
                  <td className="py-1 text-right tabular font-semibold">
                    {formatMoney(row.accumulated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="text-xs text-fg-muted">
        Cálculo aproximado (tasa mensual ÷ 30 por día). El banco puede liquidar distinto.
      </p>
    </section>
  )
}
