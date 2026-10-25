import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Fila que se desliza en horizontal: funde el borde por donde queda contenido, para que se note
 * que hay más chips (la máscara solo usa transparencia, no colores).
 */
export function ScrollFade({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const start = element.scrollLeft > 4
      const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 4
      setEdges((current) =>
        current.start === start && current.end === end ? current : { start, end },
      )
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  const mask = [
    edges.start ? 'transparent, black 2.5rem' : 'black',
    edges.end ? 'black calc(100% - 2.5rem), transparent' : 'black',
  ].join(', ')

  return (
    <div
      ref={ref}
      className={`[scrollbar-width:none] overflow-x-auto ${className}`}
      style={{ maskImage: `linear-gradient(to right, ${mask})` }}
    >
      {children}
    </div>
  )
}
