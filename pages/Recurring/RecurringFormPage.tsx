import { useState } from 'react'
import { useParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TrashIcon } from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { useRecurring } from '../../hooks/useRecurring'
import { invalidateData } from '../../hooks/useResource'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { recurringSchema, type RecurringFormValues } from '../../lib/validation/movements'
import { createRecurring, deleteRecurring, updateRecurring } from '../../services/recurring'
import type { RecurringExpense } from '../../types/domain'
import { CardCheckbox } from '../../components/forms/CardCheckbox'
import { CategoryPicker } from '../../components/forms/CategoryPicker'
import { FormFooter } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { SplitEditor } from '../../components/forms/SplitEditor'
import { defaultSplit, splitFromForm, splitToForm } from '../../components/forms/split'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

function RecurringForm({ item }: { item?: RecurringExpense }) {
  const data = useHousehold()
  const goBack = useGoBack('/recurrentes')
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const categories = data.categories.filter(
    (category) =>
      category.kind === 'expense' && (!category.archivedAt || category.id === item?.categoryId),
  )
  const payers = data.members.filter((member) => member.active || member.userId === item?.paidBy)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: item
      ? {
          name: item.name,
          amount: formatMoneyInput(String(item.amount)),
          frequency: item.frequency,
          nextDueDate: item.nextDueDate,
          categoryId: item.categoryId,
          paidBy: item.paidBy,
          notes: item.notes ?? '',
          paidWithCard: item.paidWithCard,
          active: item.active,
          ...splitToForm(item.splitType, item.splits, data.members),
        }
      : {
          name: '',
          amount: '',
          frequency: 'monthly',
          nextDueDate: todayBogota(),
          categoryId: '',
          paidBy: data.userId,
          notes: '',
          paidWithCard: false,
          active: true,
          ...defaultSplit(data.members),
        },
  })

  const [amount, splitType, participants, percents] = useWatch({
    control,
    name: ['amount', 'splitType', 'participants', 'percents'],
  })

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      name: values.name.trim(),
      amount: parseMoneyInput(values.amount)!,
      frequency: values.frequency,
      nextDueDate: values.nextDueDate,
      categoryId: values.categoryId,
      paidBy: values.paidBy,
      split: splitFromForm(values),
      notes: values.notes.trim(),
      paidWithCard: values.paidWithCard,
      active: values.active,
    }
    try {
      if (item) await updateRecurring(item.id, input)
      else await createRecurring(data.household.id, input)
      invalidateData()
      toast.show(item ? 'Recurrente actualizado' : 'Recurrente creado')
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar el gasto recurrente.'), 'error')
    }
  })

  const percentErrors = errors.percents as
    (Record<string, { message?: string }> & { message?: string }) | undefined

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        <Field label="Nombre" error={errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              placeholder="Arriendo, internet, Netflix…"
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={120}
              {...register('name')}
            />
          )}
        </Field>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field
              label="Monto estimado"
              hint="Al confirmarlo cada mes puedes ajustar el valor real."
              error={errors.amount?.message}
            >
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...field}
                />
              )}
            </Field>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <Segmented
                label="Frecuencia"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'monthly', label: 'Mensual' },
                  { value: 'quarterly', label: 'Trimestral' },
                ]}
              />
            )}
          />
          <Field label="Próxima fecha" error={errors.nextDueDate?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="date"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('nextDueDate')}
              />
            )}
          </Field>
        </div>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryPicker
              label="Categoría"
              categories={categories}
              value={field.value}
              onChange={field.onChange}
              error={errors.categoryId?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="paidBy"
          render={({ field }) => (
            <Segmented
              label="¿Quién lo paga normalmente?"
              value={field.value}
              onChange={field.onChange}
              options={payers.map((member) => ({
                value: member.userId,
                label: member.userId === data.userId ? 'Yo' : member.displayName,
              }))}
            />
          )}
        />
        <SplitEditor
          value={{ splitType, participants, percents }}
          onChange={(next) => {
            const options = { shouldValidate: isSubmitted, shouldDirty: true }
            setValue('splitType', next.splitType, options)
            setValue('participants', next.participants, options)
            setValue('percents', next.percents, options)
          }}
          amount={parseMoneyInput(amount)}
          members={data.members}
          meId={data.userId}
          error={errors.participants?.message ?? percentErrors?.message}
        />
        <CardCheckbox registration={register('paidWithCard')} />
        <Field label="Nota (opcional)" error={errors.notes?.message}>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={500}
              {...register('notes')}
            />
          )}
        </Field>
        {item && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 font-medium">
            <input
              type="checkbox"
              className="size-5 accent-(--color-primary)"
              {...register('active')}
            />
            Activo (desmárcalo para pausarlo sin borrarlo)
          </label>
        )}
      </fieldset>

      <FormFooter>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Guardando' : item ? 'Guardar cambios' : 'Crear recurrente'}
        </Button>
      </FormFooter>

      {item && (
        <section className="mt-6 flex flex-col gap-3 border-t border-line pt-6">
          <p className="text-sm text-fg-muted">
            Borrar la plantilla no borra los gastos que ya se registraron con ella.
          </p>
          <Button
            variant="danger"
            className="self-start"
            onClick={() => setConfirmDelete(true)}
            icon={<TrashIcon aria-hidden="true" className="size-4" />}
          >
            Borrar recurrente
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            title={`¿Borrar "${item.name}"?`}
            confirmLabel="Sí, borrar"
            loading={deleting}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={async () => {
              setDeleting(true)
              try {
                await deleteRecurring(item.id)
                invalidateData()
                toast.show('Recurrente borrado')
                goBack()
              } catch (error) {
                toast.show(toUserMessage(error), 'error')
                setDeleting(false)
                setConfirmDelete(false)
              }
            }}
          >
            Dejará de aparecer como pendiente. Los gastos ya registrados se conservan.
          </ConfirmDialog>
        </section>
      )}
    </form>
  )
}

export function RecurringFormPage() {
  const { id } = useParams()
  const recurring = useRecurring()
  const item = id ? recurring.data?.find((entry) => entry.id === id) : undefined

  return (
    <Page>
      <PageHeader title={id ? 'Gasto recurrente' : 'Nuevo gasto recurrente'} back="/recurrentes" />
      {id && recurring.loading ? (
        <LedgerSkeleton days={1} />
      ) : id && !item ? (
        <EmptyState title="No encontramos ese gasto recurrente">
          Puede que lo hayan borrado.
        </EmptyState>
      ) : (
        <RecurringForm key={item?.id ?? 'new'} item={item} />
      )}
    </Page>
  )
}
