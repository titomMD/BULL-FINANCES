import { useState } from 'react'
import { Link } from 'react-router'
import { GasPumpIcon, TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { invalidateData } from '../../hooks/useResource'
import type { ItemProgress } from '../../lib/calculations/planMonth'
import { installmentOf } from '../../lib/calculations/plan'
import { todayBogota, formatDay } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatSigned, parseMoneyInput } from '../../lib/money'
import { createPlanEntry, deletePlanEntry, markPaid, unmarkPaid } from '../../services/plan'
import type { PlanCheck } from '../../types/domain'
import { MoneyInput } from '../forms/MoneyInput'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { useToast } from '../ui/toast-context'

/** Gasto fijo con casilla «ya lo pagué este mes». */
export function CheckRow({
  progress,
  month,
  check,
}: {
  progress: ItemProgress
  month: string
  check: PlanCheck | undefined
}) {
  const { household } = useHousehold()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { item } = progress
  const installment = installmentOf(item, month)

  const toggle = async () => {
    setBusy(true)
    try {
      if (check) await unmarkPaid(check.id)
      else await markPaid(household.id, item.id, month)
      invalidateData()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar la marca.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-1">
      <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          checked={Boolean(check)}
          disabled={busy}
          onChange={toggle}
          aria-label={`${item.name}: ${check ? 'pagado' : 'sin pagar'}`}
          className="size-5 accent-(--color-primary)"
        />
      </label>
      <Link
        to={`/plan/${item.id}`}
        className="flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
      >
        <span className="flex min-w-0 flex-col">
          <span className={`font-medium break-words ${check ? 'text-fg-muted line-through' : ''}`}>
            {item.name}
          </span>
          {check && <span className="text-sm text-positive">Pagado este mes</span>}
          {installment && (
            <span className="text-sm text-fg-muted">
              Cuota {installment.current} de {installment.total}
            </span>
          )}
        </span>
        <span className="shrink-0 tabular font-semibold">{formatMoney(item.amount)}</span>
      </Link>
    </li>
  )
}

/** Línea con tope mensual y registro de gastos (las tanqueadas de la gasolina). */
export function TrackedRow({ progress, month }: { progress: ItemProgress; month: string }) {
  const { household } = useHousehold()
  const toast = useToast()
  const { item } = progress
  const today = todayBogota()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(month === today.slice(0, 7) ? today : `${month}-01`)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const value = parseMoneyInput(amount)
    if (!value) {
      toast.show('Escribe cuánto fue.', 'error')
      return
    }
    setBusy(true)
    try {
      await createPlanEntry(household.id, item.id, { date, amount: value, note })
      invalidateData()
      setAmount('')
      setNote('')
      toast.show('Registrado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos registrarlo.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deletePlanEntry(id)
      invalidateData()
    } catch (error) {
      toast.show(toUserMessage(error), 'error')
    }
  }

  const pct = item.amount > 0 ? Math.min(100, Math.round((progress.spent / item.amount) * 100)) : 0
  const over = progress.remaining < 0

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Link to={`/plan/${item.id}`} className="font-medium break-words hover:underline">
          {item.name}
        </Link>
        <span className="shrink-0 tabular font-semibold">{formatMoney(item.amount)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${item.name}: gastado`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={`h-full rounded-full ${over ? 'bg-negative' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p data-money className="mt-1.5 text-sm text-fg-muted">
        Llevas <span className="tabular font-semibold text-fg">{formatMoney(progress.spent)}</span>
        {' · '}
        {over ? (
          <span className="text-negative">
            te pasaste por{' '}
            <span className="tabular font-semibold">{formatMoney(progress.over)}</span>
            {' (sale de Dinero mío)'}
          </span>
        ) : (
          <>
            te quedan{' '}
            <span className="tabular font-semibold text-fg">
              {formatSigned(progress.remaining)}
            </span>
          </>
        )}
      </p>

      {progress.entries.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl bg-surface-2/50 px-3">
          {progress.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0">
                {formatDay(entry.date)}
                {entry.note && <span className="text-fg-muted"> · {entry.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular font-semibold">{formatMoney(entry.amount)}</span>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label={`Quitar registro de ${formatMoney(entry.amount)}`}
                  className="grid size-9 place-items-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-negative"
                >
                  <TrashIcon aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface-2/50 p-3">
          <Field label="¿Cuánto fue?">
            {({ id }) => <MoneyInput id={id} autoFocus value={amount} onChange={setAmount} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="Nota (opcional)">
              {({ id }) => (
                <TextInput
                  id={id}
                  maxLength={200}
                  placeholder="Terpel, 5 galones…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={add} loading={busy}>
              Guardar
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => setOpen(true)}
          icon={<GasPumpIcon aria-hidden="true" className="size-4" />}
        >
          Registrar tanqueada
        </Button>
      )}
    </li>
  )
}
