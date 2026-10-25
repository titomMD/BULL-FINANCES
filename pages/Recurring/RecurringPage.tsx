import { Link } from 'react-router'
import { CaretRightIcon, PlusIcon, RepeatIcon } from '@phosphor-icons/react'
import { nameInSentence, useHousehold } from '../../app/household-context'
import { useRecurring } from '../../hooks/useRecurring'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { frequencyLabels } from '../../i18n/es'
import type { RecurringExpense } from '../../types/domain'
import { CategoryBadge } from '../../components/movements/CategoryIcon'
import { ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

function RecurringRow({ item }: { item: RecurringExpense }) {
  const data = useHousehold()
  const category = data.categories.find((entry) => entry.id === item.categoryId)
  const due = item.active && item.nextDueDate <= todayBogota()
  return (
    <li>
      <Link
        to={`/recurrentes/${item.id}`}
        className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-surface-2/70"
      >
        <CategoryBadge icon={category?.icon} color={category?.color} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{item.name}</span>
          <span className="truncate text-sm text-fg-muted">
            {frequencyLabels[item.frequency]}, paga {nameInSentence(data, item.paidBy)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="tabular font-semibold">{formatMoney(item.amount)}</span>
          <span
            className={`text-xs ${!item.active ? 'text-fg-muted' : due ? 'font-semibold text-primary' : 'text-fg-muted'}`}
          >
            {!item.active
              ? 'Pausado'
              : due
                ? 'Pendiente'
                : `Próximo: ${formatDay(item.nextDueDate)}`}
          </span>
        </span>
        <CaretRightIcon aria-hidden="true" className="size-4 text-fg-muted" weight="bold" />
      </Link>
    </li>
  )
}

/** Plantillas de gastos periódicos (spec §14). */
export function RecurringPage() {
  const recurring = useRecurring()
  const items = recurring.data ?? []

  return (
    <Page>
      <PageHeader
        title="Gastos recurrentes"
        back="/ajustes"
        description="Cuando llega la fecha, aparecen en Inicio para confirmarlos con un toque."
        actions={
          items.length > 0 ? (
            <ButtonLink
              to="/recurrentes/nuevo"
              size="sm"
              icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
            >
              Nuevo
            </ButtonLink>
          ) : undefined
        }
      />
      {recurring.loading ? (
        <LedgerSkeleton days={1} />
      ) : recurring.error && !recurring.data ? (
        <ErrorState message={toUserMessage(recurring.error)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<RepeatIcon />}
          title="Sin gastos recurrentes"
          action={<ButtonLink to="/recurrentes/nuevo">Crear el primero</ButtonLink>}
        >
          Arriendo, internet, servicios o Netflix: créalos una vez y BULLMILTON te los recuerda cada
          mes.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <RecurringRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Page>
  )
}
