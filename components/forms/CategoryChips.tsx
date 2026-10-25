import { CheckIcon } from '@phosphor-icons/react'
import type { Category } from '../../types/domain'
import { CategoryIcon } from '../movements/CategoryIcon'

interface CategoryChipsProps {
  label: string
  categories: Category[]
  value: string[]
  onChange: (categoryIds: string[]) => void
  /** Marca "(ingreso)" en las categorías de ingreso cuando se mezclan los dos tipos. */
  showKind?: boolean
}

/** Filtro por varias categorías: chips marcables; sin ninguna marcada, se muestran todas. */
export function CategoryChips({
  label,
  categories,
  value,
  onChange,
  showKind,
}: CategoryChipsProps) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex w-full items-baseline justify-between gap-3 text-sm font-medium">
        <span>{label}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const checked = value.includes(category.id)
          return (
            <label
              key={category.id}
              className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                checked
                  ? 'bg-fg font-semibold text-canvas'
                  : 'bg-surface-2 font-medium text-fg-muted hover:text-fg'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(category.id)}
                className="sr-only"
              />
              {checked ? (
                <CheckIcon aria-hidden="true" className="size-4" weight="bold" />
              ) : (
                <CategoryIcon icon={category.icon} className="size-4" />
              )}
              {category.name}
              {showKind && category.kind === 'income' && (
                <span className="font-normal opacity-80">(ingreso)</span>
              )}
            </label>
          )
        })}
      </div>
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-fg-muted underline hover:text-fg"
        >
          Todas las categorías
        </button>
      )}
    </fieldset>
  )
}
