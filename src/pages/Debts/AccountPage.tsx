import { useParams } from 'react-router'
import { NotePencilIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import {
  useCardExpenses,
  useDebtAccounts,
  useDebtPayments,
  useDebtStatements,
} from '../../hooks/useDebts'
import { invalidateData } from '../../hooks/useResource'
import { nextCutDate } from '../../lib/calculations/cards'
import { expensesSinceCut } from '../../lib/calculations/cards'
import { formatDay, formatMonthName, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { formatUsd } from '../../lib/usd'
import { deletePayment } from '../../services/debts'
import type { DebtPayment, DebtStatement } from '../../types/domain'
import { cardImageFor } from '../../lib/cardImages'
import { CardArt } from '../../components/debts/CardArt'
import { StoredFile } from '../../components/debts/StoredFile'
import { CardExpenses } from '../../components/debts/CardExpenses'
import { CardPayments } from '../../components/debts/CardPayments'
import { DollarBox } from '../../components/debts/DollarBox'
import { InterestPanel } from '../../components/debts/InterestPanel'
import { PayMonthPicker } from '../../components/debts/PayMonthPicker'
import { ButtonLink } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const monthTitle = (month: string) => `${formatMonthName(`${month}-01`)} ${month.slice(0, 4)}`

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  )
}

function PaymentHistory({ payments }: { payments: DebtPayment[] }) {
  const toast = useToast()
  if (payments.length === 0) return null
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <h3 className="font-semibold">Pagos registrados</h3>
      <ul className="divide-y divide-line">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
            <span className="flex flex-col">
              <span className="font-medium">
                {payment.kind === 'minimum'
                  ? 'Pago mínimo'
                  : payment.kind === 'full'
                    ? 'Pago total'
                    : 'Abono'}{' '}
                · {payment.currency === 'USD' ? 'dólares' : 'pesos'}
              </span>
              <span className="text-xs text-fg-muted">{formatDay(payment.paidOn)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular font-semibold">
                {payment.currency === 'USD'
                  ? formatUsd(payment.amount)
                  : formatMoney(payment.amount)}
              </span>
              <button
                type="button"
                aria-label="Borrar este pago"
                className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                onClick={async () => {
                  try {
                    await deletePayment(payment.id)
                    invalidateData()
                  } catch (error) {
                    toast.show(toUserMessage(error), 'error')
                  }
                }}
              >
                <TrashIcon aria-hidden="true" className="size-5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatementCard({ statement, accountId }: { statement: DebtStatement; accountId: string }) {
  return (
    <li className="rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-semibold">Corte {formatDay(statement.statementDate)}</span>
            <span className="text-sm text-fg-muted">
              Se paga en {monthTitle(statement.payMonth)}
              {statement.paidAmount >= statement.totalDue && statement.totalDue > 0
                ? ' · pagado'
                : ''}
            </span>
          </span>
          <span className="tabular font-semibold">{formatMoney(statement.totalDue)}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <dl className="divide-y divide-line">
            <Row label="Total a pagar" value={formatMoney(statement.totalDue)} />
            <Row label="Pago mínimo" value={formatMoney(statement.minimumDue)} />
            {statement.usdTotalDue > 0 && (
              <Row
                label="En dólares (total / mínimo)"
                value={`${formatUsd(statement.usdTotalDue)} / ${formatUsd(statement.usdMinimumDue)}`}
              />
            )}
            {statement.feeAmount !== null && (
              <Row label="Cuota de manejo" value={formatMoney(statement.feeAmount)} />
            )}
            {statement.dueDate && <Row label="Fecha límite" value={formatDay(statement.dueDate)} />}
            {statement.previousBalance !== null && (
              <Row label="Saldo anterior" value={formatMoney(statement.previousBalance)} />
            )}
            {statement.purchases !== null && (
              <Row label="Compras del periodo" value={formatMoney(statement.purchases)} />
            )}
            {statement.interest !== null && (
              <Row label="Intereses" value={formatMoney(statement.interest)} />
            )}
          </dl>
          <PayMonthPicker statementId={statement.id} payMonth={statement.payMonth} />
          <p data-money className="text-sm">
            Pagado {formatMoney(statement.paidAmount)}
            {statement.usdPaid > 0 ? ` y ${formatUsd(statement.usdPaid)}` : ''}
            {statement.paidOn ? ` · último pago ${formatDay(statement.paidOn)}` : ''}
          </p>
          {statement.notes && <p className="text-sm whitespace-pre-line">{statement.notes}</p>}
          {statement.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="pb-1 text-left font-medium">
                  Movimientos ({statement.lines.length})
                </caption>
                <tbody className="divide-y divide-line">
                  {statement.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-fg-muted">
                        {line.date ? formatDay(line.date) : ''}
                      </td>
                      <td className="py-1.5 pr-3">{line.detail}</td>
                      <td className="py-1.5 text-right tabular font-semibold">
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {statement.filePath && (
            <StoredFile
              path={statement.filePath}
              name={statement.fileName}
              alt={`Extracto del ${statement.statementDate}`}
              className="max-h-96 w-auto max-w-full"
            />
          )}
          <ButtonLink
            to={`/tarjetas/${accountId}/extractos/${statement.id}`}
            variant="secondary"
            className="self-start"
            icon={<NotePencilIcon aria-hidden="true" className="size-4" />}
          >
            Editar extracto
          </ButtonLink>
        </div>
      </details>
    </li>
  )
}

/** Una tarjeta: su foto, sus datos y todos sus extractos para consultar. */
export function AccountPage() {
  const { id } = useParams()
  useHousehold()
  const accounts = useDebtAccounts()
  const statements = useDebtStatements()
  const payments = useDebtPayments()
  const cardExpenses = useCardExpenses()
  const account = accounts.data?.find((entry) => entry.id === id)
  const mine = (statements.data ?? []).filter((statement) => statement.accountId === id)
  const myPayments = (payments.data ?? []).filter((payment) => payment.accountId === id)
  const latest = mine[0]
  const today = todayBogota()
  const lastCut = latest?.statementDate ?? null
  const myExpenses = expensesSinceCut(
    (cardExpenses.data ?? []).filter((expense) => expense.accountId === id),
    lastCut,
  )
  const until = nextCutDate(today, account?.cutDay ?? null, lastCut ?? undefined)
  const pendingCop = latest ? Math.max(0, latest.totalDue - latest.paidAmount) : 0

  return (
    <Page>
      <PageHeader
        title={account?.name ?? 'Tarjeta'}
        back="/tarjetas"
        description={account?.last4 ? `•••• ${account.last4}` : undefined}
        actions={
          account && (
            <ButtonLink to={`/tarjetas/${account.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
          )
        }
      />
      {accounts.loading || statements.loading ? (
        <LedgerSkeleton days={1} />
      ) : accounts.error && !accounts.data ? (
        <ErrorState message={toUserMessage(accounts.error)} onRetry={invalidateData} />
      ) : !account ? (
        <EmptyState title="No encontramos esa tarjeta">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {!account.imagePath &&
            (cardImageFor(account.name) ? (
              <img
                src={cardImageFor(account.name)!}
                alt={`Tarjeta ${account.name}`}
                className="w-full max-w-72 rounded-2xl"
              />
            ) : (
              <CardArt name={account.name} last4={account.last4} />
            ))}
          {account.imagePath && (
            <StoredFile
              path={account.imagePath}
              alt={`Foto de ${account.name}`}
              className="max-h-56 w-auto max-w-full"
            />
          )}
          {(account.cutDay || account.dueDay || account.notes) && (
            <p className="text-sm text-fg-muted">
              {account.cutDay && <>Corte el día {account.cutDay}. </>}
              {account.dueDay && <>Pagas hasta el día {account.dueDay}. </>}
              {account.notes}
            </p>
          )}
          <DollarBox />
          {latest && (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">
                Extracto del {formatDay(latest.statementDate)} · se paga en{' '}
                {monthTitle(latest.payMonth)}
              </h2>
              <PayMonthPicker statementId={latest.id} payMonth={latest.payMonth} />
              <CardPayments statement={latest} accountId={account.id} until={until} />
              <InterestPanel
                balance={pendingCop}
                ratePpm={latest.monthlyRatePpm}
                today={today}
                until={until}
                extras={myPayments.filter((payment) => payment.kind === 'extra')}
              />
            </section>
          )}
          <CardExpenses accountId={account.id} expenses={myExpenses} since={lastCut} />
          <PaymentHistory payments={myPayments} />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Extractos</h2>
            <ButtonLink
              to={`/tarjetas/${account.id}/extractos/nuevo`}
              icon={<PlusIcon aria-hidden="true" className="size-4" weight="bold" />}
            >
              Extracto
            </ButtonLink>
          </div>
          {mine.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Aún no hay extractos. Sube el PDF o la foto y copia sus datos para tenerlos a la mano.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mine.map((statement) => (
                <StatementCard key={statement.id} statement={statement} accountId={account.id} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  )
}
