import freya from '../assets/brand/freya.svg'

// Logo: la cara de Freya, la gata del autor (src/assets/brand/freya.svg). Sus colores son los
// de la foto (pelaje, nariz, ojos), se ven bien sobre fondo oscuro y claro, así que no hay
// variantes por tema.

const sizes = {
  sm: { mark: 'size-9', text: 'text-lg' },
  lg: { mark: 'size-20', text: 'text-2xl' },
} as const

export function Brand({ size = 'sm' }: { size?: keyof typeof sizes }) {
  const classes = sizes[size]
  return (
    <span className={`flex items-center gap-2.5 ${size === 'lg' ? 'flex-col items-start' : ''}`}>
      <img src={freya} alt="" className={classes.mark} />
      <span className={`font-bold tracking-tight ${classes.text}`}>Freyapp</span>
    </span>
  )
}
