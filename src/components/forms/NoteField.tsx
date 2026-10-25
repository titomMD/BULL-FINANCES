import { useState } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Field, TextArea } from '../ui/Field'

/** Nota opcional plegada tras "+ Añadir nota"; abierta si ya hay texto o un error. */
export function NoteField({
  registration,
  hasValue,
  error,
}: {
  registration: UseFormRegisterReturn
  hasValue: boolean
  error?: string
}) {
  const [open, setOpen] = useState(hasValue || Boolean(error))
  if (!open && !error)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <PlusIcon aria-hidden="true" className="size-4" weight="bold" />
        Añadir nota
      </button>
    )
  return (
    <Field label="Nota (opcional)" error={error}>
      {({ id, describedBy, invalid }) => (
        <TextArea
          id={id}
          autoFocus={!hasValue}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          maxLength={500}
          {...registration}
        />
      )}
    </Field>
  )
}
