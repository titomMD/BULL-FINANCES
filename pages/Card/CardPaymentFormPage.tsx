import { useParams, useSearchParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { invalidateData } from '../../hooks/useResource'
import { cardPendingByPerson } from '../../lib/calculations/available'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { cardPaymentSchema, type CardPaymentFormValues } from '../../lib/validation/movements'
import { createCardPayment, updateCardPayment, voidCardPayment } from '../../services/movements'
import type { CardPayment } from '../../types/domain'
import { AuditNote, FormFooter, VoidSection, VoidedNotice } from '../../components/forms/FormParts'
import { DateChips } from '../../components/forms/DateChips'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { NoteField } from '../../components/forms/NoteField'
import { useSavedToast } from '../../components/forms/useSavedToast'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyState } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

function CardPaymentForm({ payment }: { payment?: CardPayment }) {
  const data = useHousehold()
  const goBack = useGoBack()
  const toast = useToast()
  const savedToast = useSavedToast()
  const [params] = useSearchParams()
  const readOnly = payment?.status === 'voided'

  const people = data.members.filter((member) => member.active || member.userId === payment?.userId)
  const pending = cardPendingByPerson(data.movements)
  const pendingOf = (userId: string) => pending.get(userId) ?? 0

  // Prellenado desde Inicio: ?persona=&monto=
  const prefillPerson = params.get('persona')
  const startPerson =
    prefillPerson && people.some((member) => member.userId === prefillPerson)
      ? prefillPerson
      : data.userId
  const prefillAmount = Number(params.get('monto')) || pendingOf(startPerson)

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<CardPaymentFormValues>({
    resolver: zodResolver(cardPaymentSchema),
    defaultValues: payment
      ? {
          userId: payment.userId,
          amount: formatMoneyInput(String(payment.amount)),
          date: payment.date,
          notes: payment.notes ?? '',
        }
      : {
          userId: startPerson,
          amount:
            Number.isSafeInteger(prefillAmount) && prefillAmount > 0
              ? formatMoneyInput(String(prefillAmount))
              : '',
          date: todayBogota(),
          notes: '',
        },
  })

  const userId = useWatch({ control, name: 'userId' })
  // Al editar, el pago ya está descontado: lo pendiente "antes" de él es lo de ahora + el pago.
  const owed =
    pendingOf(userId) +
    (payment && payment.status === 'active' && payment.userId === userId ? payment.amount : 0)
  const isMe = userId === data.userId

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      userId: values.userId,
      amount: parseMoneyInput(values.amount)!,
      date: values.date,
      notes: values.notes,
    }
    try {
      if (payment) {
        await updateCardPayment(payment.id, input)
        invalidateData()
        toast.show('Pago de tarjeta actualizado')
      } else {
        const id = await createCardPayment(data.household.id, input)
        invalidateData()
        savedToast({
          message: 'Pago de tarjeta guardado',
          undo: () => voidCardPayment(id),
          undoneMessage: 'Pago de tarjeta anulado',
          againPath: '/tarjeta/pagos/nuevo',
        })
      }
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar el pago. Inténtalo de nuevo.'), 'error')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {readOnly && <VoidedNotice label="pago de tarjeta" />}
      {!payment && (
        <p className="text-sm text-fg-muted">
          Lo que alguien paga de su parte de la tarjeta. Se resta de su saldo disponible y de lo que
          tiene por pagar.
        </p>
      )}
      <fieldset disabled={readOnly || isSubmitting} className="flex flex-col gap-6">
        {people.length > 1 && (
          <Controller
            control={control}
            name="userId"
            render={({ field }) => (
              <Segmented
                label="¿Quién paga su parte?"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  // Si no tocó el monto, se ajusta a lo que debe la persona elegida.
                  if (!payment && !dirtyFields.amount && pendingOf(value) > 0)
                    setValue('amount', formatMoneyInput(String(pendingOf(value))))
                }}
                options={people.map((member) => ({
                  value: member.userId,
                  label: member.userId === data.userId ? 'Yo' : member.displayName,
                }))}
              />
            )}
          />
        )}
        <p data-money className="-mt-3 text-sm text-fg-muted">
          {owed > 0 ? (
            <>
              {isMe ? 'Tienes' : 'Tiene'} por pagar{' '}
              <span className="tabular font-semibold text-fg">{formatMoney(owed)}</span>
            </>
          ) : (
            `${isMe ? 'No tienes' : 'No tiene'} nada por pagar de la tarjeta.`
          )}
        </p>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label="¿Cuánto paga?" error={errors.amount?.message}>
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  size="lg"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...field}
                />
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateChips value={field.value} onChange={field.onChange} error={errors.date?.message} />
          )}
        />
        <NoteField
          registration={register('notes')}
          hasValue={Boolean(payment?.notes)}
          error={errors.notes?.message}
        />
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Guardando' : payment ? 'Guardar cambios' : 'Guardar pago'}
          </Button>
        </FormFooter>
      )}

      {payment && <AuditNote audit={payment} />}
      {payment && !readOnly && (
        <VoidSection
          label="pago de tarjeta"
          onVoid={async () => {
            try {
              await voidCardPayment(payment.id)
              invalidateData()
              toast.show('Pago de tarjeta anulado')
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

export function CardPaymentFormPage() {
  const { id } = useParams()
  const { movements } = useHousehold()
  const payment = id
    ? movements.find(
        (movement): movement is CardPayment =>
          movement.kind === 'card_payment' && movement.id === id,
      )
    : undefined

  return (
    <Page>
      <PageHeader title={id ? 'Pago de tarjeta' : 'Pagar tarjeta'} back="/" />
      {id && !payment ? (
        <EmptyState title="No encontramos ese pago">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <CardPaymentForm key={payment?.id ?? 'new'} payment={payment} />
      )}
    </Page>
  )
}
