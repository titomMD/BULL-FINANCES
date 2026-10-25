import { useId, useState } from 'react'
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { invalidateData } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { createCategory, deleteCategory, updateCategory } from '../../services/household'
import type { Category, CategoryKind } from '../../types/domain'
import { categoryColors, type CategoryColorId } from '../../lib/appearance'
import { CategoryBadge, CategoryIcon } from '../../components/movements/CategoryIcon'
import { categorySolid } from '../../components/movements/categoryColors'
import { iconChoices, iconLabels } from '../../components/movements/categoryIcons'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { useToast } from '../../components/ui/toast-context'

function IconChooser({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Icono</legend>
      <div className="flex flex-wrap gap-1.5">
        {iconChoices.map((icon) => (
          <label
            key={icon}
            className={`grid size-11 cursor-pointer place-items-center rounded-xl border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
              value === icon
                ? 'border-transparent bg-fg text-canvas'
                : 'border-transparent bg-surface-2 text-fg-muted hover:text-fg'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={icon}
              checked={value === icon}
              onChange={() => onChange(icon)}
              className="sr-only"
              aria-label={iconLabels[icon] ?? icon}
            />
            <CategoryIcon icon={icon} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Paleta curada de colores; "Sin color" deja el círculo neutro. */
function ColorChooser({
  value,
  onChange,
}: {
  value: CategoryColorId | null
  onChange: (color: CategoryColorId | null) => void
}) {
  const name = useId()
  const options: Array<{ id: CategoryColorId | null; name: string }> = [
    { id: null, name: 'Sin color' },
    ...categoryColors,
  ]
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Color</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = value === option.id
          return (
            <label
              key={option.id ?? 'none'}
              className={`grid size-11 cursor-pointer place-items-center rounded-full border-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                checked ? 'border-fg' : 'border-transparent'
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="sr-only"
                aria-label={option.name}
              />
              <span
                className={`grid size-8 place-items-center rounded-full ${
                  option.id ? categorySolid[option.id] : 'border border-line-strong bg-surface-2'
                } ${option.id ? 'text-on-swatch' : 'text-fg'}`}
              >
                {checked && <CheckIcon aria-hidden="true" className="size-4" weight="bold" />}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const toast = useToast()
  const data = useHousehold()
  // Con movimientos no se puede borrar (la base de datos lo impide): solo archivar.
  const inUse = data.movements.some(
    (movement) =>
      (movement.kind === 'expense' || movement.kind === 'income') &&
      movement.categoryId === category.id,
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon ?? 'tag')
  const [color, setColor] = useState(category.color)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    try {
      await action()
      invalidateData()
      toast.show(success)
      setEditing(false)
    } catch (error) {
      toast.show(toUserMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (editing)
    return (
      <li className="flex flex-col gap-3 py-4">
        <label htmlFor={`name-${category.id}`} className="text-sm font-medium">
          Nombre
        </label>
        <TextInput
          id={`name-${category.id}`}
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <IconChooser value={icon} onChange={setIcon} />
        <ColorChooser value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={busy}
            disabled={!name.trim()}
            onClick={() =>
              run(() => updateCategory(category.id, { name, icon, color }), 'Categoría actualizada')
            }
          >
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </li>
    )

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={category.archivedAt ? 'opacity-50' : ''}>
        <CategoryBadge icon={category.icon} color={category.color} />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-medium">
        <span className={category.archivedAt ? 'text-fg-muted' : ''}>{category.name}</span>
        {category.archivedAt && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
            Archivada
          </span>
        )}
      </span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Editar ${category.name}`}
        onClick={() => setEditing(true)}
        icon={<PencilSimpleIcon aria-hidden="true" className="size-4" />}
      />
      {category.archivedAt ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Restaurar ${category.name}`}
          disabled={busy}
          onClick={() =>
            run(() => updateCategory(category.id, { archived: false }), 'Categoría restaurada')
          }
          icon={<ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" />}
        />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Archivar ${category.name}`}
          disabled={busy}
          onClick={() =>
            run(() => updateCategory(category.id, { archived: true }), 'Categoría archivada')
          }
          icon={<ArchiveIcon aria-hidden="true" className="size-4" />}
        />
      )}
      {inUse ? (
        // Mismo ancho que el botón, para que las columnas de acciones queden alineadas.
        <span aria-hidden="true" className="size-11 shrink-0" />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Borrar ${category.name}`}
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          icon={<TrashIcon aria-hidden="true" className="size-4" />}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`¿Borrar ${category.name}?`}
        confirmLabel="Sí, borrar"
        loading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(() => deleteCategory(category.id), 'Categoría borrada').finally(() =>
            setConfirmDelete(false),
          )
        }
      >
        No tiene movimientos, así que desaparece del todo. Si la usa un gasto recurrente, no se
        podrá borrar: archívala.
      </ConfirmDialog>
    </li>
  )
}

/** Categorías personalizadas (spec §13, P1). Las que tienen movimientos se archivan, no se borran. */
export function CategoriesPage() {
  const data = useHousehold()
  const toast = useToast()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('tag')
  const [color, setColor] = useState<CategoryColorId | null>(null)
  const [busy, setBusy] = useState(false)
  const list = data.categories.filter((category) => category.kind === kind)

  const add = async () => {
    setBusy(true)
    try {
      await createCategory(data.household.id, kind, name, icon, color)
      invalidateData()
      setName('')
      toast.show('Categoría creada')
    } catch (error) {
      toast.show(toUserMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Categorías"
        back="/ajustes"
        description="Las que ya tienen movimientos no se pueden borrar: archívalas para ocultarlas."
      />
      <div className="flex flex-col gap-6">
        <Segmented<CategoryKind>
          label="Tipo"
          hideLabel
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'De gasto' },
            { value: 'income', label: 'De ingreso' },
          ]}
        />
        <ul className="divide-y divide-line">
          {list.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) void add()
          }}
          className="flex flex-col gap-4 rounded-2xl bg-surface p-4"
        >
          <h2 className="font-semibold">
            Nueva categoría {kind === 'expense' ? 'de gasto' : 'de ingreso'}
          </h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-category" className="text-sm font-medium">
              Nombre
            </label>
            <TextInput
              id="new-category"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <IconChooser value={icon} onChange={setIcon} />
          <ColorChooser value={color} onChange={setColor} />
          <Button type="submit" className="self-start" loading={busy} disabled={!name.trim()}>
            Crear categoría
          </Button>
        </form>
      </div>
    </Page>
  )
}
