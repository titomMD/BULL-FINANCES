import type { ReactNode } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from './Button'
import { Brand } from '../Brand'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
}

/** Esqueleto con la forma del libro diario. */
export function LedgerSkeleton({ days = 3 }: { days?: number }) {
  return (
    <div role="status" aria-label="Cargando movimientos" className="flex flex-col gap-6">
      {Array.from({ length: days }, (_, day) => (
        <div key={day} className="flex flex-col gap-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 2 }, (_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong px-5 py-8 sm:items-center sm:text-center">
      {icon && <div className="text-fg-muted [&>svg]:size-8">{icon}</div>}
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {children && <div className="max-w-sm text-sm text-fg-muted">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl bg-negative-bg px-5 py-5 text-sm"
    >
      <p className="flex items-start gap-2 text-fg">
        <WarningCircleIcon
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-negative"
          weight="bold"
        />
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function FullScreenLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-fg-muted">
        <span className="text-fg">
          <Brand size="lg" />
        </span>
        <span className="text-sm">{label}…</span>
      </div>
    </div>
  )
}
