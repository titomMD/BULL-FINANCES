import { useState } from 'react'
import { TrashIcon } from '@phosphor-icons/react'
import { useMyShares } from '../../hooks/usePockets'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { createShare, deleteShare } from '../../services/pockets'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { useToast } from '../../components/ui/toast-context'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Compartir la libreta en solo lectura: quien tenga ese correo la ve en su menú, sin poder cambiar nada. */
export function SharePanel() {
  const toast = useToast()
  const shares = useMyShares()
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('Juan')
  const [busy, setBusy] = useState(false)

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(email.trim())) return toast.show('Revisa el correo.', 'error')
    if (!label.trim()) return toast.show('Ponle un nombre al botón.', 'error')
    setBusy(true)
    try {
      await createShare(email, label)
      invalidateData()
      setEmail('')
      toast.show('Listo: ya puede verla cuando entre con ese correo')
    } catch (error) {
      toast.show(
        toUserMessage(error, 'No pudimos compartirla. ¿Ya estaba compartida con ese correo?'),
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        Compartir con tu mamá
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        <p className="text-sm text-fg-muted">
          Ella solo podrá <strong>ver</strong> esta libreta (cobros, pagos y los detalles que
          escribas), nunca cambiarla ni ver nada más de tu cuenta. Debe crear su cuenta en la app
          con ese mismo correo (o entrar con Google) y le aparecerá un botón con el nombre que
          elijas.
        </p>
        <form onSubmit={add} noValidate className="grid gap-3 sm:grid-cols-2">
          <Field label="Su correo">
            {({ id }) => (
              <TextInput
                id={id}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Nombre del botón en su menú">
            {({ id }) => (
              <TextInput
                id={id}
                maxLength={30}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            className="sm:col-span-2 sm:justify-self-start"
          >
            Compartir
          </Button>
        </form>
        {(shares.data ?? []).length > 0 && (
          <ul className="divide-y divide-line">
            {(shares.data ?? []).map((share) => (
              <li key={share.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{share.viewerEmail}</span>
                  <span className="text-xs text-fg-muted">Botón «{share.label}»</span>
                </span>
                <button
                  type="button"
                  aria-label={`Dejar de compartir con ${share.viewerEmail}`}
                  className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                  onClick={async () => {
                    try {
                      await deleteShare(share.id)
                      invalidateData()
                      toast.show('Dejaste de compartir')
                    } catch (error) {
                      toast.show(toUserMessage(error), 'error')
                    }
                  }}
                >
                  <TrashIcon aria-hidden="true" className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
