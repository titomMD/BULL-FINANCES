import { Link } from 'react-router'
import { CreditCardIcon, PlusIcon } from '@phosphor-icons/react'
import { useDebtAccounts, useDebtStatements } from '../../hooks/useDebts'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { formatDay } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { CardIcon } from '../../components/debts/CardIcon'
import { ButtonLink } from '../../components/ui/Button'
import { DollarBox } from '../../components/debts/DollarBox'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

/** Tarjetas de crédito o deudas: una sección por tarjeta con sus extractos. */
export function DebtsPage() {
  const accounts = useDebtAccounts()
  const statements = useDebtStatements()
  const list = (accounts.data ?? []).filter((account) => !account.archivedAt)
  const all = statements.data ?? []
  const pendingTotal = all.reduce(
    (total, statement) => total + Math.max(0, statement.totalDue - statement.paidAmount),
    0,
  )

  return (
    <Page>
      <PageHeader
        title="Tarjetas de crédito o deudas"
        description="Guarda tus extractos y fotos. El pago de cada mes se resta del dinero que apartas en tu plan."
        actions={
          <ButtonLink
            to="/tarjetas/nueva"
            icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
          >
            Tarjeta
          </ButtonLink>
        }
      />
      <DollarBox />
      {accounts.loading || statements.loading ? (
        <LedgerSkeleton days={1} />
      ) : accounts.error && !accounts.data ? (
        <ErrorState message={toUserMessage(accounts.error)} onRetry={invalidateData} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title="Añade tu primera tarjeta"
          action={<ButtonLink to="/tarjetas/nueva">Añadir tarjeta</ButtonLink>}
        >
          Guarda el nombre y los últimos 4 dígitos (nunca el número completo), sube la foto de la
          tarjeta y los extractos de cada mes.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <p data-money className="text-sm text-fg-muted">
            Te falta por pagar en total{' '}
            <span className="tabular font-semibold text-fg">{formatMoney(pendingTotal)}</span> de
            los extractos guardados.
          </p>
          <ul className="flex flex-col gap-3">
            {list.map((account) => {
              const mine = all.filter((statement) => statement.accountId === account.id)
              const last = mine[0]
              const pending = mine.reduce(
                (total, statement) =>
                  total + Math.max(0, statement.totalDue - statement.paidAmount),
                0,
              )
              return (
                <li key={account.id}>
                  <Link
                    to={`/tarjetas/${account.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
                  >
                    <CardIcon name={account.name} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">
                        {account.name}
                        {account.last4 && (
                          <span className="font-normal text-fg-muted"> · •••• {account.last4}</span>
                        )}
                      </span>
                      <span className="text-sm text-fg-muted">
                        {last
                          ? `Último extracto: corte ${formatDay(last.statementDate)}`
                          : 'Aún sin extractos'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm text-fg-muted">Por pagar</span>
                      <span className="tabular font-semibold">{formatMoney(pending)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Page>
  )
}
