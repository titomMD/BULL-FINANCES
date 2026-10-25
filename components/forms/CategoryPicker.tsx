import { useId } from 'react'
import type { Category } from '../../types/domain'
import { CategoryIcon } from '../movements/CategoryIcon'

interface CategoryPickerProps {
  label: string
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
  error?: string
  /** Permite dejar la categoría vacía (ingresos). */
  optional?: boolean
}

/** Categorías como botones grandes con icono: elegir es un toque (spec §36). */
export function CategoryPicker({
  label,
  categories,
  value,
  onChange,
  error,
  optional,
}: CategoryPickerProps) {
  const name = useId()
  const options = optional
    ? [{ id: '', name: 'Sin categoría', icon: null }, ...categories]
    : categories

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((category) => {
          const selected = category.id === value
          return (
            <label
              key={category.id || 'none'}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                selected
                  ? 'border-transparent bg-fg font-semibold text-canvas'
                  : 'border-transparent bg-surface-2 text-fg-muted hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={category.id}
                checked={selected}
                onChange={() => onChange(category.id)}
                className="sr-only"
              />
              <CategoryIcon icon={category.icon} className="size-5 shrink-0" />
              <span className="truncate">{category.name}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </fieldset>
  )
}
