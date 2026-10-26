import { Link } from 'react-router'
import { BellRingingIcon, CalendarPlusIcon } from '@phosphor-icons/react'
import { usePlan, usePlanChecks, usePlanEntries } from '../../hooks/usePlan'
import { buildIcs, upcomingPayments } from '../../lib/calculations/reminders'
import { formatDay, todayBogota } from '../../lib/dates'
import { downloadFile } from '../../lib/export'
import { formatMoney } from '../../lib/money'
import { Button } from '../ui/Button'

const when = (daysLeft: number) =>
  daysLeft < 0
    ? `venció hace ${-daysLeft} ${daysLeft === -1 ? 'día' : 'días'}`
    : daysLeft === 0
      ? 'vence hoy'
      : daysLeft === 1
        ? 'vence mañana'
        : `vence en ${daysLeft} días`

/**
 * Próximos pagos: lo que vence pronto según el día de pago y el aviso de cada línea del plan.
 * Además deja descargar un calendario (.ics) para que el celular avise solo cada mes.
 */
export function UpcomingPayments() {
  const plan = usePlan()
  const checks = usePlanChecks()
  const entries = usePlanEntries()
  const today = todayBogota()
  const items = plan.data ?? []
  if (!items.some((item) => item.kind === 'expense' && item.dueDay !== null)) return null
  const due = upcomingPayments(items, checks.data ?? [], entries.data ?? [], today)

  return (
    <section
      aria-label="Próximos pagos"
      className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3 sm:px-5"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <BellRingingIcon aria-hidden="true" className="size-5" />
        Próximos pagos
      </h2>
      {due.length === 0 ? (
        <p className="text-sm text-fg-muted">Nada por pagar en los próximos días.</p>
      ) : (
        <ul className="divide-y divide-line">
          {due.map(({ item, dueDate, daysLeft, overdue }) => (
            <li key={item.id}>
              <Link
                to="/plan"
                className="-mx-2 flex items-baseline justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">{item.name}</span>
                  <span className={`text-sm ${overdue ? 'text-negative' : 'text-fg-muted'}`}>
                    {overdue ? 'Atención: ' : ''}
                    {when(daysLeft)} · {formatDay(dueDate)}
                  </span>
                </span>
                <span className="shrink-0 tabular font-semibold">{formatMoney(item.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        className="self-start"
        icon={<CalendarPlusIcon aria-hidden="true" className="size-4" />}
        onClick={() => {
          const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
          downloadFile(
            'pagos-freyapp.ics',
            buildIcs(items, today, stamp),
            'text/calendar;charset=utf-8',
          )
        }}
      >
        Avisos en mi calendario
      </Button>
    </section>
  )
}
