import { CreditCardIcon } from '@phosphor-icons/react'
import type { UseFormRegisterReturn } from 'react-hook-form'

/** "Pagado con tarjeta": casilla grande, marcable con un toque. */
export function CardCheckbox({ registration }: { registration: UseFormRegisterReturn }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-(--color-primary)"
        {...registration}
      />
      <CreditCardIcon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
      <span className="flex flex-col py-2 leading-tight">
        <span className="font-medium">Pagado con tarjeta</span>
        <span className="text-sm text-fg-muted">Se resta del saldo cuando paguen la tarjeta</span>
      </span>
    </label>
  )
}
