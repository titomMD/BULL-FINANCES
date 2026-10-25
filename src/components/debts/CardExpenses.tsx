import { useState } from 'react'
import { TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useDollar } from '../../hooks/useDollar'
import { invalidateData } from '../../hooks/useResource'
import { cardExpenseTotals } from '../../lib/calculations/cards'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { formatUsd, parseUsdInput, usdWithCop } from '../../lib/usd'
import { createCardExpense, deleteCardExpense } from '../../services/debts'
import type { DebtCardExpense, DebtCurrency } from '../../types/domain'
import { MoneyInput } from '../forms/MoneyInput'
import { Button } from '../ui/Button'
import { Field, Select, TextInput } from '../ui/Field'
import { useToast } from '../ui/toast-context'

/** Gastos hechos con la tarjeta que saldrán en el próximo extracto: para vigilarlos. */
export function CardExpenses({
  accountId,
  expenses,
  since,
}: {
  accountId: string
  expenses: DebtCardExpense[]
  /** Fecha del último corte (los gastos anteriores ya salieron en un extracto). */
  since: string | null
}) {
  const { household } = useHousehold()
  const toast = useToast()
  const { rate } = useDollar()
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>('COP')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayBogota())
  const [busy, setBusy] = useState(false)
  const totals = cardExpenseTotals(expenses)

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = currency === 'COP' ? parseMoneyInput(amount) : parseUsdInput(amount)
    if (!description.trim()) return toast.show('Cuéntanos en qué fue el gasto.', 'error')
    if (!value) return toast.show('Escribe cuánto fue.', 'error')
    setBusy(true)
    try {
      await createCardExpense(household.id, accountId, {
        expenseDate: date,
        description,
        currency,
        amount: value,
        fxRateCents: currency === 'USD' ? (rate?.cents ?? null) : null,
      })
      invalidateData()
      setDescription('')
      setAmount('')
      toast.show('Gasto guardado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <div>
        <h3 className="font-semibold">Gastos del mes con esta tarjeta</h3>
        <p className="text-sm text-fg-muted">
          {since ? `Desde el corte del ${formatDay(since)}: ` : ''}lo que saldrá en tu próximo
          extracto.
        </p>
      </div>
      <p data-money className="text-sm">
        En pesos <span className="tabular font-semibold">{formatMoney(totals.cop)}</span>
        {' · '}en dólares{' '}
        <span className="tabular font-semibold">{usdWithCop(totals.usd, rate?.cents ?? null)}</span>
      </p>
      <form onSubmit={add} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field label="¿En qué fue?">
          {({ id }) => (
            <TextInput
              id={id}
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <Field label="Fecha">
          {({ id }) => (
            <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>
        <Field label="Moneda">
          {({ id }) => (
            <Select
              id={id}
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as DebtCurrency)
                setAmount('')
              }}
            >
              <option value="COP">Pesos (COP)</option>
              <option value="USD">Dólares (USD)</option>
            </Select>
          )}
        </Field>
        <Field label="Valor">
          {({ id }) =>
            currency === 'COP' ? (
              <MoneyInput id={id} value={amount} onChange={setAmount} />
            ) : (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="15,99"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )
          }
        </Field>
        <Button type="submit" loading={busy} className="sm:col-span-2 sm:justify-self-start">
          Agregar gasto
        </Button>
      </form>
      {expenses.length > 0 && (
        <ul className="divide-y divide-line">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex flex-col">
                <span className="font-medium">{expense.description}</span>
                <span className="text-xs text-fg-muted">
                  {formatDay(expense.expenseDate)} ·{' '}
                  {expense.currency === 'USD' ? 'en dólares' : 'en pesos'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular font-semibold">
                  {expense.currency === 'USD'
                    ? formatUsd(expense.amount)
                    : formatMoney(expense.amount)}
                </span>
                <button
                  type="button"
                  aria-label={`Borrar ${expense.description}`}
                  className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                  onClick={async () => {
                    try {
                      await deleteCardExpense(expense.id)
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
  )
}
