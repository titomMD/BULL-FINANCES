import { useId, type ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  label: string
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  hideLabel?: boolean
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'md' | 'sm'
}

/** Grupo de radio con apariencia segmentada: navegable con flechas, una sola parada de tab. */
export function Segmented<T extends string>({
  label,
  hideLabel,
  value,
  options,
  onChange,
  size = 'md',
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={hideLabel ? 'sr-only' : 'mb-1.5 text-sm font-medium text-fg'}>
        {label}
      </legend>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={`relative flex flex-1 cursor-pointer items-center justify-center rounded-lg px-2 text-center font-medium transition-colors duration-150 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
              size === 'md' ? 'min-h-11 text-sm' : 'min-h-10 text-[0.8125rem]'
            } ${
              option.value === value
                ? 'bg-fg font-semibold text-canvas'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
