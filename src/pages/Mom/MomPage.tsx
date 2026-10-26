import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon, TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useReceivableEntries, useReceivableRules } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import {
  monthlyEquivalent,
  pendingCharges,
  receivableBalance,
  receivableLedger,
} from '../../lib/calculations/receivables'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import {
  applyPendingCharges,
  createReceivableEntry,
  createReceivableRule,
  deleteReceivableEntry,
  deleteReceivableRule,
  setReceivableRuleActive,
} from '../../services/pockets'
import type { ReceivableFrequency } from '../../types/domain'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

function EntryForm() {
  const { household } = useHousehold()
  const toast = useToast()
  const [kind, setKind] = useState<'charge' | 'payment'>('payment')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayBogota())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseMoneyInput(amount)
    if (!value) return toast.show('Escribe cuánto fue.', 'error')
    setBusy(true)
    try {
      await createReceivableEntry(household.id, { kind, amount: value, date, note })
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
      <Field label="¿Qué pasó?" className="sm:col-span-2">
        {({ id }) => (
          <Select
            id={id}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'charge' | 'payment')}
          >
            <option value="payment">Mamá me pagó</option>
            <option value="charge">Mamá me debe más</option>
          </Select>
        )}
      </Field>
      <Field label="Valor">
        {({ id }) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
      </Field>
      <Field label="Fecha">
        {({ id }) => (
          <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </Field>
      <Field
        label="Detalle (opcional)"
        hint="Parqueadero, gafas cuota 2 de 3, Outlook…"
        className="sm:col-span-2"
      >
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

function RuleForm() {
  const { household } = useHousehold()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<ReceivableFrequency>('weekly')
  const [startsOn, setStartsOn] = useState(todayBogota())
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseMoneyInput(amount)
    if (!label.trim()) return toast.show('Ponle un nombre al cobro.', 'error')
    if (!value) return toast.show('Escribe cuánto es.', 'error')
    setBusy(true)
    try {
      await createReceivableRule(household.id, {
        label,
        amount: value,
        frequency,
        startsOn,
        endsOn: null,
      })
      invalidateData()
      setLabel('')
      setAmount('')
      toast.show('Cobro automático creado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre">
        {({ id }) => (
          <TextInput
            id={id}
            maxLength={80}
            placeholder="Almuerzos, parqueadero, cuota…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
      </Field>
      <Field label="Valor">
        {({ id }) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
      </Field>
      <Field label="Cada">
        {({ id }) => (
          <Select
            id={id}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ReceivableFrequency)}
          >
            <option value="weekly">Semana</option>
            <option value="monthly">Mes</option>
          </Select>
        )}
      </Field>
      <Field label="Desde" hint="Se cobra ese día y luego cada semana o cada mes.">
        {({ id }) => (
          <TextInput
            id={id}
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={busy}
        className="sm:col-span-2 sm:justify-self-start"
      >
        Agregar cobro automático
      </Button>
    </form>
  )
}

/** Libreta «Mamá me debe»: cobros, pagos y cobros que se repiten. */
export function MomPage() {
  const { household } = useHousehold()
  const toast = useToast()
  const entries = useReceivableEntries()
  const rules = useReceivableRules()
  const applied = useRef(false)
  const today = todayBogota()

  // Registra los cobros automáticos que ya tocaban (una sola vez al abrir la pantalla).
  useEffect(() => {
    if (applied.current || !rules.data || !entries.data) return
    applied.current = true
    const pending = pendingCharges(rules.data, today)
    const stale = rules.data.filter((rule) => rule.active && rule.generatedUntil !== today)
    if (pending.length === 0 && stale.length === 0) return
    void applyPendingCharges(
      household.id,
      pending,
      stale.map((rule) => rule.id),
      today,
    )
      .then(() => invalidateData())
      .catch((error) => toast.show(toUserMessage(error), 'error'))
  }, [rules.data, entries.data, household.id, today, toast])

  const list = entries.data ?? []
  const ledger = receivableLedger(list)
  const balance = receivableBalance(list)

  return (
    <Page>
      <PageHeader
        title="Mamá me debe"
        back="/bolsillos"
        description="Tu libreta: lo que se acumula y lo que ella te va pagando."
      />
      {entries.loading || rules.loading ? (
        <LedgerSkeleton days={1} />
      ) : entries.error && !entries.data ? (
        <ErrorState message={toUserMessage(entries.error)} onRetry={invalidateData} />
      ) : (
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl bg-surface px-4 py-4 sm:px-5">
            <p className="text-sm text-fg-muted">Hoy te debe</p>
            <p data-money className="tabular text-3xl font-semibold">
              {formatMoney(balance)}
            </p>
            {list.length === 0 && (
              <p className="mt-2 text-sm text-fg-muted">
                Para empezar, agrega abajo lo que te debe hoy como «Mamá me debe más» (por ejemplo,
                con el detalle «Saldo inicial»).
              </p>
            )}
          </section>
          <EntryForm />
          <section className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold">Cobros automáticos</h2>
              <p className="text-sm text-fg-muted">
                Se suman solos a lo que te debe en su fecha. Puedes borrar cualquiera de la libreta,
                o pausar el cobro.
              </p>
            </div>
            {(rules.data ?? []).length > 0 && (
              <ul className="divide-y divide-line">
                {(rules.data ?? []).map((rule) => (
                  <li key={rule.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {rule.label}
                        {!rule.active && <span className="text-fg-muted"> · en pausa</span>}
                      </span>
                      <span data-money className="text-xs text-fg-muted">
                        {formatMoney(rule.amount)} cada{' '}
                        {rule.frequency === 'weekly' ? 'semana' : 'mes'}
                        {rule.frequency === 'weekly'
                          ? ` (≈ ${formatMoney(monthlyEquivalent(rule))} al mes)`
                          : ''}
                      </span>
                    </span>
                    <span className="flex items-center">
                      <button
                        type="button"
                        aria-label={rule.active ? `Pausar ${rule.label}` : `Reanudar ${rule.label}`}
                        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                        onClick={async () => {
                          try {
                            await setReceivableRuleActive(rule.id, !rule.active)
                            invalidateData()
                          } catch (error) {
                            toast.show(toUserMessage(error), 'error')
                          }
                        }}
                      >
                        {rule.active ? (
                          <PauseIcon aria-hidden="true" className="size-5" />
                        ) : (
                          <PlayIcon aria-hidden="true" className="size-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Borrar ${rule.label}`}
                        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                        onClick={async () => {
                          try {
                            await deleteReceivableRule(rule.id)
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
            <RuleForm />
          </section>
          <section className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 sm:px-5">
            <h2 className="font-semibold">Libreta</h2>
            {ledger.length === 0 ? (
              <p className="py-2 text-sm text-fg-muted">Aún no hay movimientos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {ledger.map(({ entry, runningBalance }) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {entry.kind === 'payment' ? 'Mamá me pagó' : 'Me debe'}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </span>
                      <span data-money className="text-xs text-fg-muted">
                        {formatDay(entry.date)} · quedaba {formatMoney(runningBalance)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span data-money className="tabular font-semibold">
                        {entry.kind === 'payment' ? '−' : '+'}
                        {formatMoney(entry.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label="Borrar este movimiento"
                        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                        onClick={async () => {
                          try {
                            await deleteReceivableEntry(entry.id)
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
