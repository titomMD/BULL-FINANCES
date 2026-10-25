import { ArrowsLeftRightIcon, TagIcon } from '@phosphor-icons/react'
import type { CategoryColorId } from '../../lib/appearance'
import { categoryTint } from './categoryColors'
import { categoryIcons } from './categoryIcons'

export function CategoryIcon({
  icon,
  className = 'size-5',
}: {
  icon: string | null | undefined
  className?: string
}) {
  const Icon = (icon && categoryIcons[icon]) || TagIcon
  return <Icon aria-hidden="true" className={className} />
}

export function TransferIcon({ className = 'size-5' }: { className?: string }) {
  return <ArrowsLeftRightIcon aria-hidden="true" className={className} />
}

/** Círculo de la categoría: neutro, o teñido con su color si lo tiene. */
export function CategoryBadge({
  icon,
  color,
  className = 'size-10',
}: {
  icon: string | null | undefined
  color: CategoryColorId | null | undefined
  className?: string
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${
        color ? categoryTint[color] : 'bg-surface-2 text-fg'
      } ${className}`}
    >
      <CategoryIcon icon={icon} />
    </span>
  )
}
