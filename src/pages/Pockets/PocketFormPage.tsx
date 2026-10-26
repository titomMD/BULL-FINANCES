import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useHousehold } from '../../app/household-context'
import { usePockets } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { formatAmount, parseMoneyInput } from '../../lib/money'
import { createPocket, deletePocket, setPocketArchived, updatePocket } from '../../services/pockets'
import type { Pocket } from '../../types/domain'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { FormFooter } from '../../components/forms/FormParts'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

function PocketForm({ pocket, count }: { pocket?: Pocket; count: number }) {
  const { household } = useHousehold()
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(pocket?.name ?? '')
  const [goal, setGoal] = useState(pocket?.goal ? formatAmount(pocket.goal) : '')
  const [opening, setOpening] = useState('')
  const [covers, setCovers] = useState(pocket?.coversReceivable ?? false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre al bolsillo.')
    setError('')
    setSaving(true)
    try {
      const input = { name, goal: goal ? parseMoneyInput(goal) : null, coversReceivable: covers }
      if (pocket) {
        await updatePocket(pocket.id, input)
        invalidateData()
        toast.show('Cambios guardados')
        navigate(`/bolsillos/${pocket.id}`, { replace: true })
      } else {
        const id = await createPocket(household.id, input, parseMoneyInput(opening) ?? 0, count)
        invalidateData()
        toast.show('Bolsillo creado')
        navigate(`/bolsillos/${id}`, { replace: true })
      }
    } catch (err) {
      toast.show(toUserMessage(err, 'No pudimos guardarlo. Inténtalo de nuevo.'), 'error')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <fieldset disabled={saving} className="flex flex-col gap-6">
        <Field label="Nombre" error={error || undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              autoFocus={!pocket}
              maxLength={60}
              placeholder="1ER SEMESTRE 2027, GASOLINA…"
              value={name}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Meta (opcional)"
          hint="Lo que este bolsillo debería tener. Con ella ves el avance y lo que falta."
        >
          {({ id }) => <MoneyInput id={id} value={goal} onChange={setGoal} />}
        </Field>
        {!pocket && (
          <Field label="¿Cuánto tiene hoy?" hint="Copia el saldo que ves en Bancolombia.">
            {({ id }) => <MoneyInput id={id} value={opening} onChange={setOpening} />}
          </Field>
        )}
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={covers}
            onChange={(e) => setCovers(e.target.checked)}
            className="mt-1 size-5 accent-(--color-primary)"
          />
          <span className="flex flex-col">
            <span className="font-medium">Lo que falta aquí lo cubre lo que mamá me debe</span>
            <span className="text-sm text-fg-muted">
              Úsalo en el bolsillo grande del semestre: verás cuánto falta y cuánto te debe ella.
            </span>
          </span>
        </label>
      </fieldset>
      <FormFooter>
        <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
          {saving ? 'Guardando' : pocket ? 'Guardar cambios' : 'Crear bolsillo'}
        </Button>
      </FormFooter>
      {pocket && (
        <section className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm text-fg-muted">
            Archivar lo oculta de la lista sin perder su historial. Borrar elimina también todos sus
            movimientos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await setPocketArchived(pocket.id, !pocket.archivedAt)
                  invalidateData()
                  navigate('/bolsillos', { replace: true })
                } catch (err) {
                  toast.show(toUserMessage(err), 'error')
                }
              }}
            >
              {pocket.archivedAt ? 'Desarchivar' : 'Archivar'}
            </Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Borrar bolsillo
            </Button>
          </div>
          <ConfirmDialog
            open={confirming}
            title="¿Borrar este bolsillo?"
            confirmLabel="Borrar"
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              try {
                await deletePocket(pocket.id)
                invalidateData()
                toast.show('Bolsillo borrado')
                navigate('/bolsillos', { replace: true })
              } catch (err) {
                toast.show(toUserMessage(err), 'error')
                setConfirming(false)
              }
            }}
          >
            «{pocket.name}» y todos sus movimientos dejan de existir. No se puede deshacer.
          </ConfirmDialog>
        </section>
      )}
    </form>
  )
}

/** Nuevo bolsillo (`/bolsillos/nuevo`) o edición (`/bolsillos/:id/editar`). */
export function PocketFormPage() {
  const { id } = useParams()
  const pockets = usePockets()
  const pocket = id ? pockets.data?.find((entry) => entry.id === id) : undefined
  return (
    <Page>
      <PageHeader
        title={id ? 'Editar bolsillo' : 'Nuevo bolsillo'}
        back={id ? `/bolsillos/${id}` : '/bolsillos'}
      />
      {!id ? (
        <PocketForm count={pockets.data?.length ?? 0} />
      ) : pockets.loading ? (
        <LedgerSkeleton days={1} />
      ) : !pocket ? (
        <EmptyState title="No encontramos ese bolsillo">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <PocketForm key={pocket.id} pocket={pocket} count={pockets.data?.length ?? 0} />
      )}
    </Page>
  )
}
