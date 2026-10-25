import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación de acciones que no se deshacen (anular, salir del hogar). Usa <dialog> nativo. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        if (!loading) onCancel()
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-surface p-0 text-fg backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {children && <div className="text-sm text-fg-muted">{children}</div>}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
