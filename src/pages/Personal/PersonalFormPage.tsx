import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHousehold } from '../../app/household-context'
import { useDebtAccounts } from '../../hooks/useDebts'
import { useDollar } from '../../hooks/useDollar'
import { useGoBack } from '../../hooks/useGoBack'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { invalidateData } from '../../hooks/useResource'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { parsePrefill } from '../../lib/prefill'
import { parseUsdInput } from '../../lib/usd'
import { personalSchema, type PersonalFormValues } from '../../lib/validation/movements'
import { createCardExpense } from '../../services/debts'
import {
  createPersonalMovement,
  updatePersonalMovement,
  voidPersonalMovement,
} from '../../services/personal'
import type { DebtCurrency, PersonalMovement } from '../../types/domain'
import { CategoryPicker } from '../../components/forms/CategoryPicker'
import { DateChips } from '../../components/forms/DateChips'
import { AuditNote, FormFooter, VoidSection, VoidedNotice } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { NoteField } from '../../components/forms/NoteField'
import { useSavedToast } from '../../components/forms/useSavedToast'
import { Button } from '../../components/ui/Button'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

type Kind = PersonalMovement['kind']

const copy = {
  income: {
    noun: 'ingreso personal',
    saved: 'Ingreso personal guardado',
    voided: 'Ingreso personal anulado',
    amount: '¿Cuánto te entró?',
    description: '¿De dónde viene?',
    placeholder: 'Trabajo aparte, venta, regalo…',
    intro: 'Dinero que es solo tuyo. Suma a tu dinero personal, no al saldo del hogar.',
    newPath: '/personal/ingresos/nuevo',
  },
  expense: {
    noun: 'gasto personal',
    saved: 'Gasto personal guardado',
    voided: 'Gasto personal anulado',
    amount: '¿Cuánto fue?',
    description: '¿En qué?',
    placeholder: 'Ropa, salida, regalo…',
    intro: 'Lo pagas con tu dinero personal: no resta del saldo del hogar ni lo ve nadie más.',
    newPath: '/personal/gastos/nuevo',
  },
} as const

function PersonalForm({ kind, movement }: { kind: Kind; movement?: PersonalMovement }) {
  const data = useHousehold()
  const goBack = useGoBack('/personal')
  const toast = useToast()
  const savedToast = useSavedToast()
  const planRow = Boolean(movement?.planMonth)
  const readOnly = movement?.status === 'voided' || planRow
  const text = copy[kind]
  const accounts = useDebtAccounts()
  const { rate } = useDollar()
  const cards = (accounts.data ?? []).filter((card) => !card.archivedAt)
  // Un gasto con tarjeta no baja tu dinero personal: queda en esa tarjeta hasta que la pagues.
  const canUseCard = kind === 'expense' && !movement && cards.length > 0
  // Un atajo del iPhone puede abrir esta pantalla con el gasto ya escrito:
  // ?monto=45000&desc=Rappi&tarjeta=Visa&moneda=USD&fecha=2026-10-25
  const [params] = useSearchParams()
  const prefill = movement ? null : parsePrefill(params)
  const [payChoice, setPayChoice] = useState<string | null>(null)
  const matchedCard =
    prefill?.card && !prefill.debit
      ? cards.find(
          (card) =>
            card.last4 === prefill.card ||
            card.name.toLowerCase().includes(prefill.card.toLowerCase()) ||
            prefill.card.toLowerCase().includes(card.name.toLowerCase()),
        )
      : undefined
  const payWith = payChoice ?? matchedCard?.id ?? ''
  const setPayWith = setPayChoice
  const [currencyChoice, setCurrencyChoice] = useState<DebtCurrency | null>(null)
  const cardCurrency: DebtCurrency = currencyChoice ?? prefill?.currency ?? 'COP'
  const setCardCurrency = setCurrencyChoice
  const [usdChoice, setUsdChoice] = useState<string | null>(null)
  const usd = usdChoice ?? (prefill?.currency === 'USD' ? prefill.amountText : '')
  const setUsd = setUsdChoice
  const useUsd = canUseCard && payWith !== '' && cardCurrency === 'USD'

  const categories = data.categories.filter(
    (category) =>
      category.kind === kind && (!category.archivedAt || category.id === movement?.categoryId),
  )

  const {
    register,
    control,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonalFormValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: movement
      ? {
          description: movement.description,
          amount: formatMoneyInput(String(movement.amount)),
          date: movement.date,
          categoryId: movement.categoryId ?? '',
          notes: movement.notes ?? '',
        }
      : {
          description: prefill?.description ?? '',
          amount:
            prefill?.currency === 'COP' && prefill.pesos
              ? formatMoneyInput(String(prefill.pesos))
              : '',
          date: prefill?.date ?? todayBogota(),
          categoryId: '',
          notes: '',
        },
  })

  const saveCardExpense = async (values: PersonalFormValues, usdText: string | null) => {
    const amount = usdText === null ? parseMoneyInput(values.amount) : parseUsdInput(usdText)
    if (!amount) return toast.show('Escribe cuánto fue.', 'error')
    try {
      await createCardExpense(data.household.id, payWith, {
        expenseDate: values.date,
        description: values.description,
        currency: usdText === null ? 'COP' : 'USD',
        amount,
        fxRateCents: usdText === null ? null : (rate?.cents ?? null),
      })
      invalidateData()
      toast.show('Gasto guardado en la tarjeta')
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo. Inténtalo de nuevo.'), 'error')
    }
  }

  const submitCop = handleSubmit(async (values) => {
    if (canUseCard && payWith) return saveCardExpense(values, null)
    const input = {
      description: values.description,
      amount: parseMoneyInput(values.amount)!,
      date: values.date,
      categoryId: values.categoryId || null,
      notes: values.notes,
    }
    try {
      if (movement) {
        await updatePersonalMovement(movement.id, input)
        invalidateData()
        toast.show('Cambios guardados')
      } else {
        const id = await createPersonalMovement(data.household.id, kind, input)
        invalidateData()
        savedToast({
          message: text.saved,
          undo: () => voidPersonalMovement(id),
          undoneMessage: text.voided,
          againPath: text.newPath,
        })
      }
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo. Inténtalo de nuevo.'), 'error')
    }
  })

  // En dólares el valor no es de pesos: se valida aparte, sin pasar por el campo de pesos.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!useUsd) return submitCop(event)
    event.preventDefault()
    const values = getValues()
    if (!values.description.trim()) return toast.show('Cuéntanos en qué fue el gasto.', 'error')
    return saveCardExpense(values, usd)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {planRow && (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
          Este ingreso lo genera tu plan del mes («Dinero mío») y se actualiza solo. Para cambiarlo,
          ajusta tu plan.
        </p>
      )}
      {readOnly && !planRow && <VoidedNotice label={text.noun} />}
      {!movement && <p className="text-sm text-fg-muted">{text.intro}</p>}
      <fieldset disabled={readOnly || isSubmitting} className="flex flex-col gap-6">
        {useUsd ? (
          <Field label="¿Cuántos dólares fueron?">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="15,99"
                autoFocus
                value={usd}
                onChange={(e) => setUsd(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )}
          </Field>
        ) : (
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Field label={text.amount} error={errors.amount?.message}>
                {({ id, describedBy, invalid }) => (
                  <MoneyInput
                    id={id}
                    size="lg"
                    autoFocus={!movement}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    {...field}
                  />
                )}
              </Field>
            )}
          />
        )}
        {canUseCard && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="¿Con qué pagaste?"
              hint="Con tarjeta, no baja tu dinero hasta que la pagues."
            >
              {({ id }) => (
                <Select id={id} value={payWith} onChange={(e) => setPayWith(e.target.value)}>
                  <option value="">Mi dinero personal</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                      {card.last4 ? ` ••••${card.last4}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {payWith && (
              <Field label="¿En qué moneda?">
                {({ id }) => (
                  <Select
                    id={id}
                    value={cardCurrency}
                    onChange={(e) => setCardCurrency(e.target.value as DebtCurrency)}
                  >
                    <option value="COP">Pesos (COP)</option>
                    <option value="USD">Dólares (USD)</option>
                  </Select>
                )}
              </Field>
            )}
          </div>
        )}
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateChips value={field.value} onChange={field.onChange} error={errors.date?.message} />
          )}
        />
        <Field label={text.description} error={errors.description?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              placeholder={text.placeholder}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={120}
              {...register('description')}
            />
          )}
        </Field>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryPicker
              label="Categoría (opcional)"
              categories={categories}
              value={field.value}
              onChange={field.onChange}
              optional
            />
          )}
        />
        <NoteField
          registration={register('notes')}
          hasValue={Boolean(movement?.notes)}
          error={errors.notes?.message}
        />
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting
              ? 'Guardando'
              : movement
                ? 'Guardar cambios'
                : kind === 'income'
                  ? 'Guardar ingreso'
                  : 'Guardar gasto'}
          </Button>
        </FormFooter>
      )}

      {movement && <AuditNote audit={movement} />}
      {movement && !readOnly && !planRow && (
        <VoidSection
          label={text.noun}
          onVoid={async () => {
            try {
              await voidPersonalMovement(movement.id)
              invalidateData()
              toast.show(text.voided)
              goBack()
            } catch (error) {
              toast.show(toUserMessage(error), 'error')
            }
          }}
        />
      )}
    </form>
  )
}

/** Nuevo ingreso/gasto personal (`kind` por ruta) o detalle de uno (`:id`). */
export function PersonalFormPage({ kind: newKind }: { kind?: Kind }) {
  const { id } = useParams()
  const personal = usePersonalMoney()
  const movement = id ? personal.data?.find((item) => item.id === id) : undefined
  const kind = movement?.kind ?? newKind ?? 'expense'
  const title = id
    ? kind === 'income'
      ? 'Ingreso personal'
      : 'Gasto personal'
    : kind === 'income'
      ? 'Nuevo ingreso personal'
      : 'Nuevo gasto personal'

  return (
    <Page>
      <PageHeader title={title} back="/personal" />
      {!id ? (
        <PersonalForm kind={kind} />
      ) : personal.loading ? (
        <LedgerSkeleton days={1} />
      ) : personal.error && !personal.data ? (
        <ErrorState message={toUserMessage(personal.error)} />
      ) : !movement ? (
        <EmptyState title="No encontramos ese movimiento">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <PersonalForm key={movement.id} kind={movement.kind} movement={movement} />
      )}
    </Page>
  )
}
