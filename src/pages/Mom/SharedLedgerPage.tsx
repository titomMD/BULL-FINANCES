import { useParams } from 'react-router'
import { useSharedEntries, useSharedLedgers } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import { receivableBalance, receivableLedger } from '../../lib/calculations/receivables'
import { formatDay } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

/** Vista de solo lectura de una libreta que alguien compartió contigo («Mamá me debe», vista por ella). */
export function SharedLedgerPage() {
  const { ownerId = '' } = useParams()
  const ledgers = useSharedLedgers()
  const entries = useSharedEntries(ownerId)
  const ledger = ledgers.data?.find((item) => item.ownerId === ownerId)
  const list = entries.data ?? []
  const rows = receivableLedger(list)
  const name = ledger?.label ?? 'Libreta'

  return (
    <Page>
      <PageHeader
        title={name}
        description="Cada cobro y cada pago, con lo que se debía después de cada uno. Solo lectura."
      />
      {ledgers.loading || entries.loading ? (
        <LedgerSkeleton days={1} />
      ) : entries.error && !entries.data ? (
        <ErrorState message={toUserMessage(entries.error)} onRetry={invalidateData} />
      ) : !ledger ? (
        <EmptyState title="No encontramos esta libreta">
          Puede que ya no esté compartida contigo.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl bg-surface px-4 py-4 sm:px-5">
            <p className="text-sm text-fg-muted">Hoy se debe</p>
            <p data-money className="tabular text-3xl font-semibold">
              {formatMoney(receivableBalance(list))}
            </p>
          </section>
          <section className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Bitácora</h2>
            {rows.length === 0 ? (
              <p className="py-2 text-sm text-fg-muted">Aún no hay movimientos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map(({ entry, runningBalance }) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {entry.kind === 'payment' ? 'Pago' : 'Cobro'}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </span>
                      <span data-money className="text-xs text-fg-muted">
                        {formatDay(entry.date)} · quedaba {formatMoney(runningBalance)}
                      </span>
                    </span>
                    <span data-money className="tabular font-semibold">
                      {entry.kind === 'payment' ? '−' : '+'}
                      {formatMoney(entry.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  )
}
