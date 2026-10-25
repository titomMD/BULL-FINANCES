import { forwardRef, type InputHTMLAttributes } from 'react'
import { formatMoneyInput } from '../../lib/money'
import { controlClasses } from '../ui/Field'

interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'size'
> {
  value: string
  onChange: (value: string) => void
  size?: 'md' | 'lg'
}

/** Monto en pesos: teclado numérico, puntos de miles mientras se escribe, sin decimales. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, size = 'md', className = '', ...props },
  ref,
) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-fg-muted ${
          size === 'lg' ? 'text-2xl' : ''
        }`}
      >
        $
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(formatMoneyInput(event.target.value))}
        className={`${controlClasses} tabular font-semibold ${
          size === 'lg' ? 'h-16 pl-9 text-3xl tracking-tight' : 'h-12 pl-8'
        } ${className}`}
        {...props}
      />
    </div>
  )
})
