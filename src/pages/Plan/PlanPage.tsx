import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  CaretLeftIcon,
  CaretRightIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  LockSimpleIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { useDebtAccounts, useDebtPayments, useDebtStatements } from '../../hooks/useDebts'
import { useDollar } from '../../hooks/useDollar'
import { usePlan, usePlanChecks, usePlanEntries } from '../../hooks/usePlan'
import { usePlanSync } from '../../hooks/usePlanSync'
import { invalidateData } from '../../hooks/useResource'
import { freeLeft, installmentOf, monthOf, shiftMonth } from '../../lib/calculations/plan'
import { monthProgress } from '../../lib/calculations/planMonth'
import { personalSummary } from '../../lib/calculations/personal'
import { endOfMonth, formatMonthName, startOfMonth, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatSigned } from '../../lib/money'
import { EXAMPLE_PLAN } from '../../lib/planTemplate'
import { createPlanItems, renamePlanGroup, setTracked } from '../../services/plan'
import type { PlanItem, PlanKind } from '../../types/domain'
import { CheckRow, TrackedRow } from '../../components/plan/FixedRow'
import { UpcomingPayments } from '../../components/plan/UpcomingPayments'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const monthTitle = (month: string) => `${formatMonthName(`${month}-01`)} ${month.slice(0, 4)}`

function ItemRow({ item, month }: { item: PlanItem; month: string }) {
  const installment = installmentOf(item, month)
  return (
    <li>
      <Link
        to={`/plan/${item.id}`}
        className="-mx-2 flex items-baseline justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-medium break-words">{item.name}</span>
          {installment && (
            <span className="text-sm text-fg-muted">
              Cuota {installment.current} de {installment.total} · en total{' '}
              <span className="tabular">{formatMoney(installment.totalAmount)}</span>
            </span>
          )}
        </span>
        <span className="shrink-0 tabular font-semibold">{formatMoney(item.amount)}</span>
      </Link>
    </li>
  )
}

function Section({
  title,
  total,
  kind,
  children,
  empty,
}: {
  title: string
  total: number
  kind: PlanKind
  children: React.ReactNode
  empty: boolean
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5"
    >
      <div className="flex items-baseline justify-between gap-3 border-b-[3px] border-double border-line-strong pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="tabular font-semibold">{formatMoney(total)}</p>
      </div>
      {empty ? <p className="py-3 text-sm text-fg-muted">Aún no hay nada aquí.</p> : children}
      <ButtonLink
        to={`/plan/nuevo/${kind}`}
        variant="secondary"
        className="mt-2 self-start"
        icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Añadir
      </ButtonLink>
    </section>
  )
}

/**
 * Mi plan del mes: lo que entra, lo fijo que sale y lo que se ahorra. Lo que sobra es "Dinero mío",
 * para gastar libremente. Privado (RLS) y aparte del hogar.
 */
export function PlanPage() {
  const { household } = useHousehold()
  usePlanSync()
  const plan = usePlan()
  const checks = usePlanChecks()
  const entries = usePlanEntries()
  const statements = useDebtStatements()
  const payments = useDebtPayments()
  const { rate } = useDollar()
  const accounts = useDebtAccounts()
  const personal = usePersonalMoney()
  const toast = useToast()
  const today = todayBogota()
  const [month, setMonth] = useState(monthOf(today))
  const [loadingExample, setLoadingExample] = useState(false)

  const progress = useMemo(
    () =>
      monthProgress(
        plan.data ?? [],
        checks.data ?? [],
        entries.data ?? [],
        statements.data ?? [],
        month,
        payments.data ?? [],
        rate?.cents ?? null,
      ),
    [plan.data, checks.data, entries.data, statements.data, payments.data, rate?.cents, month],
  )
  const summary = progress.summary
  const monthDay = `${month}-01`
  const left = useMemo(() => {
    if (month !== monthOf(today)) return null
    // El ingreso que el plan genera solo ya es «Dinero mío»: no se suma dos veces.
    const personalMonth = personalSummary(
      (personal.data ?? []).filter((movement) => !movement.planMonth),
      { from: startOfMonth(monthDay), to: endOfMonth(monthDay) },
    )
    return freeLeft(progress.money, personalMonth)
  }, [personal.data, progress.money, month, monthDay, today])

  const hasOldGroup = (plan.data ?? []).some((item) => item.groupName === 'Tarjeta')
  const gasoline = (plan.data ?? []).find(
    (item) => item.kind === 'expense' && !item.tracked && /gasolina/i.test(item.name),
  )
  const applyFix = async (action: () => Promise<void>, done: string) => {
    try {
      await action()
      invalidateData()
      toast.show(done)
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos hacer el cambio.'), 'error')
    }
  }

  const loadExample = async () => {
    setLoadingExample(true)
    try {
      await createPlanItems(household.id, EXAMPLE_PLAN)
      invalidateData()
      toast.show('Plan de ejemplo cargado: cámbialo con tus números')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos cargar el ejemplo.'), 'error')
    } finally {
      setLoadingExample(false)
    }
  }

  const negative = progress.money < 0

  return (
    <Page>
      <PageHeader
        title="Mi plan del mes"
        description="Lo que entra, lo fijo que sale y lo que ahorras. Lo que sobra es tu dinero libre. Solo tú lo ves."
      />
      {plan.loading ? (
        <LedgerSkeleton days={1} />
      ) : plan.error && !plan.data ? (
        <ErrorState message={toUserMessage(plan.error)} onRetry={invalidateData} />
      ) : (plan.data ?? []).length === 0 ? (
        <EmptyState
          icon={<CalendarCheckIcon />}
          title="Arma tu plan del mes"
          action={
            <div className="grid gap-2 sm:flex">
              <Button onClick={loadExample} loading={loadingExample}>
                Cargar un plan de ejemplo
              </Button>
              <ButtonLink to="/plan/nuevo/income" variant="secondary">
                Empezar desde cero
              </ButtonLink>
            </div>
          }
        >
          Anota tus ingresos (mesada, fondo, trabajo), tus gastos fijos (gimnasio, gasolina,
          suscripciones) y cuánto ahorras. Lo que sobra es tu dinero libre del mes.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              aria-label="Mes anterior"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
              icon={<CaretLeftIcon aria-hidden="true" className="size-4" weight="bold" />}
            />
            <p className="text-center font-semibold first-letter:uppercase" aria-live="polite">
              {monthTitle(month)}
            </p>
            <Button
              variant="secondary"
              aria-label="Mes siguiente"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
              icon={<CaretRightIcon aria-hidden="true" className="size-4" weight="bold" />}
            />
          </div>

          <UpcomingPayments />

          <section aria-labelledby="plan-libre" className="flex flex-col gap-2">
            <h2 id="plan-libre" className="text-fg-muted">
              {negative ? 'El plan no alcanza: te faltan' : 'Dinero mío este mes'}
              <span className="sr-only"> {formatMoney(Math.abs(progress.money))}</span>
            </h2>
            <p
              aria-hidden="true"
              className={`tabular text-[clamp(2rem,10vw,3rem)] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] ${negative ? 'text-negative' : ''}`}
            >
              {negative ? formatSigned(progress.money) : formatMoney(progress.money)}
            </p>
            <p data-money className="text-sm text-fg-muted">
              {formatMoney(summary.totalIncome)} de ingresos − {formatMoney(summary.totalExpenses)}{' '}
              de gastos fijos − {formatMoney(summary.totalSavings)} para tarjetas y deudas
              {progress.overspend > 0 && (
                <> − {formatMoney(progress.overspend)} que te pasaste de los topes</>
              )}
              .
            </p>
            {month === monthOf(today) && (
              <p className="text-sm text-fg-muted">
                Este valor pasa solo a tu dinero personal como ingreso del mes.
              </p>
            )}
            {left !== null && (
              <p data-money className="text-sm text-fg-muted">
                Después de lo que ya gastaste de tu dinero personal este mes, te quedan{' '}
                <span className={`tabular font-semibold ${left < 0 ? 'text-negative' : 'text-fg'}`}>
                  {left < 0 ? formatSigned(left) : formatMoney(left)}
                </span>
                .{' '}
                <Link
                  to="/personal"
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-fg underline hover:text-primary"
                >
                  <LockSimpleIcon aria-hidden="true" className="size-4" />
                  Ver mi dinero personal
                </Link>
              </p>
            )}
          </section>

          <Section
            title="Ingresos"
            total={summary.totalIncome}
            kind="income"
            empty={summary.incomes.length === 0}
          >
            <ul className="divide-y divide-line">
              {summary.incomes.map((item) => (
                <ItemRow key={item.id} item={item} month={month} />
              ))}
            </ul>
          </Section>

          {(hasOldGroup || gasoline) && (
            <section
              aria-label="Ajustes sugeridos"
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <h2 className="text-sm font-semibold">Ajustes sugeridos para tu plan</h2>
              {hasOldGroup && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-fg-muted">
                    Tus suscripciones están en el grupo «Tarjeta».
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      applyFix(
                        () => renamePlanGroup(household.id, 'Tarjeta', 'Membresías'),
                        'Ahora se llama «Membresías»',
                      )
                    }
                  >
                    Llamarlo «Membresías»
                  </Button>
                </div>
              )}
              {gasoline && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-fg-muted">
                    Registra las tanqueadas de «{gasoline.name}» y se van restando.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      applyFix(() => setTracked(gasoline.id, true), 'Listo: ya puedes registrar')
                    }
                  >
                    Llevar tanqueadas
                  </Button>
                </div>
              )}
            </section>
          )}

          <Section
            title="Gastos fijos"
            total={summary.totalExpenses}
            kind="expense"
            empty={progress.groups.length === 0}
          >
            {progress.groups.length > 0 && (
              <p data-money className="pb-1 text-sm text-fg-muted">
                Pagado{' '}
                <span className="tabular font-semibold text-fg">
                  {formatMoney(progress.fixedPaid)}
                </span>{' '}
                de {formatMoney(progress.fixedTotal)}. Marca cada uno cuando lo pagues.
              </p>
            )}
            <ul className="divide-y divide-line">
              {progress.groups.map((group) => {
                const renderItem = (entry: (typeof group.items)[number]) =>
                  entry.item.tracked ? (
                    <TrackedRow key={entry.item.id} progress={entry} month={month} />
                  ) : (
                    <CheckRow
                      key={entry.item.id}
                      progress={entry}
                      month={month}
                      check={(checks.data ?? []).find(
                        (check) => check.planItemId === entry.item.id && check.month === month,
                      )}
                    />
                  )
                return group.name === null ? (
                  renderItem(group.items[0])
                ) : (
                  <li key={group.name} className="py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">
                        {group.name}{' '}
                        <span className="text-sm font-normal text-fg-muted">
                          · {group.paidCount} de {group.count} pagadas
                        </span>
                      </p>
                      <p className="tabular font-semibold">{formatMoney(group.planned)}</p>
                    </div>
                    <ul className="mt-1 ml-1 border-l border-line pl-1">
                      {group.items.map(renderItem)}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </Section>

          <Section
            title="Tarjetas y deudas (ahorro mensual)"
            total={summary.totalSavings}
            kind="saving"
            empty={summary.savings.length === 0}
          >
            <ul className="divide-y divide-line">
              {summary.savings.map((item) => (
                <ItemRow key={item.id} item={item} month={month} />
              ))}
            </ul>
            <div data-money className="mt-1 flex flex-col gap-1 text-sm text-fg-muted">
              <p>
                Ya pagaste de tus extractos{' '}
                <span className="tabular font-semibold text-fg">
                  {formatMoney(progress.debt.paid)}
                </span>
                {' · '}
                {progress.debt.remaining >= 0 ? (
                  <>
                    te quedan{' '}
                    <span className="tabular font-semibold text-fg">
                      {formatMoney(progress.debt.remaining)}
                    </span>{' '}
                    apartados
                  </>
                ) : (
                  <span className="text-negative">
                    te pasaste por {formatMoney(progress.debt.over)} (sale de Dinero mío)
                  </span>
                )}
                .
              </p>
              {progress.debt.statements.length > 0 && (
                <p>
                  Los extractos de este mes piden {formatMoney(progress.debt.due)}; faltan por pagar{' '}
                  <span className="tabular font-semibold text-fg">
                    {formatMoney(progress.debt.pending)}
                  </span>
                  .
                </p>
              )}
            </div>
            {progress.debt.statements.length > 0 && (
              <ul className="divide-y divide-line">
                {progress.debt.statements.map((statement) => {
                  const account = (accounts.data ?? []).find((a) => a.id === statement.accountId)
                  const done = statement.paidAmount >= statement.totalDue && statement.totalDue > 0
                  return (
                    <li key={statement.id}>
                      <Link
                        to={`/tarjetas/${statement.accountId}`}
                        className="-mx-2 flex items-baseline justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2/50"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{account?.name ?? 'Tarjeta'}</span>
                          <span className="block text-sm text-fg-muted">
                            {done
                              ? 'Pagado'
                              : `Pagado ${formatMoney(statement.paidAmount)} de ${formatMoney(statement.totalDue)}`}
                          </span>
                        </span>
                        <span className="shrink-0 tabular font-semibold">
                          {formatMoney(statement.totalDue)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <ButtonLink
              to="/tarjetas"
              variant="secondary"
              className="mt-2 self-start"
              icon={<CreditCardIcon aria-hidden="true" className="size-4" />}
            >
              Mis tarjetas y extractos
            </ButtonLink>
          </Section>
        </div>
      )}
    </Page>
  )
}
