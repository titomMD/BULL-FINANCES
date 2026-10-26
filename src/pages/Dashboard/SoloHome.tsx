import { useMemo } from 'react'
import { Link } from 'react-router'
import { NotebookIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { usePlanSync } from '../../hooks/usePlanSync'
import { personalDays, personalSummary } from '../../lib/calculations/personal'
import {
  endOfMonth,
  formatDayHeading,
  formatMonthName,
  startOfMonth,
  todayBogota,
} from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatSigned } from '../../lib/money'
import { UpcomingPayments } from '../../components/plan/UpcomingPayments'
import { DollarBox } from '../../components/debts/DollarBox'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { PersonalRow } from '../Personal/PersonalPage'

const DAYS_SHOWN = 4

/**
 * Inicio cuando estás solo en el hogar: el saldo disponible es tu dinero personal (lo que el plan
 * te deja libre cada mes más lo que registres, menos lo que gastes). Si invitas a alguien al
 * hogar, vuelve la vista compartida.
 */
export function SoloHome() {
  usePlanSync()
  const personal = usePersonalMoney()
  const today = todayBogota()

  const { summary, days, totalDays } = useMemo(() => {
    const movements = personal.data ?? []
    const all = personalDays(movements)
    return {
      summary: personalSummary(movements, { from: startOfMonth(today), to: endOfMonth(today) }),
      days: all.slice(0, DAYS_SHOWN),
      totalDays: all.length,
    }
  }, [personal.data, today])

  const over = summary.available < 0
  const shown = over ? formatSigned(summary.available) : formatMoney(summary.available)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6 lg:px-10">
      <section
        aria-labelledby="queda"
        className="pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 lg:pt-10"
      >
        <h1 id="queda" className="text-lg text-fg-muted">
          {over ? (
            <span className="inline-flex items-center gap-1.5 text-negative">
              <WarningCircleIcon aria-hidden="true" className="size-5" weight="bold" />
              Gastaste más de lo que tienes: vas en
            </span>
          ) : (
            'Tu saldo disponible'
          )}{' '}
          <span className="sr-only">{shown}</span>
        </h1>
        <p
          aria-hidden="true"
          className={`mt-1 tabular text-[clamp(2.25rem,12vw,3.75rem)] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] ${over ? 'text-negative' : ''}`}
        >
          {shown}
        </p>
        <p data-money className="mt-2 text-sm text-fg-muted first-letter:uppercase">
          {formatMonthName(today)}: te entraron{' '}
          <span className="tabular font-semibold text-fg">
            {formatMoney(summary.periodIncomes)}
          </span>{' '}
          y gastaste{' '}
          <span className="tabular font-semibold text-fg">
            {formatMoney(summary.periodExpenses)}
          </span>
          . Tu «Dinero mío» del plan entra solo cada mes.{' '}
          <Link to="/plan" className="font-medium text-fg underline hover:text-primary">
            Ver mi plan
          </Link>
        </p>
      </section>

      <div className="mb-4 flex flex-col gap-4">
        <UpcomingPayments />
        <DollarBox />
      </div>
      {personal.loading ? (
        <LedgerSkeleton days={1} />
      ) : personal.error && !personal.data ? (
        <ErrorState message={toUserMessage(personal.error)} />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<NotebookIcon />}
          title="Tu libro está en blanco"
          action={<ButtonLink to="/plan">Armar mi plan del mes</ButtonLink>}
        >
          Arma tu plan y tu «Dinero mío» aparecerá aquí como ingreso. Luego registra cada gasto y se
          irá descontando.
        </EmptyState>
      ) : (
        <section
          aria-label="Últimos movimientos"
          className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5"
        >
          {days.map((day) => (
            <div key={day.date}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b-[3px] border-double border-line-strong pt-3 pb-2">
                <h3 className="text-sm font-semibold first-letter:uppercase">
                  <time dateTime={day.date}>{formatDayHeading(day.date, today)}</time>
                </h3>
                <p className="text-sm text-fg-muted">
                  Al cierre{' '}
                  <span className="tabular font-semibold text-fg">
                    {day.closing < 0 ? formatSigned(day.closing) : formatMoney(day.closing)}
                  </span>
                </p>
              </div>
              <ul className="divide-y divide-line">
                {day.movements.map((movement) => (
                  <PersonalRow key={movement.id} movement={movement} />
                ))}
              </ul>
            </div>
          ))}
          {totalDays > DAYS_SHOWN && (
            <ButtonLink to="/personal" variant="secondary" className="mt-3 self-start">
              Ver todo mi historial
            </ButtonLink>
          )}
        </section>
      )}
    </div>
  )
}
