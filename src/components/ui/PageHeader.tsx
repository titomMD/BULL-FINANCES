import type { ReactNode } from 'react'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { useGoBack } from '../../hooks/useGoBack'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Muestra un botón para volver (formularios y pantallas de detalle). */
  back?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  const goBack = useGoBack(back)
  return (
    <header className="flex items-start gap-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 lg:pt-8">
      {back && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Volver"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg hover:bg-surface-2"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-5" weight="bold" />
        </button>
      )}
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${back ? 'pt-2' : ''}`}>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <div className="text-sm text-fg-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Contenedor estándar de las pantallas. */
export function Page({
  children,
  width = 'md',
}: {
  children: ReactNode
  width?: 'md' | 'lg' | 'xl'
}) {
  const max = { md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[width]
  return <div className={`mx-auto w-full ${max} px-4 pb-10 sm:px-6 lg:px-10`}>{children}</div>
}
