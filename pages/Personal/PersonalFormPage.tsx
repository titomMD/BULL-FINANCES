import { useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { usePersonalMoney } from '../../hooks/usePersonalMoney'
import { invalidateData } from '../../hooks/useResource'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { personalSchema, type PersonalFormValues } from '../../lib/validation/movements'
import {
  createPersonalMovement,
  updatePersonalMovement,
  voidPersonalMovement,
} from '../../services/personal'
import type { PersonalMovement } from '../../types/domain'
import { CategoryPicker } from '../../components/forms/CategoryPicker'
import { DateChips } from '../../components/forms/DateChips'
import { AuditNote, FormFooter, VoidSection, VoidedNotice } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { NoteField } from '../../components/forms/NoteField'
import { useSavedToast } from '../../components/forms/useSavedToast'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
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
  const readOnly = movement?.status === 'voided'
  const text = copy[kind]

  const categories = data.categories.filter(
    (category) =>
      category.kind === kind && (!category.archivedAt || category.id === movement?.categoryId),
  )

  const {
    register,
    control,
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
      : { description: '', amount: '', date: todayBogota(), categoryId: '', notes: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
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

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {readOnly && <VoidedNotice label={text.noun} />}
      {!movement && <p className="text-sm text-fg-muted">{text.intro}</p>}
      <fieldset disabled={readOnly || isSubmitting} className="flex flex-col gap-6">
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
      {movement && !readOnly && (
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
