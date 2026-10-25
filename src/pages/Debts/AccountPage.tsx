import { useState } from 'react'
import { useParams } from 'react-router'
import { NotePencilIcon, PlusIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useDebtAccounts, useDebtStatements } from '../../hooks/useDebts'
import { invalidateData } from '../../hooks/useResource'
import { formatDay, formatMonthName, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { setStatementPayment } from '../../services/debts'
import type { DebtStatement } from '../../types/domain'
import { CardArt } from '../../components/debts/CardArt'
import { StoredFile } from '../../components/debts/StoredFile'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { Button, ButtonLink } from '../../components/ui/Button'
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

function Payment({ statement }: { statement: DebtStatement }) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = Math.max(0, statement.totalDue - statement.paidAmount)

  const save = async (paid: number) => {
    setBusy(true)
    try {
      await setStatementPayment(statement.id, paid, paid > 0 ? todayBogota() : null)
      invalidateData()
      setAmount('')
      toast.show('Pago guardado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar el pago.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-2/50 p-3">
      <p data-money className="text-sm">
        {pending === 0 && statement.totalDue > 0 ? (
          <>
            Pagado completo
            {statement.paidOn ? ` el ${formatDay(statement.paidOn)}` : ''}.
          </>
        ) : (
          <>
            Pagado{' '}
            <span className="tabular font-semibold">{formatMoney(statement.paidAmount)}</span>
            {' · '}falta <span className="tabular font-semibold">{formatMoney(pending)}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <MoneyInput
            aria-label="Cuánto pagaste en total de este extracto"
            placeholder="Total pagado"
            value={amount}
            onChange={setAmount}
          />
        </div>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => {
            const value = parseMoneyInput(amount)
            if (value === null) return toast.show('Escribe cuánto pagaste.', 'error')
            void save(value)
          }}
        >
          Guardar pago
        </Button>
        {pending > 0 && (
          <Button loading={busy} onClick={() => save(statement.totalDue)}>
            Pagar todo
          </Button>
        )}
      </div>
    </div>
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
          <Payment statement={statement} />
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
  const account = accounts.data?.find((entry) => entry.id === id)
  const mine = (statements.data ?? []).filter((statement) => statement.accountId === id)

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
          {!account.imagePath && <CardArt name={account.name} last4={account.last4} />}
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
