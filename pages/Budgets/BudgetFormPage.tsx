import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHousehold } from '../../app/household-context'
import { useBudgets } from '../../hooks/useBudgets'
import { useGoBack } from '../../hooks/useGoBack'
import { invalidateData } from '../../hooks/useResource'
import { budgetProgress, myShare } from '../../lib/calculations/budgets'
import { formatDay, todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { budgetSchema, type BudgetFormValues } from '../../lib/validation/budgets'
import { createBudget, deleteBudget, updateBudget } from '../../services/budgets'
import type { Budget } from '../../types/domain'
import { BudgetBar, BudgetStatus } from '../../components/budgets/BudgetParts'
import { periodLabel } from '../../components/budgets/budgetLabels'
import { FormFooter } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { movementPath } from '../../components/movements/describe'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, Select, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const kindHints = {
  category: 'Cuenta tu parte de los gastos de una categoría.',
  total: 'Cuenta tu parte de todo lo que gastas.',
  free: 'Tú eliges qué gastos cuentan: al registrar un gasto, márcalo en «Mis presupuestos».',
} as const

/** Lo que cuenta en el periodo vigente y cómo va. */
function BudgetSummary({ budget }: { budget: Budget }) {
  const data = useHousehold()
  const today = todayBogota()
  const progress = budgetProgress(budget, data.movements, data.userId, today)
  return (
    <section aria-labelledby="este-periodo" className="flex flex-col gap-3">
      <h2 id="este-periodo" className="text-sm font-semibold text-fg-muted">
        {budget.period === 'month' ? 'Este mes' : 'Esta semana'} ·{' '}
        {formatDay(progress.range.from, today)} al {formatDay(progress.range.to, today)}
      </h2>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <p className="text-sm text-fg-muted">
          Llevas{' '}
          <span className="tabular font-semibold text-fg">{formatMoney(progress.spent)}</span>
        </p>
        <BudgetBar progress={progress} />
        <BudgetStatus progress={progress} />
      </div>
      {progress.expenses.length > 0 ? (
        <ul className="divide-y divide-line rounded-2xl bg-surface px-4">
          {progress.expenses.map((expense) => (
            <li key={expense.id}>
              <Link
                to={movementPath(expense)}
                className="-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-surface-2/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{expense.description}</span>
                  <span className="text-xs text-fg-muted">{formatDay(expense.date, today)}</span>
                </span>
                <span className="shrink-0 text-sm text-fg-muted">
                  tu parte{' '}
                  <span className="tabular font-semibold text-fg">
                    {formatMoney(myShare(expense, data.userId))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          {budget.kind === 'free'
            ? 'Aún no hay gastos marcados en este presupuesto en este periodo.'
            : 'Aún no hay gastos que cuenten en este periodo.'}
        </p>
      )}
    </section>
  )
}

function BudgetForm({ budget }: { budget?: Budget }) {
  const data = useHousehold()
  const goBack = useGoBack('/presupuestos')
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const categories = data.categories.filter(
    (category) =>
      category.kind === 'expense' && (!category.archivedAt || category.id === budget?.categoryId),
  )

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: budget
      ? {
          kind: budget.kind,
          name: budget.name,
          categoryId: budget.categoryId ?? '',
          amount: formatMoneyInput(String(budget.amount)),
          period: budget.period,
        }
      : { kind: 'category', name: '', categoryId: '', amount: '', period: 'month' },
  })
  const kind = useWatch({ control, name: 'kind' })

  const onSubmit = handleSubmit(async (values) => {
    const category = categories.find((item) => item.id === values.categoryId)
    const input = {
      kind: values.kind,
      // Por categoría, el nombre es opcional: se usa el de la categoría.
      name: values.name.trim() || category?.name || 'Presupuesto',
      categoryId: values.kind === 'category' ? values.categoryId : null,
      amount: parseMoneyInput(values.amount)!,
      period: values.period,
    }
    try {
      if (budget) await updateBudget(budget.id, input)
      else await createBudget(data.household.id, input)
      invalidateData()
      toast.show(budget ? 'Presupuesto actualizado' : 'Presupuesto creado')
      goBack()
    } catch (error) {
      toast.show(
        toUserMessage(error, 'No pudimos guardar el presupuesto. Inténtalo de nuevo.'),
        'error',
      )
    }
  })

  return (
    <div className="flex flex-col gap-8">
      {budget && <BudgetSummary budget={budget} />}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {budget && <h2 className="text-base font-semibold">Ajustar presupuesto</h2>}
        <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <Segmented
                  label="Tipo"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'category', label: 'Categoría' },
                    { value: 'total', label: 'Tope total' },
                    { value: 'free', label: 'Libre' },
                  ]}
                />
                <p className="text-sm text-fg-muted">{kindHints[field.value]}</p>
              </div>
            )}
          />
          {kind === 'category' && (
            <Field label="Categoría" error={errors.categoryId?.message}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register('categoryId')}
                >
                  <option value="">Elige una</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field
            label={kind === 'category' ? 'Nombre (opcional)' : 'Nombre'}
            error={errors.name?.message}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                maxLength={60}
                placeholder={
                  kind === 'free' ? 'Salidas' : kind === 'total' ? 'Todo el mes' : 'Mercado'
                }
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('name')}
              />
            )}
          </Field>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Field label="¿Cuánto quieres gastar como máximo?" error={errors.amount?.message}>
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
            name="period"
            render={({ field }) => (
              <Segmented
                label="Cada cuánto se reinicia"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'month', label: 'Cada mes' },
                  { value: 'week', label: 'Cada semana' },
                ]}
              />
            )}
          />
        </fieldset>

        <FormFooter>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Guardando' : budget ? 'Guardar cambios' : 'Crear presupuesto'}
          </Button>
        </FormFooter>
      </form>

      {budget && (
        <section className="flex flex-col items-start gap-2 border-t border-line pt-6">
          <h2 className="font-semibold">Borrar presupuesto</h2>
          <p className="text-sm text-fg-muted">
            Se borra solo el presupuesto ({formatMoney(budget.amount)} {periodLabel[budget.period]}
            ). Los gastos no cambian.
          </p>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Borrar
          </Button>
          <ConfirmDialog
            open={confirming}
            title="¿Borrar este presupuesto?"
            confirmLabel="Borrar"
            loading={deleting}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              setDeleting(true)
              try {
                await deleteBudget(budget.id)
                invalidateData()
                toast.show('Presupuesto borrado')
                goBack()
              } catch (error) {
                toast.show(toUserMessage(error), 'error')
              } finally {
                setDeleting(false)
                setConfirming(false)
              }
            }}
          >
            Los gastos no se borran; solo deja de existir este tope.
          </ConfirmDialog>
        </section>
      )}
    </div>
  )
}

export function BudgetFormPage() {
  const { id } = useParams()
  const budgets = useBudgets()
  const budget = id ? budgets.data?.find((item) => item.id === id) : undefined

  return (
    <Page>
      <PageHeader
        title={id ? (budget?.name ?? 'Presupuesto') : 'Nuevo presupuesto'}
        back="/presupuestos"
      />
      {id && budgets.loading ? (
        <LedgerSkeleton days={1} />
      ) : id && !budget ? (
        <EmptyState title="No encontramos ese presupuesto">Puede que lo hayas borrado.</EmptyState>
      ) : (
        <BudgetForm key={budget?.id ?? 'new'} budget={budget} />
      )}
    </Page>
  )
}
