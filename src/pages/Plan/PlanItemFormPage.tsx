import { useState } from 'react'
import { useParams } from 'react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHousehold } from '../../app/household-context'
import { useGoBack } from '../../hooks/useGoBack'
import { usePlan } from '../../hooks/usePlan'
import { invalidateData } from '../../hooks/useResource'
import { endOfMonth } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { planItemSchema, type PlanItemFormValues } from '../../lib/validation/movements'
import {
  createPlanItem,
  deletePlanItem,
  updatePlanItem,
  type PlanItemInput,
} from '../../services/plan'
import type { PlanItem, PlanKind } from '../../types/domain'
import { FormFooter } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const copy: Record<
  PlanKind,
  {
    title: string
    newTitle: string
    amount: string
    name: string
    placeholder: string
    intro: string
  }
> = {
  income: {
    title: 'Ingreso del plan',
    newTitle: 'Nuevo ingreso',
    amount: '¿Cuánto te entra al mes?',
    name: '¿De dónde viene?',
    placeholder: 'Mesada, fondo, trabajo…',
    intro:
      'Si solo llega unos meses (por ejemplo la cuota de un fondo), pon desde y hasta qué mes.',
  },
  expense: {
    title: 'Gasto fijo',
    newTitle: 'Nuevo gasto fijo',
    amount: '¿Cuánto pagas al mes?',
    name: '¿Qué es?',
    placeholder: 'Gimnasio, gasolina, suscripción…',
    intro:
      'Un gasto que se repite cada mes. Las suscripciones puedes agruparlas con el mismo grupo (por ejemplo «Membresías»).',
  },
  saving: {
    title: 'Ahorro del plan',
    newTitle: 'Nuevo ahorro',
    amount: '¿Cuánto apartas al mes?',
    name: '¿Para qué?',
    placeholder: 'Ahorro mensual, meta…',
    intro:
      'El ahorro no es un gasto: es plata que apartas antes de gastar. Sale de lo que te sobra.',
  },
}

function PlanItemForm({ kind, item }: { kind: PlanKind; item?: PlanItem }) {
  const data = useHousehold()
  const plan = usePlan()
  const goBack = useGoBack('/plan')
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const text = copy[kind]
  const groups = [
    ...new Set((plan.data ?? []).map((entry) => entry.groupName).filter((name) => name)),
  ] as string[]

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanItemFormValues>({
    resolver: zodResolver(planItemSchema),
    defaultValues: item
      ? {
          name: item.name,
          amount: formatMoneyInput(String(item.amount)),
          groupName: item.groupName ?? '',
          startMonth: item.startsOn?.slice(0, 7) ?? '',
          endMonth: item.endsOn?.slice(0, 7) ?? '',
          tracked: item.tracked,
          dueDay: item.dueDay ? String(item.dueDay) : '',
          remindDays: String(item.remindDays),
        }
      : {
          name: '',
          amount: '',
          groupName: '',
          startMonth: '',
          endMonth: '',
          tracked: false,
          dueDay: '',
          remindDays: '3',
        },
  })

  const onSubmit = handleSubmit(async (values) => {
    const input: PlanItemInput = {
      name: values.name,
      groupName: kind === 'expense' ? values.groupName || null : null,
      amount: parseMoneyInput(values.amount)!,
      startsOn: values.startMonth ? `${values.startMonth}-01` : null,
      endsOn: values.endMonth ? endOfMonth(`${values.endMonth}-01`) : null,
      tracked: kind === 'expense' ? Boolean(values.tracked) : false,
      dueDay: kind === 'expense' && values.dueDay ? Number(values.dueDay) : null,
      remindDays: values.remindDays ? Number(values.remindDays) : 3,
    }
    try {
      if (item) await updatePlanItem(item.id, input)
      else await createPlanItem(data.household.id, kind, input, (plan.data ?? []).length)
      invalidateData()
      toast.show(item ? 'Cambios guardados' : 'Guardado')
      goBack()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo. Inténtalo de nuevo.'), 'error')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {!item && <p className="text-sm text-fg-muted">{text.intro}</p>}
      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label={text.amount} error={errors.amount?.message}>
              {({ id, describedBy, invalid }) => (
                <MoneyInput
                  id={id}
                  size="lg"
                  autoFocus={!item}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...field}
                />
              )}
            </Field>
          )}
        />
        <Field label={text.name} error={errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              placeholder={text.placeholder}
              autoComplete="off"
              maxLength={80}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('name')}
            />
          )}
        </Field>
        {kind === 'expense' && (
          <Field
            label="Grupo (opcional)"
            hint="Por ejemplo «Membresías»: los gastos con el mismo grupo se suman juntos."
            error={errors.groupName?.message}
          >
            {({ id, describedBy, invalid }) => (
              <>
                <TextInput
                  id={id}
                  list="grupos-plan"
                  autoComplete="off"
                  maxLength={60}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register('groupName')}
                />
                <datalist id="grupos-plan">
                  {groups.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        )}
        {kind === 'expense' && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-(--color-primary)"
              {...register('tracked')}
            />
            <span className="flex flex-col py-2 leading-tight">
              <span className="font-medium">Registrar gastos de esta línea (con tope)</span>
              <span className="text-sm text-fg-muted">
                Para gasolina o recibos que cambian cada mes (luz, agua, gas): pones un tope, anotas
                cada tanqueada o recibo (con foto o PDF si quieres) y se resta del tope.
              </span>
            </span>
          </label>
        )}
        {kind === 'expense' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Día del mes en que se paga (opcional)"
              hint="Si lo pones, la app te avisa antes de que venza."
              error={errors.dueDay?.message}
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="12"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register('dueDay')}
                />
              )}
            </Field>
            <Field
              label="Avisar cuántos días antes"
              hint="Normalmente 2 o 3."
              error={errors.remindDays?.message}
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  maxLength={2}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register('remindDays')}
                />
              )}
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Desde el mes (opcional)"
            hint="Vacío = desde siempre."
            error={errors.startMonth?.message}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="month"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('startMonth')}
              />
            )}
          </Field>
          <Field
            label="Hasta el mes (opcional)"
            hint="Vacío = sin fecha de fin."
            error={errors.endMonth?.message}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="month"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('endMonth')}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <FormFooter>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Guardando' : item ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </FormFooter>

      {item && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-sm text-fg-muted">
            Si ya no aplica, quítalo del plan. Los meses se recalculan sin él.
          </p>
          <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>
            Quitar del plan
          </Button>
          <ConfirmDialog
            open={confirming}
            title="¿Quitar esta línea del plan?"
            confirmLabel="Quitar"
            loading={deleting}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              setDeleting(true)
              try {
                await deletePlanItem(item.id)
                invalidateData()
                toast.show('Quitado del plan')
                goBack()
              } catch (error) {
                toast.show(toUserMessage(error), 'error')
                setDeleting(false)
                setConfirming(false)
              }
            }}
          >
            «{item.name}» deja de contar en todos los meses.
          </ConfirmDialog>
        </section>
      )}
    </form>
  )
}

const isKind = (value: string | undefined): value is PlanKind =>
  value === 'income' || value === 'expense' || value === 'saving'

/** Nueva línea del plan (`/plan/nuevo/:kind`) o edición de una (`/plan/:id`). */
export function PlanItemFormPage() {
  const { id, kind: kindParam } = useParams()
  const plan = usePlan()
  const item = id ? plan.data?.find((entry) => entry.id === id) : undefined
  const kind: PlanKind = item?.kind ?? (isKind(kindParam) ? kindParam : 'expense')
  const title = id ? copy[kind].title : copy[kind].newTitle

  return (
    <Page>
      <PageHeader title={title} back="/plan" />
      {!id ? (
        <PlanItemForm kind={kind} />
      ) : plan.loading ? (
        <LedgerSkeleton days={1} />
      ) : plan.error && !plan.data ? (
        <ErrorState message={toUserMessage(plan.error)} />
      ) : !item ? (
        <EmptyState title="No encontramos esa línea">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <PlanItemForm key={item.id} kind={item.kind} item={item} />
      )}
    </Page>
  )
}
