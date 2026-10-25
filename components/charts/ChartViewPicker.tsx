import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { reportViews, type ReportView } from '../../lib/preferences'
import { Sheet } from '../ui/Sheet'

const DESKTOP = '(min-width: 640px)'

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia?.(DESKTOP).matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.(DESKTOP)
    if (!query) return
    const onChange = () => setDesktop(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return desktop
}

/**
 * Lista de vistas como opciones de menú (menuitemradio): nombre y lo que responde cada una.
 * Flechas arriba/abajo, Inicio/Fin para moverse; Enter o espacio elige.
 */
function ViewOptions({
  value,
  onChoose,
  labelledBy,
}: {
  value: ReportView
  onChoose: (view: ReportView) => void
  labelledBy: string
}) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const go = (next: number) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(index + 1)
    else if (event.key === 'ArrowUp') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
  }

  return (
    <div
      ref={list}
      role="menu"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1"
    >
      {reportViews.map((view) => {
        const checked = view.id === value
        return (
          <button
            key={view.id}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            onClick={() => onChoose(view.id)}
            className={`flex min-h-14 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
              checked ? 'bg-surface-2' : 'hover:bg-surface-2/60'
            }`}
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
              {checked && <CheckIcon aria-hidden="true" className="size-5" weight="bold" />}
            </span>
            <span className="flex flex-col">
              <span className={checked ? 'font-semibold' : 'font-medium'}>{view.name}</span>
              <span className="text-sm text-fg-muted">{view.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * "Ver como…": botón grande con la vista actual. En el celular abre una hoja inferior y en
 * escritorio un menú bajo el botón.
 */
export function ChartViewPicker({
  value,
  onChange,
}: {
  value: ReportView
  onChange: (view: ReportView) => void
}) {
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const current = reportViews.find((view) => view.id === value) ?? reportViews[0]

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) button.current?.focus()
  }
  const choose = (view: ReportView) => {
    onChange(view)
    close()
  }

  // Menú de escritorio: se cierra con Escape o al tocar fuera.
  useEffect(() => {
    if (!open || !desktop) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, desktop])

  return (
    <div className="relative">
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-fg-muted">
        Ver como…
      </span>
      <button
        ref={button}
        type="button"
        aria-haspopup={desktop ? 'menu' : 'dialog'}
        aria-expanded={open}
        aria-labelledby={`${labelId} ${labelId}-name`}
        aria-describedby={`${labelId}-desc`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-line-strong sm:w-auto sm:min-w-80"
      >
        <span className="flex flex-col">
          <span id={`${labelId}-name`} className="font-semibold">
            {current.name}
          </span>
          <span id={`${labelId}-desc`} className="text-sm text-fg-muted">
            {current.description}
          </span>
        </span>
        <CaretDownIcon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" weight="bold" />
      </button>

      {desktop
        ? open && (
            <div
              ref={menu}
              className="absolute top-full left-0 z-30 mt-2 w-96 rounded-2xl border border-line-strong bg-surface p-2 shadow-[0_8px_24px_-8px_var(--shadow-tint)]"
            >
              <ViewOptions value={value} onChoose={choose} labelledBy={labelId} />
            </div>
          )
        : open && (
            <Sheet open={open} onClose={() => close()} title="Ver como…">
              <ViewOptions value={value} onChoose={choose} labelledBy={labelId} />
            </Sheet>
          )}
    </div>
  )
}
