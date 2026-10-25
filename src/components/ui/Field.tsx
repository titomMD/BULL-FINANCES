import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { CaretDownIcon, WarningCircleIcon } from '@phosphor-icons/react'

export const controlClasses =
  'w-full rounded-xl border border-transparent bg-surface-2 px-3.5 text-base text-fg placeholder:text-fg-muted transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-wash aria-invalid:border-negative disabled:opacity-50'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}

/** Etiqueta arriba, ayuda opcional y error debajo (nunca placeholder como etiqueta). */
export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-sm text-negative">
          <WarningCircleIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${controlClasses} h-12 ${className}`} {...props} />
  },
)

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={`${controlClasses} min-h-24 resize-y py-3 ${className}`}
      {...props}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`${controlClasses} h-12 appearance-none pr-10 ${className}`}
          {...props}
        >
          {children}
        </select>
        <CaretDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-fg-muted"
          weight="bold"
        />
      </div>
    )
  },
)
