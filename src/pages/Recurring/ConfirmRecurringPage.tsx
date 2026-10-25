import { useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { nameInSentence, useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { useRecurring } from '../../hooks/useRecurring'
import { invalidateData } from '../../hooks/useResource'
import { formatDay } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { dayField, moneyField } from '../../lib/validation/movements'
import { generateRecurring } from '../../services/recurring'
import type { RecurringExpense } from '../../types/domain'
import { FormFooter } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const schema = z.object({ amount: moneyField, date: dayField })

function ConfirmForm({ item }: { item: RecurringExpense }) {
  const data = useHousehold()
  const goBack = useGoBack()
  const toast = useToast()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: formatMoneyInput(String(item.amount)), date: item.nextDueDate },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await generateRecurring(item.id, {
        amount: parseMoneyInput(values.amount)!,
        date: values.date,
      })
      invalidateData()
      toast.show(`${item.name} registrado`)
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos registrar el gasto.'), 'error')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-fg-muted">
        Correspondía al {formatDay(item.nextDueDate)}. Lo paga {nameInSentence(data, item.paidBy)} y
        se divide como en la plantilla.
      </p>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <Field label="Valor real" error={errors.amount?.message}>
            {({ id, describedBy, invalid }) => (
              <MoneyInput
                id={id}
                size="lg"
                autoFocus
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...field}
              />
            )}
          </Field>
        )}
      />
      <Field label="Fecha del pago" error={errors.date?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            type="date"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('date')}
          />
        )}
      </Field>
      <FormFooter>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
          Registrar gasto
        </Button>
      </FormFooter>
    </form>
  )
}

/** Confirmar un recurrente vencido ajustando el valor o la fecha reales. */
export function ConfirmRecurringPage() {
  const { id } = useParams()
  const recurring = useRecurring()
  const item = recurring.data?.find((entry) => entry.id === id)

  return (
    <Page>
      <PageHeader title={item ? item.name : 'Registrar recurrente'} back="/" />
      {recurring.loading ? (
        <LedgerSkeleton days={1} />
      ) : !item ? (
        <EmptyState title="No encontramos ese gasto recurrente">
          Puede que ya lo hayan registrado o borrado.
        </EmptyState>
      ) : (
        <ConfirmForm item={item} />
      )}
    </Page>
  )
}
