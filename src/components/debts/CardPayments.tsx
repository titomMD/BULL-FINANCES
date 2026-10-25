import { useState } from 'react'
import { useHousehold } from '../../app/household-context'
import { useDollar } from '../../hooks/useDollar'
import { invalidateData } from '../../hooks/useResource'
import {
  accruedInterest,
  daysBetween,
  minimumBreakdown,
  statementDues,
} from '../../lib/calculations/cards'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { formatUsd, parseUsdInput } from '../../lib/usd'
import { createPayment } from '../../services/debts'
import type { DebtCurrency, DebtPayment, DebtStatement } from '../../types/domain'
import { MoneyInput } from '../forms/MoneyInput'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import { useToast } from '../ui/toast-context'

interface BlockProps {
  currency: DebtCurrency
  statement: DebtStatement
  accountId: string
  /** Próximo corte: hasta ahí se estima el interés que ahorra un abono. */
  until: string
}

const fmt = (currency: DebtCurrency, value: number) =>
  currency === 'COP' ? formatMoney(value) : formatUsd(value)

/** Una de las dos cuentas del extracto (pesos o dólares): se paga por separado. */
function CurrencyBlock({ currency, statement, accountId, until }: BlockProps) {
  const { household } = useHousehold()
  const toast = useToast()
  const { rate } = useDollar()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const dues = statementDues(statement)[currency === 'COP' ? 'cop' : 'usd']
  const fee = currency === 'COP' ? (statement.feeAmount ?? 0) : 0
  const label = currency === 'COP' ? 'Pesos colombianos' : 'Dólares'
  const today = todayBogota()

  const parsed = currency === 'COP' ? parseMoneyInput(amount) : parseUsdInput(amount)
  const saved =
    currency === 'COP' && parsed && statement.monthlyRatePpm
      ? accruedInterest(
          Math.min(parsed, dues.pending),
          statement.monthlyRatePpm,
          daysBetween(today, until),
        )
      : 0

  const pay = async (value: number, kind: DebtPayment['kind']) => {
    setBusy(true)
    try {
      await createPayment(household.id, accountId, {
        statementId: statement.id,
        currency,
        amount: value,
        kind,
        paidOn: today,
        fxRateCents: currency === 'USD' ? (rate?.cents ?? null) : null,
        note: '',
      })
      invalidateData()
      setAmount('')
      toast.show('Pago guardado')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar el pago.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const breakdown = minimumBreakdown(dues.minimum, fee)
  if (dues.total === 0 && currency === 'USD') {
    return (
      <div className="rounded-xl bg-surface-2/50 p-3">
        <h4 className="font-semibold">{label}</h4>
        <p className="text-sm text-fg-muted">
          Este extracto no trae saldo en dólares. Si lo trae, ponlo en «Editar extracto».
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-2/50 p-3">
      <h4 className="font-semibold">{label}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-fg-muted">Total</dt>
        <dd className="text-right tabular font-semibold">{fmt(currency, dues.total)}</dd>
        <dt className="text-fg-muted">Pago mínimo</dt>
        <dd className="text-right tabular font-semibold">{fmt(currency, dues.minimum)}</dd>
        <dt className="text-fg-muted">Pagado</dt>
        <dd className="text-right tabular font-semibold">{fmt(currency, dues.paid)}</dd>
        <dt className="text-fg-muted">Falta</dt>
        <dd className="text-right tabular font-semibold">{fmt(currency, dues.pending)}</dd>
      </dl>
      <p className="text-sm" aria-live="polite">
        {dues.minimumMet
          ? '✓ Mínimo pagado'
          : `Falta para el mínimo ${fmt(currency, dues.minimumPending)}`}
        {dues.pending === 0 && dues.total > 0 ? ' · todo pagado' : ''}
      </p>
      {fee > 0 && !dues.minimumMet && (
        <p className="text-xs text-fg-muted">
          El mínimo incluye la cuota de manejo de {formatMoney(breakdown.fee)}, que ya descontaste
          de tu plan: a la deuda de la tarjeta le llegan {formatMoney(breakdown.debt)}.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!dues.minimumMet && (
          <Button loading={busy} onClick={() => pay(dues.minimumPending, 'minimum')}>
            Pago mínimo pagado
          </Button>
        )}
        {dues.pending > 0 && (
          <Button variant="secondary" loading={busy} onClick={() => pay(dues.pending, 'full')}>
            Pagar todo
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-36 flex-1">
          {currency === 'COP' ? (
            <MoneyInput
              aria-label="Abono en pesos"
              placeholder="Abono"
              value={amount}
              onChange={setAmount}
            />
          ) : (
            <TextInput
              aria-label="Abono en dólares"
              inputMode="decimal"
              placeholder="Abono en US$"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          )}
        </div>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => {
            if (!parsed) return toast.show('Escribe cuánto vas a abonar.', 'error')
            void pay(parsed, 'extra')
          }}
        >
          Abonar
        </Button>
      </div>
      {saved > 0 && (
        <p data-money className="text-sm">
          Abonando hoy te ahorras ≈{' '}
          <span className="tabular font-semibold">{formatMoney(saved)}</span> de intereses hasta el
          corte del {formatDay(until)}.
        </p>
      )}
    </div>
  )
}

/** Las dos cuentas de un extracto, bien separadas: pesos y dólares. */
export function CardPayments(props: Omit<BlockProps, 'currency'>) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CurrencyBlock {...props} currency="COP" />
      <CurrencyBlock {...props} currency="USD" />
    </div>
  )
}
