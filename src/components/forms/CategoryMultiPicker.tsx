import { CheckIcon } from '@phosphor-icons/react'
import type { Category } from '../../types/domain'
import { CategoryIcon } from '../movements/CategoryIcon'

export const MAX_CATEGORIES = 6

interface CategoryMultiPickerProps {
  label: string
  categories: Category[]
  /** En el orden en que se eligieron: la primera es la principal (icono del movimiento). */
  value: string[]
  onChange: (categoryIds: string[]) => void
  error?: string
}

/** Varias categorías por gasto: casillas grandes; la primera marcada es la principal. */
export function CategoryMultiPicker({
  label,
  categories,
  value,
  onChange,
  error,
}: CategoryMultiPickerProps) {
  const full = value.length >= MAX_CATEGORIES
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-0.5 text-sm font-medium">{label}</legend>
      <p className="mb-1.5 text-sm text-fg-muted">
        Puedes marcar varias (hasta {MAX_CATEGORIES}). La primera es la principal.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map((category) => {
          const position = value.indexOf(category.id)
          const selected = position !== -1
          const disabled = !selected && full
          return (
            <label
              key={category.id}
              className={`relative flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                selected
                  ? 'border-transparent bg-fg font-semibold text-canvas'
                  : 'border-transparent bg-surface-2 text-fg-muted hover:text-fg'
              } ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                value={category.id}
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(category.id)}
                className="sr-only"
              />
              <CategoryIcon icon={category.icon} className="size-5 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col py-1.5 leading-tight">
                <span className="truncate">{category.name}</span>
                {position === 0 && <span className="text-xs font-medium">Principal</span>}
              </span>
              {selected && (
                <CheckIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
              )}
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
