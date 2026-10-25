import { useMemo } from 'react'
import { Link } from 'react-router'
import { LockSimpleIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
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
import type { PersonalMovement } from '../../types/domain'
import { CategoryBadge, CategoryIcon } from '../../components/movements/CategoryIcon'
import { ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

function PersonalRow({ movement }: { movement: PersonalMovement }) {
  const { categories } = useHousehold()
  const category = categories.find((item) => item.id === movement.categoryId)
  const voided = movement.status === 'voided'
  const income = movement.kind === 'income'
  return (
    <li>
      <Link
        to={`/personal/${movement.id}`}
        className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-(--row-y) transition-colors duration-150 hover:bg-surface-2/50"
      >
        {income ? (
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-positive-bg text-positive">
            <CategoryIcon icon={category?.icon} />
          </span>
        ) : (
          <CategoryBadge icon={category?.icon} color={category?.color} className="mt-0.5 size-10" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-3">
            <span
              className={`line-clamp-2 min-w-0 font-medium break-words ${voided ? 'text-fg-muted line-through' : 'text-fg'}`}
            >
              <span className="sr-only">{income ? 'Ingreso personal' : 'Gasto personal'}: </span>
              {movement.description}
            </span>
            <span
              className={`shrink-0 tabular font-semibold ${voided ? 'text-fg-muted line-through' : 'text-fg'}`}
            >
              {formatMoney(movement.amount)}
            </span>
          </span>
          <span
            data-money
            className={`text-sm font-medium ${voided ? 'text-fg-muted' : income ? 'text-positive' : 'text-negative'}`}
          >
            {voided
              ? 'Anulado'
              : `${income ? 'Te suma' : 'Te resta'} ${formatSigned(income ? movement.amount : -movement.amount)}`}
            {category && <span className="font-normal text-fg-muted"> · {category.name}</span>}
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Tu dinero personal: lo que es solo tuyo, aparte del hogar. Privado (RLS) y fuera del saldo
 * disponible, de lo que queda y de los reportes.
 */
export function PersonalPage() {
  const personal = usePersonalMoney()
  const today = todayBogota()

  const { summary, days } = useMemo(() => {
    const movements = personal.data ?? []
    return {
      summary: personalSummary(movements, { from: startOfMonth(today), to: endOfMonth(today) }),
      days: personalDays(movements),
    }
  }, [personal.data, today])

  const negative = summary.available < 0
  const shown = negative ? formatSigned(summary.available) : formatMoney(summary.available)
  const actions = (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <ButtonLink
        to="/personal/ingresos/nuevo"
        variant="secondary"
        icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Ingreso
      </ButtonLink>
      <ButtonLink
        to="/personal/gastos/nuevo"
        icon={<MinusIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Gasto
      </ButtonLink>
    </div>
  )

  return (
    <Page>
      <PageHeader
        title="Tu dinero personal"
        back="/"
        description="Solo tú lo ves. Va aparte: no suma ni resta en el saldo del hogar ni en los reportes."
      />
      {personal.loading ? (
        <LedgerSkeleton days={1} />
      ) : personal.error && !personal.data ? (
        <ErrorState message={toUserMessage(personal.error)} />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<LockSimpleIcon />}
          title="Aún no tienes dinero personal"
          action={actions}
        >
          Registra lo que te ganas y es solo tuyo (por ejemplo $500.000 de un trabajo aparte) y los
          gastos que pagas con eso. Nadie más del hogar lo ve.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="personal-saldo" className="flex flex-col gap-3">
            <h2 id="personal-saldo" className="text-fg-muted">
              {negative ? 'Gastaste más de lo que tienes: vas en' : 'Tienes disponible'}
              <span className="sr-only"> {shown}</span>
            </h2>
            <p
              aria-hidden="true"
              className={`tabular text-[clamp(2rem,10vw,3rem)] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] ${negative ? 'text-negative' : ''}`}
            >
              {shown}
            </p>
            <p data-money className="text-sm text-fg-muted first-letter:uppercase">
              {formatMonthName(today)}: te entraron{' '}
              <span className="tabular font-semibold text-fg">
                {formatMoney(summary.periodIncomes)}
              </span>{' '}
              y gastaste{' '}
              <span className="tabular font-semibold text-fg">
                {formatMoney(summary.periodExpenses)}
              </span>
              . Lo que sobra pasa al mes siguiente.
            </p>
            {actions}
          </section>

          <section
            aria-labelledby="personal-movimientos"
            className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5"
          >
            <h2 id="personal-movimientos" className="sr-only">
              Movimientos personales
            </h2>
            {days.map((day) => (
              <div key={day.date}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b-[3px] border-double border-line-strong pt-3 pb-2">
                  <h3
                    className={`text-sm font-semibold first-letter:uppercase ${day.date === today ? 'text-primary' : 'text-fg'}`}
                  >
                    <time dateTime={day.date}>{formatDayHeading(day.date, today)}</time>
                  </h3>
                  <p className="text-sm text-fg-muted">
                    Al cierre{' '}
                    <span
                      className={`tabular font-semibold ${day.closing < 0 ? 'text-negative' : 'text-fg'}`}
                    >
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
          </section>
        </div>
      )}
    </Page>
  )
}
