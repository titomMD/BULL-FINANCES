import { Link } from 'react-router'
import { HandCoinsIcon, PiggyBankIcon, PlusIcon } from '@phosphor-icons/react'
import { usePockets, usePocketMoves, useReceivableEntries } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import { summarizePockets, totalInPockets } from '../../lib/calculations/pockets'
import { receivableBalance } from '../../lib/calculations/receivables'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { PocketBar } from '../../components/pockets/PocketBar'
import { ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'

/** Bolsillos: el espejo de los de Bancolombia, con meta, avance y lo que mamá te debe. */
export function PocketsPage() {
  const pockets = usePockets()
  const moves = usePocketMoves()
  const receivable = useReceivableEntries()
  const owed = receivableBalance(receivable.data ?? [])
  const summaries = summarizePockets(pockets.data ?? [], moves.data ?? [])
  const active = summaries.filter((entry) => !entry.pocket.archivedAt)
  const archived = summaries.filter((entry) => entry.pocket.archivedAt)

  return (
    <Page>
      <PageHeader
        title="Bolsillos"
        description="Cada bolsillo con su saldo y su meta, igual que en Bancolombia."
        actions={
          <ButtonLink
            to="/bolsillos/nuevo"
            icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
          >
            Bolsillo
          </ButtonLink>
        }
      />
      {pockets.loading || moves.loading ? (
        <LedgerSkeleton days={1} />
      ) : pockets.error && !pockets.data ? (
        <ErrorState message={toUserMessage(pockets.error)} onRetry={invalidateData} />
      ) : (
        <div className="flex flex-col gap-4">
          <p data-money className="text-sm text-fg-muted">
            Tienes repartido en bolsillos{' '}
            <span className="tabular font-semibold text-fg">
              {formatMoney(totalInPockets(summaries))}
            </span>
            .
          </p>
          <Link
            to="/mama"
            className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
          >
            <HandCoinsIcon aria-hidden="true" className="size-6 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">Mamá me debe</span>
              <span className="text-sm text-fg-muted">Tu libreta de cobros y pagos</span>
            </span>
            <span data-money className="tabular font-semibold">
              {formatMoney(owed)}
            </span>
          </Link>
          {active.length === 0 ? (
            <EmptyState
              icon={<PiggyBankIcon />}
              title="Crea tu primer bolsillo"
              action={<ButtonLink to="/bolsillos/nuevo">Nuevo bolsillo</ButtonLink>}
            >
              Ponle el nombre que tiene en Bancolombia, lo que tiene hoy y, si quieres, su meta.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {active.map(({ pocket, balance, lent, missing, progressBp }) => (
                <li key={pocket.id}>
                  <Link
                    to={`/bolsillos/${pocket.id}`}
                    className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3.5 transition-colors hover:bg-surface-2/60 sm:px-5"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{pocket.name}</span>
                      <span data-money className="tabular font-semibold">
                        {formatMoney(balance)}
                      </span>
                    </span>
                    {progressBp !== null && pocket.goal !== null && (
                      <>
                        <PocketBar progressBp={progressBp} label={`Avance de ${pocket.name}`} />
                        <span data-money className="text-sm text-fg-muted">
                          Meta {formatMoney(pocket.goal)}
                          {missing ? ` · te faltan ${formatMoney(missing)}` : ' · meta cumplida'}
                        </span>
                      </>
                    )}
                    {pocket.coversReceivable && missing ? (
                      <span data-money className="text-sm text-fg-muted">
                        Mamá te debe {formatMoney(owed)}
                        {owed === missing
                          ? ': con eso completas la meta.'
                          : owed < missing
                            ? ` y aún sobran ${formatMoney(missing - owed)} sin explicar.`
                            : '.'}
                      </span>
                    ) : null}
                    {lent > 0 && (
                      <span data-money className="text-sm text-fg-muted">
                        Prestado de este bolsillo: {formatMoney(lent)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <details className="rounded-2xl bg-surface px-4 py-3 sm:px-5">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">
                Archivados ({archived.length})
              </summary>
              <ul className="divide-y divide-line">
                {archived.map(({ pocket, balance }) => (
                  <li key={pocket.id}>
                    <Link
                      to={`/bolsillos/${pocket.id}`}
                      className="flex min-h-11 items-center justify-between gap-3 py-2"
                    >
                      <span>{pocket.name}</span>
                      <span data-money className="tabular text-fg-muted">
                        {formatMoney(balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Page>
  )
}
