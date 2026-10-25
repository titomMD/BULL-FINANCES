import { FilePdfIcon } from '@phosphor-icons/react'
import { useStoredFile } from '../../hooks/useStoredFile'

/** Muestra una imagen guardada o un enlace para abrir el PDF. */
export function StoredFile({
  path,
  name,
  alt,
  className = '',
}: {
  path: string
  name?: string | null
  alt: string
  className?: string
}) {
  const file = useStoredFile(path)
  if (file.loading) return <p className="text-sm text-fg-muted">Cargando archivo…</p>
  if (file.failed || !file.url)
    return <p className="text-sm text-fg-muted">No pudimos abrir el archivo.</p>
  if (file.type.startsWith('image/'))
    return <img src={file.url} alt={alt} className={`rounded-xl ${className}`} />
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-2 font-medium underline hover:text-primary"
    >
      <FilePdfIcon aria-hidden="true" className="size-5" />
      Abrir {name || 'archivo'}
    </a>
  )
}
