import markOnDark from '../assets/brand/mark-dark.webp'
import markOnLight from '../assets/brand/mark-light.webp'

// Logo (opción B): toro de líneas con la gráfica al alza. El trazo azul marino del original se
// pierde sobre el fondo oscuro de la app, así que en modo oscuro va en Soft White; el dorado se
// mantiene en ambos. index.css muestra la variante que toca según data-mode.

const sizes = {
  sm: { mark: 'h-9', text: 'text-lg' },
  lg: { mark: 'h-20', text: 'text-xl' },
} as const

export function Brand({ size = 'sm' }: { size?: keyof typeof sizes }) {
  const classes = sizes[size]
  return (
    <span className={`flex items-center gap-2.5 ${size === 'lg' ? 'flex-col items-start' : ''}`}>
      <img src={markOnDark} alt="" className={`brand-on-dark w-auto ${classes.mark}`} />
      <img src={markOnLight} alt="" className={`brand-on-light w-auto ${classes.mark}`} />
      <span className={`font-bold tracking-wide ${classes.text}`}>BULLMILTON</span>
    </span>
  )
}
