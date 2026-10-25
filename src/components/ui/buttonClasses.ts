export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-[background-color,color,scale,box-shadow] duration-150 ease-(--ease-out-expo) active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-45'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-soft',
  secondary: 'bg-surface-2 text-fg hover:bg-line-strong',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-negative-bg text-negative hover:bg-surface-2',
}

const sizes: Record<Size, string> = {
  sm: 'h-11 px-3.5 text-sm',
  md: 'h-12 px-4 text-[0.9375rem]',
  lg: 'h-14 px-5 text-base',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}
