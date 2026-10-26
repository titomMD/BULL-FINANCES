import { useState } from 'react'
import { useParams } from 'react-router'
import { TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { usePockets, usePocketMoves, useReceivableEntries } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import { adjustmentFor, summarizePockets, pocketBorrowed } from '../../lib/calculations/pockets'
import { receivableBalance } from '../../lib/calculations/receivables'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatSigned, parseMoneyInput } from '../../lib/money'
import { createPocketMove, deletePocketMove, movePocketMoney } from '../../services/pockets'
import type { PocketMoveKind } from '../../types/domain'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { PocketBar } from '../../components/pockets/PocketBar'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

type Action =
  'deposit' | 'withdraw' | 'lend_out' | 'lend_back' | 'transfer' | 'loan' | 'return' | 'adjust'

const ACTIONS: Array<{ value: Action; label: string; other?: boolean }> = [
  { value: 'deposit', label: 'Meter dinero' },
  { value: 'withdraw', label: 'Sacar dinero' },
  { value: 'lend_out', label: 'Sacar prestado para gastos' },
  { value: 'lend_back', label: 'Devolver al bolsillo lo prestado' },
  { value: 'transfer', label: 'Trasladar a otro bolsillo', other: true },
  { value: 'loan', label: 'Prestar a otro bolsillo', other: true },
  { value: 'return', label: 'Devolver a otro bolsillo lo que me prestó', other: true },
  { value: 'adjust', label: 'Ajustar al saldo de Bancolombia' },
]

const KIND_LABEL: Record<PocketMoveKind, string> = {
  deposit: 'Entró dinero',
  withdraw: 'Salió dinero',
  adjust: 'Ajuste de saldo',
  transfer: 'Traslado',
  loan_out: 'Prestado',
  loan_in: 'Recibido en préstamo',
  loan_back: 'Devuelto al bolsillo',
  loan_return: 'Devuelto a quien prestó',
}

function PocketActions({ pocketId, balance }: { pocketId: string; balance: number }) {
  const { household } = useHousehold()
  const toast = useToast()
  const pockets = usePockets()
  const [action, setAction] = useState<Action>('deposit')
  const [amount, setAmount] = useState('')
  const [other, setOther] = useState('')
  const [date, setDate] = useState(todayBogota())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const current = ACTIONS.find((entry) => entry.value === action)!
  const others = (pockets.data ?? []).filter((entry) => entry.id !== pocketId && !entry.archivedAt)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseMoneyInput(amount)
    if (value === null || (value === 0 && action !== 'adjust')) {
      return toast.show('Escribe cuánto fue.', 'error')
    }
    if (current.other && !other) return toast.show('Elige el otro bolsillo.', 'error')
    setBusy(true)
    try {
      const base = { pocketId, date, note }
      if (action === 'deposit') {
        await createPocketMove(household.id, { ...base, amount: value, kind: 'deposit' })
      } else if (action === 'withdraw') {
        await createPocketMove(household.id, { ...base, amount: -value, kind: 'withdraw' })
      } else if (action === 'lend_out') {
        await createPocketMove(household.id, { ...base, amount: -value, kind: 'loan_out' })
      } else if (action === 'lend_back') {
        await createPocketMove(household.id, { ...base, amount: value, kind: 'loan_back' })
      } else if (action === 'adjust') {
        const diff = adjustmentFor(balance, value)
        if (diff === 0) {
          toast.show('Ya coincide con ese saldo.')
          return
        }
        await createPocketMove(household.id, { ...base, amount: diff, kind: 'adjust' })
      } else {
        await movePocketMoney({
          from: pocketId,
          to: other,
          amount: value,
          kind: action === 'transfer' ? 'transfer' : action === 'loan' ? 'loan' : 'loan_back',
          date,
          note,
        })
      }
      invalidateData()
      setAmount('')
      setNote('')
      toast.show('Guardado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-3 rounded-2xl bg-surface px-4 py-4 sm:grid-cols-2 sm:px-5"
    >
      <Field label="¿Qué hiciste?" className="sm:col-span-2">
        {({ id }) => (
          <Select id={id} value={action} onChange={(e) => setAction(e.target.value as Action)}>
            {ACTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {current.other && (
        <Field label="Con cuál bolsillo" className="sm:col-span-2">
          {({ id }) => (
            <Select id={id} value={other} onChange={(e) => setOther(e.target.value)}>
              <option value="">Elige uno</option>
              {others.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field
        label={action === 'adjust' ? 'Saldo que dice Bancolombia hoy' : 'Valor'}
        hint={
          action === 'adjust'
            ? `Hoy la app tiene ${formatMoney(balance)}. Se registra la diferencia.`
            : undefined
        }
      >
        {({ id }) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
      </Field>
      <Field label="Fecha">
        {({ id }) => (
          <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </Field>
      <Field label="Nota (opcional)" className="sm:col-span-2">
        {({ id }) => (
          <TextInput
            id={id}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" loading={busy} className="sm:col-span-2 sm:justify-self-start">
        Guardar
      </Button>
    </form>
  )
}

/** Un bolsillo: saldo, meta, lo prestado, acciones y su historial. */
export function PocketPage() {
  const { id } = useParams()
  const toast = useToast()
  const pockets = usePockets()
  const moves = usePocketMoves()
  const receivable = useReceivableEntries()
  const pocket = pockets.data?.find((entry) => entry.id === id)
  const allMoves = moves.data ?? []
  const summary = pocket ? summarizePockets([pocket], allMoves)[0] : undefined
  const mine = allMoves.filter((move) => move.pocketId === id)
  const owed = receivableBalance(receivable.data ?? [])
  const borrowed = pocket ? pocketBorrowed(allMoves, pocket.id) : 0
  const names = new Map((pockets.data ?? []).map((entry) => [entry.id, entry.name]))

  return (
    <Page>
      <PageHeader
        title={pocket?.name ?? 'Bolsillo'}
        back="/bolsillos"
        actions={
          pocket && (
            <ButtonLink to={`/bolsillos/${pocket.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
          )
        }
      />
      {pockets.loading || moves.loading ? (
        <LedgerSkeleton days={1} />
      ) : pockets.error && !pockets.data ? (
        <ErrorState message={toUserMessage(pockets.error)} onRetry={invalidateData} />
      ) : !pocket || !summary ? (
        <EmptyState title="No encontramos ese bolsillo">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-4 sm:px-5">
            <p data-money className="tabular text-3xl font-semibold">
              {formatMoney(summary.balance)}
            </p>
            {summary.progressBp !== null && pocket.goal !== null && (
              <>
                <PocketBar progressBp={summary.progressBp} label={`Avance de ${pocket.name}`} />
                <p data-money className="text-sm text-fg-muted">
                  Meta {formatMoney(pocket.goal)}
                  {summary.missing
                    ? ` · te faltan ${formatMoney(summary.missing)}`
                    : ' · meta cumplida'}
                </p>
              </>
            )}
            {pocket.coversReceivable && summary.missing ? (
              <p data-money className="text-sm">
                Mamá te debe {formatMoney(owed)}.{' '}
                {owed === summary.missing
                  ? 'Justo lo que falta: cuando ella pague, devuelves ese dinero aquí.'
                  : `La diferencia con lo que falta es ${formatMoney(Math.abs(summary.missing - owed))}.`}
              </p>
            ) : null}
            {summary.lent > 0 && (
              <p data-money className="text-sm text-fg-muted">
                Prestado de este bolsillo y sin devolver: {formatMoney(summary.lent)}
              </p>
            )}
            {borrowed > 0 && (
              <p data-money className="text-sm text-fg-muted">
                Este bolsillo debe devolver: {formatMoney(borrowed)}
              </p>
            )}
          </section>
          <PocketActions pocketId={pocket.id} balance={summary.balance} />
          <section className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Movimientos</h2>
            {mine.length === 0 ? (
              <p className="py-2 text-sm text-fg-muted">Aún no hay movimientos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {mine.map((move) => (
                  <li key={move.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{KIND_LABEL[move.kind]}</span>
                      <span className="truncate text-xs text-fg-muted">
                        {formatDay(move.date)}
                        {move.note ? ` · ${move.note}` : ''}
                        {move.linkId
                          ? ` · con ${
                              names.get(
                                allMoves.find(
                                  (other) => other.linkId === move.linkId && other.id !== move.id,
                                )?.pocketId ?? '',
                              ) ?? 'otro bolsillo'
                            }`
                          : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span data-money className="tabular font-semibold">
                        {formatSigned(move.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label="Borrar este movimiento"
                        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                        onClick={async () => {
                          try {
                            await deletePocketMove(move.id)
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
            )}
          </section>
        </div>
      )}
    </Page>
  )
}
