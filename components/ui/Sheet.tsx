import { useEffect, useId, useRef, type ReactNode } from 'react'
import { XIcon } from '@phosphor-icons/react'

interface SheetProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

/**
 * Hoja inferior para explicaciones (en móvil sale desde abajo; en escritorio, centrada).
 * Usa <dialog> nativo: foco atrapado, Escape y fondo inerte sin código propio.
 */
export function Sheet({ open, title, children, onClose }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        // Tocar el fondo (fuera del contenido) cierra; arrastrar desde dentro no.
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose()
      }}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-b-0 border-line-strong bg-surface p-0 text-fg backdrop:bg-scrim motion-safe:open:animate-[sheet-in_260ms_var(--ease-out-expo)] sm:my-auto sm:w-[min(32rem,calc(100vw-2rem))] sm:rounded-2xl sm:border-b"
    >
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <XIcon aria-hidden="true" className="size-5" weight="bold" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
