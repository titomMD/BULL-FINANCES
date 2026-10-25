import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { memberName, useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { invalidateData } from '../../hooks/useResource'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { incomeSchema, type IncomeFormValues } from '../../lib/validation/movements'
import { createIncome, updateIncome, voidIncome } from '../../services/movements'
import type { Income } from '../../types/domain'
import { CategoryPicker } from '../../components/forms/CategoryPicker'
import { DateChips } from '../../components/forms/DateChips'
import { AuditNote, FormFooter, VoidSection, VoidedNotice } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { NoteField } from '../../components/forms/NoteField'
import { SplitEditor } from '../../components/forms/SplitEditor'
import { defaultSplit, splitFromForm, splitToForm } from '../../components/forms/split'
import { useSavedToast } from '../../components/forms/useSavedToast'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyState } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

function IncomeForm({ income }: { income?: Income }) {
  const data = useHousehold()
  const goBack = useGoBack()
  const toast = useToast()
  const savedToast = useSavedToast()
  const readOnly = income?.status === 'voided'

  const categories = data.categories.filter(
    (category) =>
      category.kind === 'income' && (!category.archivedAt || category.id === income?.categoryId),
  )
  const receivers = data.members.filter(
    (member) => member.active || member.userId === income?.userId,
  )

  const defaultValues = useMemo<IncomeFormValues>(() => {
    if (income) {
      // Compartido: más de una persona, o es de alguien distinto a quien lo recibió.
      const shared = income.splits.length !== 1 || income.splits[0].userId !== income.userId
      return {
        source: income.source,
        amount: formatMoneyInput(String(income.amount)),
        date: income.date,
        categoryId: income.categoryId ?? '',
        userId: income.userId,
        shared,
        notes: income.notes ?? '',
        ...(shared
          ? splitToForm(income.splitType, income.splits, data.members)
          : defaultSplit(data.members)),
      }
    }
    return {
      source: '',
      amount: '',
      date: todayBogota(),
      categoryId: '',
      userId: data.userId,
      shared: false,
      notes: '',
      ...defaultSplit(data.members),
    }
  }, [income, data.members, data.userId])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<IncomeFormValues>({ resolver: zodResolver(incomeSchema), defaultValues })

  const [amount, userId, shared, splitType, participants, percents] = useWatch({
    control,
    name: ['amount', 'userId', 'shared', 'splitType', 'participants', 'percents'],
  })

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      userId: values.userId,
      source: values.source,
      amount: parseMoneyInput(values.amount)!,
      date: values.date,
      categoryId: values.categoryId || null,
      split: values.shared
        ? splitFromForm(values)
        : { type: 'equal' as const, participants: [values.userId] },
      notes: values.notes,
    }
    try {
      if (income) {
        await updateIncome(income.id, input)
        invalidateData()
        toast.show('Ingreso actualizado')
      } else {
        const id = await createIncome(data.household.id, input)
        invalidateData()
        savedToast({
          message: 'Ingreso guardado',
          undo: () => voidIncome(id),
          undoneMessage: 'Ingreso anulado',
          againPath: '/ingresos/nuevo',
        })
      }
      goBack()
    } catch (error) {
      toast.show(
        toUserMessage(error, 'No pudimos guardar el ingreso. Inténtalo de nuevo.'),
        'error',
      )
    }
  })

  const percentErrors = errors.percents as
    (Record<string, { message?: string }> & { message?: string }) | undefined

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {readOnly && <VoidedNotice label="ingreso" />}
      {!income && (
        <p className="text-sm text-fg-muted">
          Los ingresos no cambian el saldo entre ustedes; sirven para los reportes. ¿Es dinero solo
          tuyo que no quieres sumar al hogar?{' '}
          <Link to="/personal/ingresos/nuevo" replace className="font-medium text-fg underline">
            Regístralo como personal
          </Link>
          .
        </p>
      )}
      <fieldset disabled={readOnly || isSubmitting} className="flex flex-col gap-6">
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label="¿Cuánto fue?" error={errors.amount?.message}>
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  size="lg"
                  autoFocus={!income}
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
        <Field label="¿De dónde viene?" error={errors.source?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              placeholder="Mesada, trabajo, beca…"
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={120}
              {...register('source')}
            />
          )}
        </Field>
        <Controller
          control={control}
          name="userId"
          render={({ field }) => (
            <Segmented
              label="¿Quién lo recibió?"
              value={field.value}
              onChange={field.onChange}
              options={receivers.map((member) => ({
                value: member.userId,
                label: member.userId === data.userId ? 'Yo' : member.displayName,
              }))}
            />
          )}
        />
        <div className="flex flex-col gap-3">
          <Controller
            control={control}
            name="shared"
            render={({ field }) => (
              <Segmented
                label="¿De quién es?"
                value={field.value ? 'shared' : 'single'}
                onChange={(next) => field.onChange(next === 'shared')}
                options={[
                  {
                    value: 'single',
                    label:
                      userId === data.userId ? 'Solo mío' : `Solo de ${memberName(data, userId)}`,
                  },
                  { value: 'shared', label: 'Compartido' },
                ]}
              />
            )}
          />
          {shared && (
            <>
              <p className="text-sm text-fg-muted">
                A cada uno le suma su parte al saldo disponible.
              </p>
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
                percentErrors={Object.fromEntries(
                  Object.entries(percentErrors ?? {})
                    .filter(([key]) => key !== 'message' && key !== 'type' && key !== 'ref')
                    .map(([key, value]) => [key, (value as { message?: string })?.message]),
                )}
              />
            </>
          )}
        </div>
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
          hasValue={Boolean(defaultValues.notes)}
          error={errors.notes?.message}
        />
      </fieldset>

      {!readOnly && (
        <FormFooter>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Guardando' : income ? 'Guardar cambios' : 'Guardar ingreso'}
          </Button>
        </FormFooter>
      )}

      {income && <AuditNote audit={income} />}
      {income && !readOnly && (
        <VoidSection
          label="ingreso"
          onVoid={async () => {
            try {
              await voidIncome(income.id)
              invalidateData()
              toast.show('Ingreso anulado')
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

export function IncomeFormPage() {
  const { id } = useParams()
  const { movements } = useHousehold()
  const income = id
    ? movements.find(
        (movement): movement is Income => movement.kind === 'income' && movement.id === id,
      )
    : undefined

  return (
    <Page>
      <PageHeader title={id ? 'Ingreso' : 'Nuevo ingreso'} back="/" />
      {id && !income ? (
        <EmptyState title="No encontramos ese ingreso">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <IncomeForm key={income?.id ?? 'new'} income={income} />
      )}
    </Page>
  )
}
