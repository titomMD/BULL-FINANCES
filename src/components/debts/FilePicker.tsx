import { useId } from 'react'
import { PaperclipIcon } from '@phosphor-icons/react'

const MAX_BYTES = 10 * 1024 * 1024

/** Elegir un PDF o una foto (máx. 10 MB). `onError` recibe un mensaje humano. */
export function FilePicker({
  label,
  file,
  existingName,
  onChange,
  onError,
}: {
  label: string
  file: File | null
  existingName?: string | null
  onChange: (file: File | null) => void
  onError: (message: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
      >
        <PaperclipIcon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
        <span className="min-w-0 truncate py-2">
          {file ? file.name : existingName ? `Actual: ${existingName}` : 'Elegir PDF o foto'}
        </span>
        <input
          id={id}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null
            if (picked && picked.size > MAX_BYTES) {
              onError('El archivo pesa más de 10 MB. Prueba con uno más liviano.')
              event.target.value = ''
              return
            }
            onChange(picked)
          }}
        />
      </label>
    </div>
  )
}
