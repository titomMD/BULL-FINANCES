import { useParams, useSearchParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDownIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { invalidateData } from '../../hooks/useResource'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { transferSchema, type TransferFormValues } from '../../lib/validation/movements'
import { createTransfer, updateTransfer, voidTransfer } from '../../services/movements'
import type { Transfer } from '../../types/domain'
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

function TransferForm({ transfer }: { transfer?: Transfer }) {
  const data = useHousehold()
  const goBack = useGoBack()
  const toast = useToast()
  const savedToast = useSavedToast()
  const [params] = useSearchParams()
  const readOnly = transfer?.status === 'voided'

  const people = data.members.filter(
    (member) =>
      member.active || member.userId === transfer?.fromUser || member.userId === transfer?.toUser,
  )
  const other = people.find((member) => member.userId !== data.userId)?.userId ?? ''
  const isMember = (id: string | null) =>
    Boolean(id && people.some((member) => member.userId === id))

  // Prellenado desde "Registrar abono" en Inicio: ?de=&para=&monto=
  const prefillFrom = params.get('de')
  const prefillTo = params.get('para')
  const prefillAmount = Number(params.get('monto'))

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: transfer
      ? {
          fromUser: transfer.fromUser,
          toUser: transfer.toUser,
          amount: formatMoneyInput(String(transfer.amount)),
          date: transfer.date,
          notes: transfer.notes ?? '',
        }
      : {
          fromUser: isMember(prefillFrom) ? prefillFrom! : data.userId,
          toUser: isMember(prefillTo) ? prefillTo! : other,
          amount:
            Number.isSafeInteger(prefillAmount) && prefillAmount > 0
              ? formatMoneyInput(String(prefillAmount))
              : '',
          date: todayBogota(),
          notes: prefillFrom ? 'Abono' : '',
        },
  })

  const options = people.map((member) => ({
    value: member.userId,
    label: member.userId === data.userId ? 'Yo' : member.displayName,
  }))

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      fromUser: values.fromUser,
      toUser: values.toUser,
      amount: parseMoneyInput(values.amount)!,
      date: values.date,
      notes: values.notes,
    }
    try {
      if (transfer) {
        await updateTransfer(transfer.id, input)
        invalidateData()
        toast.show('Transferencia actualizada')
      } else {
        const id = await createTransfer(data.household.id, input)
        invalidateData()
        savedToast({
          message: 'Transferencia guardada',
          undo: () => voidTransfer(id),
          undoneMessage: 'Transferencia anulada',
          againPath: '/transferencias/nueva',
        })
      }
      goBack()
    } catch (error) {
      toast.show(
        toUserMessage(error, 'No pudimos guardar la transferencia. Inténtalo de nuevo.'),
        'error',
      )
    }
  })

  if (people.length < 2)
    return (
      <EmptyState title="Falta tu hermano">
        Las transferencias son entre dos personas del hogar. Invítalo desde Ajustes.
      </EmptyState>
    )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {readOnly && <VoidedNotice label="transferencia" />}
      {!transfer && (
        <p className="text-sm text-fg-muted">
          Saldo que uno le pasa al otro: se resta de quien envía y se suma a quien recibe. No cuenta
          como gasto.
        </p>
      )}
      <fieldset disabled={readOnly || isSubmitting} className="flex flex-col gap-6">
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label="¿Cuánto?" error={errors.amount?.message}>
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  size="lg"
                  autoFocus={!transfer && !prefillAmount}
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
        <div className="flex flex-col gap-2">
          <Controller
            control={control}
            name="fromUser"
            render={({ field }) => (
              <Segmented
                label="Envía"
                value={field.value}
                onChange={field.onChange}
                options={options}
              />
            )}
          />
          <ArrowDownIcon
            aria-hidden="true"
            className="mx-auto size-5 text-fg-muted"
            weight="bold"
          />
          <Controller
            control={control}
            name="toUser"
            render={({ field }) => (
              <Segmented
                label="Recibe"
                value={field.value}
                onChange={field.onChange}
                options={options}
              />
            )}
          />
          {errors.toUser && (
            <p role="alert" className="text-sm text-negative">
              {errors.toUser.message}
            </p>
          )}
        </div>
        <NoteField
          registration={register('notes')}
          hasValue={Boolean(transfer?.notes || prefillFrom)}
          error={errors.notes?.message}
        />
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Guardando' : transfer ? 'Guardar cambios' : 'Guardar transferencia'}
          </Button>
        </FormFooter>
      )}

      {transfer && <AuditNote audit={transfer} />}
      {transfer && !readOnly && (
        <VoidSection
          label="transferencia"
          onVoid={async () => {
            try {
              await voidTransfer(transfer.id)
              invalidateData()
              toast.show('Transferencia anulada')
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

export function TransferFormPage() {
  const { id } = useParams()
  const { movements } = useHousehold()
  const transfer = id
    ? movements.find(
        (movement): movement is Transfer => movement.kind === 'transfer' && movement.id === id,
      )
    : undefined

  return (
    <Page>
      <PageHeader title={id ? 'Transferencia' : 'Nueva transferencia'} back="/" />
      {id && !transfer ? (
        <EmptyState title="No encontramos esa transferencia">
          Puede que el enlace esté mal.
        </EmptyState>
      ) : (
        <TransferForm key={transfer?.id ?? 'new'} transfer={transfer} />
      )}
    </Page>
  )
}
