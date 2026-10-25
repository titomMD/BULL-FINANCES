import { Link } from 'react-router'
import { CalendarCheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { useDebtPayments, useDebtStatements } from '../../hooks/useDebts'
import { useDollar } from '../../hooks/useDollar'
import { usePlan, usePlanChecks, usePlanEntries } from '../../hooks/usePlan'
import { usePlanSync } from '../../hooks/usePlanSync'
import { monthOf } from '../../lib/calculations/plan'
import { monthProgress, planBuckets } from '../../lib/calculations/planMonth'
import { endOfMonth, formatMonthName, startOfMonth, todayBogota } from '../../lib/dates'
import { formatMoney } from '../../lib/money'

const percent = new Intl.NumberFormat('es-CO', { style: 'percent' })

/**
 * Los «bolsillos» de tu plan este mes (libre, gasolina, membresías, gimnasio, tarjetas): lo
 * planeado, lo gastado y lo que queda. Se alimenta solo de lo que marcas en Mi plan.
 */
export function PlanBuckets() {
  usePlanSync()
  const plan = usePlan()
  const checks = usePlanChecks()
  const entries = usePlanEntries()
  const statements = useDebtStatements()
  const payments = useDebtPayments()
  const { rate } = useDollar()
  const personal = usePersonalMoney()
  const today = todayBogota()
  const month = monthOf(today)

  const buckets = useMemo(() => {
    if (!plan.data || plan.data.length === 0) return []
    const progress = monthProgress(
      plan.data,
      checks.data ?? [],
      entries.data ?? [],
      statements.data ?? [],
      month,
      payments.data ?? [],
      rate?.cents ?? null,
    )
    const spent = (personal.data ?? [])
      .filter(
        (m) =>
          m.status === 'active' &&
          m.kind === 'expense' &&
          m.date >= startOfMonth(today) &&
          m.date <= endOfMonth(today),
      )
      .reduce((total, m) => total + m.amount, 0)
    return planBuckets(progress, spent)
  }, [
    plan.data,
    checks.data,
    entries.data,
    statements.data,
    payments.data,
    rate?.cents,
    personal.data,
    month,
    today,
  ])

  if (buckets.length === 0) return null

  return (
    <section aria-labelledby="bolsillos-plan">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="bolsillos-plan"
          className="text-sm font-semibold text-fg-muted first-letter:uppercase"
        >
          Bolsillos de tu plan · {formatMonthName(today)}
        </h2>
        <Link to="/plan" className="inline-flex min-h-11 items-center gap-1 text-sm underline">
          <CalendarCheckIcon aria-hidden="true" className="size-4" />
          Mi plan
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {buckets.map((bucket) => {
          const ratio =
            bucket.planned > 0 ? bucket.spent / bucket.planned : bucket.spent > 0 ? 2 : 0
          const tone = ratio > 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-primary' : 'bg-positive'
          return (
            <li key={bucket.key} className="rounded-2xl bg-surface px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{bucket.label}</span>
                <span data-money className="shrink-0 text-sm text-fg-muted">
                  gastaste{' '}
                  <span className="tabular font-semibold text-fg">{percent.format(ratio)}</span>
                </span>
              </div>
              <div
                aria-hidden="true"
                className="my-2 h-2 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className={`h-full rounded-full ${tone}`}
                  style={{ width: `${Math.min(1, ratio) * 100}%` }}
                />
              </div>
              {bucket.remaining < 0 ? (
                <span
                  data-money
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-negative"
                >
                  <WarningCircleIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
                  Te pasaste por <span className="tabular">{formatMoney(-bucket.remaining)}</span>
                </span>
              ) : (
                <span data-money className="text-sm text-fg-muted">
                  Te quedan{' '}
                  <span className="tabular font-semibold text-fg">
                    {formatMoney(bucket.remaining)}
                  </span>{' '}
                  de <span className="tabular">{formatMoney(bucket.planned)}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
