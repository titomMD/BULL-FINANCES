import { useMemo } from 'react'
import { Link } from 'react-router'
import { CaretRightIcon, LockSimpleIcon } from '@phosphor-icons/react'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { personalSummary } from '../../lib/calculations/personal'
import { endOfMonth, startOfMonth, todayBogota } from '../../lib/dates'
import { formatMoney, formatSigned } from '../../lib/money'
import { Skeleton } from '../ui/States'

/** Inicio: acceso a tu dinero personal (privado y aparte del saldo del hogar). */
export function PersonalMoneyCard() {
  const personal = usePersonalMoney()
  const today = todayBogota()

  const summary = useMemo(
    () =>
      personal.data
        ? personalSummary(personal.data, { from: startOfMonth(today), to: endOfMonth(today) })
        : null,
    [personal.data, today],
  )
  const empty = personal.data?.length === 0
  const negative = (summary?.available ?? 0) < 0

  return (
    <Link
      to="/personal"
      className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 transition-colors hover:bg-surface-2/50"
    >
      <span className="flex min-w-0 flex-col">
        <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
          <LockSimpleIcon aria-hidden="true" className="size-4" />
          Tu dinero personal
        </span>
        {personal.loading || (!summary && !personal.error) ? (
          <Skeleton className="my-1 h-6 w-28" />
        ) : empty || !summary ? (
          <span className="font-medium">Lleva aparte lo que es solo tuyo</span>
        ) : (
          <span className={`tabular text-xl font-semibold ${negative ? 'text-negative' : ''}`}>
            {negative ? formatSigned(summary.available) : formatMoney(summary.available)}
          </span>
        )}
        <span className="text-xs text-fg-muted">
          Solo tú lo ves. No cuenta en el saldo de arriba.
        </span>
      </span>
      <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
    </Link>
  )
}
