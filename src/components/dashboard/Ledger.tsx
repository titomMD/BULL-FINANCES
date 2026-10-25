import { formatDayHeading, todayBogota } from '../../lib/dates'
import { formatMoney, formatSigned } from '../../lib/money'
import type { AnnotatedDay } from '../../lib/calculations/ledger'
import { MovementRow } from '../movements/MovementRow'

/** Libro diario: cada día con tu saldo disponible al cierre. */
export function Ledger({
  days,
  heading,
  dayLevel = 'h2',
}: {
  days: AnnotatedDay[]
  /** Con dayLevel h3, se muestra como h2 solo para lectores de pantalla. */
  heading?: string
  dayLevel?: 'h2' | 'h3'
}) {
  const DayHeading = dayLevel
  const today = todayBogota()
  return (
    <section
      aria-label={dayLevel === 'h2' ? (heading ?? 'Libro diario') : undefined}
      aria-labelledby={dayLevel === 'h3' ? 'libro-titulo' : undefined}
      className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5"
    >
      {dayLevel === 'h3' && (
        <h2 id="libro-titulo" className="sr-only">
          {heading ?? 'Libro diario'}
        </h2>
      )}
      {days.map((day) => {
        const isToday = day.date === today
        const negative = day.closingBalance < 0
        return (
          <div key={day.date}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b-[3px] border-double border-line-strong pt-3 pb-2">
              <DayHeading
                className={`text-sm font-semibold first-letter:uppercase ${isToday ? 'text-primary' : 'text-fg'}`}
              >
                <time dateTime={day.date}>{formatDayHeading(day.date, today)}</time>
              </DayHeading>
              <p className="text-sm text-fg-muted">
                {isToday ? 'Tu saldo ahora' : 'Tu saldo al cierre'}{' '}
                <span className={`tabular font-semibold ${negative ? 'text-negative' : 'text-fg'}`}>
                  {negative ? formatSigned(day.closingBalance) : formatMoney(day.closingBalance)}
                </span>
              </p>
            </div>
            <ul className="divide-y divide-line">
              {day.entries.map((entry) => (
                <MovementRow key={entry.movement.id} entry={entry} />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
