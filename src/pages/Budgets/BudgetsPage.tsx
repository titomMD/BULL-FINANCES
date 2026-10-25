import { useMemo } from 'react'
import { Link } from 'react-router'
import { CaretRightIcon, PlusIcon, WalletIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useBudgets } from '../../hooks/useBudgets'
import { budgetProgress, budgetRange, type BudgetProgress } from '../../lib/calculations/budgets'
import { formatDay, formatMonthName, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import type { BudgetPeriod } from '../../types/domain'
import { BudgetBar, BudgetIcon, BudgetStatus } from '../../components/budgets/BudgetParts'
import { kindLabel, useBudgetName } from '../../components/budgets/budgetLabels'
import { ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

const percent = new Intl.NumberFormat('es-CO', { style: 'percent' })

function BudgetRow({ progress }: { progress: BudgetProgress }) {
  const nameOf = useBudgetName()
  const { budget } = progress
  return (
    <li>
      <Link
        to={`/presupuestos/${budget.id}`}
        className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 transition-colors duration-150 hover:bg-surface-2/50"
      >
        <BudgetIcon budget={budget} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{nameOf(budget)}</span>
              <span className="text-xs text-fg-muted">{kindLabel[budget.kind]}</span>
            </span>
            <span data-money className="shrink-0 text-sm text-fg-muted">
              gastaste{' '}
              <span className="tabular font-semibold text-fg">
                {percent.format(progress.ratio)}
              </span>
            </span>
          </span>
          <BudgetBar progress={progress} />
          <BudgetStatus progress={progress} />
        </span>
        <CaretRightIcon aria-hidden="true" className="mt-3 size-4 shrink-0 text-fg-muted" />
      </Link>
    </li>
  )
}

const sectionTitle = (period: BudgetPeriod, today: string) => {
  if (period === 'month') return `Este mes · ${formatMonthName(today)}`
  const range = budgetRange('week', today)
  return `Esta semana · ${formatDay(range.from, today)} al ${formatDay(range.to, today)}`
}

/** Presupuestos personales (privados): cuánto llevas gastado de tu parte en el mes o la semana. */
export function BudgetsPage() {
  const data = useHousehold()
  const budgets = useBudgets()
  const today = todayBogota()

  const groups = useMemo(() => {
    const progress = (budgets.data ?? []).map((budget) =>
      budgetProgress(budget, data.movements, data.userId, today),
    )
    return (['month', 'week'] as const)
      .map((period) => ({
        period,
        items: progress.filter((item) => item.budget.period === period),
      }))
      .filter((group) => group.items.length > 0)
  }, [budgets.data, data.movements, data.userId, today])

  const hasBudgets = (budgets.data?.length ?? 0) > 0

  return (
    <Page>
      <PageHeader
        title="Presupuestos"
        description="Solo tú ves los tuyos. Cuentan tu parte de cada gasto, con tarjeta o sin ella."
        actions={
          hasBudgets ? (
            <ButtonLink
              to="/presupuestos/nuevo"
              size="sm"
              icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
            >
              Nuevo
            </ButtonLink>
          ) : undefined
        }
      />
      {budgets.loading ? (
        <LedgerSkeleton days={1} />
      ) : budgets.error && !budgets.data ? (
        <ErrorState message={toUserMessage(budgets.error)} />
      ) : !hasBudgets ? (
        <EmptyState
          icon={<WalletIcon />}
          title="Aún no tienes presupuestos"
          action={<ButtonLink to="/presupuestos/nuevo">Crear el primero</ButtonLink>}
        >
          Ponte un tope para una categoría (Comida $400.000 al mes), para todo lo que gastas, o uno
          libre con nombre (Salidas $100.000 a la semana) y elige qué gastos cuentan.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.period} aria-labelledby={`periodo-${group.period}`}>
              <h2
                id={`periodo-${group.period}`}
                className="mb-3 text-sm font-semibold text-fg-muted first-letter:uppercase"
              >
                {sectionTitle(group.period, today)}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <BudgetRow key={item.budget.id} progress={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}
