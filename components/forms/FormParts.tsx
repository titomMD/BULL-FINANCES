import { useState, type ReactNode } from 'react'
import { ProhibitIcon } from '@phosphor-icons/react'
import { memberName, useHousehold } from '../../app/household-context'
import { formatDay, toBogotaDay } from '../../lib/dates'
import type { Audit } from '../../types/domain'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/** Botón de guardar: fijo abajo en móvil (zona del pulgar), en línea en escritorio. */
export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-line bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2 sm:pb-0">
      {children}
    </div>
  )
}

/** Quién creó y quién modificó el registro (spec §22). */
export function AuditNote({ audit }: { audit: Audit }) {
  const data = useHousehold()
  const who = (userId: string | null) =>
    userId === data.userId ? 'ti' : memberName(data, userId ?? '')
  const edited = audit.updatedAt !== audit.createdAt && audit.updatedBy
  return (
    <p className="text-sm text-fg-muted">
      Registrado por {who(audit.createdBy)} el {formatDay(toBogotaDay(audit.createdAt))}.
      {edited &&
        ` Último cambio por ${who(audit.updatedBy)} el ${formatDay(toBogotaDay(audit.updatedAt))}.`}
    </p>
  )
}

/** Anular (no se borra; spec §22). */
export function VoidSection({ label, onVoid }: { label: string; onVoid: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <section className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
      <div>
        <h2 className="font-semibold">Anular {label}</h2>
        <p className="text-sm text-fg-muted">
          Deja de contar en el saldo y en los reportes, pero queda en el historial.
        </p>
      </div>
      <Button
        variant="danger"
        className="self-start"
        icon={<ProhibitIcon aria-hidden="true" className="size-4" weight="bold" />}
        onClick={() => setOpen(true)}
      >
        Anular
      </Button>
      <ConfirmDialog
        open={open}
        title={`¿Anular este ${label}?`}
        confirmLabel="Sí, anular"
        loading={busy}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true)
          try {
            await onVoid()
          } finally {
            setBusy(false)
            setOpen(false)
          }
        }}
      >
        No se puede deshacer. El movimiento quedará marcado como anulado.
      </ConfirmDialog>
    </section>
  )
}

export function VoidedNotice({ label }: { label: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted"
    >
      <ProhibitIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
      Este {label} está anulado: ya no cuenta en el saldo y no se puede editar.
    </p>
  )
}
