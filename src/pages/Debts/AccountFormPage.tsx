import { useState } from 'react'
import { useParams } from 'react-router'
import { useNavigate } from 'react-router'
import { useHousehold } from '../../app/household-context'
import { useDebtAccounts } from '../../hooks/useDebts'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import {
  createAccount,
  deleteAccount,
  removeFile,
  updateAccount,
  uploadFile,
} from '../../services/debts'
import type { DebtAccount } from '../../types/domain'
import { FilePicker } from '../../components/debts/FilePicker'
import { FormFooter } from '../../components/forms/FormParts'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const dayOrNull = (raw: string) => {
  const value = Number(raw)
  return raw.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 31 ? value : null
}

function AccountForm({ account }: { account?: DebtAccount }) {
  const { household, userId } = useHousehold()
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [last4, setLast4] = useState(account?.last4 ?? '')
  const [cutDay, setCutDay] = useState(account?.cutDay ? String(account.cutDay) : '')
  const [dueDay, setDueDay] = useState(account?.dueDay ? String(account.dueDay) : '')
  const [notes, setNotes] = useState(account?.notes ?? '')
  const [image, setImage] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Ponle un nombre a la tarjeta.')
    if (last4 && !/^\d{4}$/.test(last4)) return setError('Pon solo los últimos 4 dígitos.')
    setError('')
    setSaving(true)
    try {
      let imagePath = account?.imagePath ?? null
      if (image) {
        const previous = imagePath
        imagePath = await uploadFile(userId, image)
        if (previous) await removeFile(previous).catch(() => {})
      }
      const input = {
        name,
        last4,
        cutDay: dayOrNull(cutDay),
        dueDay: dayOrNull(dueDay),
        notes,
        imagePath,
      }
      const id = account
        ? (await updateAccount(account.id, input), account.id)
        : await createAccount(household.id, input)
      invalidateData()
      toast.show(account ? 'Cambios guardados' : 'Tarjeta guardada')
      navigate(`/tarjetas/${id}`, { replace: true })
    } catch (err) {
      toast.show(toUserMessage(err, 'No pudimos guardarla. Inténtalo de nuevo.'), 'error')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <fieldset disabled={saving} className="flex flex-col gap-6">
        <Field label="Nombre" error={error.includes('nombre') ? error : undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              autoFocus={!account}
              maxLength={60}
              placeholder="Visa Bancolombia, Nu, Rappi…"
              value={name}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Últimos 4 dígitos (opcional)"
          hint="Nunca guardes el número completo."
          error={error.includes('dígitos') ? error : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              maxLength={4}
              value={last4}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Día de corte (opcional)">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="numeric"
                maxLength={2}
                value={cutDay}
                onChange={(e) => setCutDay(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
          <Field label="Día límite de pago (opcional)">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="numeric"
                maxLength={2}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        </div>
        <FilePicker
          label="Foto de la tarjeta (opcional)"
          file={image}
          existingName={account?.imagePath ? 'imagen guardada' : null}
          onChange={setImage}
          onError={(message) => toast.show(message, 'error')}
        />
        <Field label="Notas (opcional)">
          {({ id }) => (
            <TextArea
              id={id}
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
      </fieldset>
      <FormFooter>
        <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
          {saving ? 'Guardando' : account ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </FormFooter>
      {account && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-sm text-fg-muted">
            Si ya no la usas, bórrala. Se borran también sus extractos guardados.
          </p>
          <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>
            Borrar tarjeta
          </Button>
          <ConfirmDialog
            open={confirming}
            title="¿Borrar esta tarjeta?"
            confirmLabel="Borrar"
            loading={deleting}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              setDeleting(true)
              try {
                await deleteAccount(account.id)
                if (account.imagePath) await removeFile(account.imagePath).catch(() => {})
                invalidateData()
                toast.show('Tarjeta borrada')
                navigate('/tarjetas', { replace: true })
              } catch (err) {
                toast.show(toUserMessage(err), 'error')
                setDeleting(false)
                setConfirming(false)
              }
            }}
          >
            «{account.name}» y todos sus extractos dejan de existir. No se puede deshacer.
          </ConfirmDialog>
        </section>
      )}
    </form>
  )
}

/** Nueva tarjeta (`/tarjetas/nueva`) o edición (`/tarjetas/:id/editar`). */
export function AccountFormPage() {
  const { id } = useParams()
  const accounts = useDebtAccounts()
  const account = id ? accounts.data?.find((entry) => entry.id === id) : undefined
  return (
    <Page>
      <PageHeader title={id ? 'Editar tarjeta' : 'Nueva tarjeta'} back="/tarjetas" />
      {!id ? (
        <AccountForm />
      ) : accounts.loading ? (
        <LedgerSkeleton days={1} />
      ) : !account ? (
        <EmptyState title="No encontramos esa tarjeta">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <AccountForm key={account.id} account={account} />
      )}
    </Page>
  )
}
