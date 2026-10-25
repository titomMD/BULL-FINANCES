import { formatCompactMoney } from '../../lib/money'

// Estilos compartidos de los ejes de Recharts (colores siempre desde tokens).

export const axisTick = { fill: 'var(--color-fg-muted)', fontSize: 12 }
export const gridStroke = 'var(--color-line)'

/** En modo privado los ejes no muestran cifras (las alturas solas no dicen montos exactos). */
export const amountsHidden = () => document.documentElement.hasAttribute('data-private')

export const yAxisProps = () => ({
  hide: amountsHidden(),
  tickFormatter: formatCompactMoney,
  tickLine: false,
  axisLine: false,
  width: 64,
  tick: axisTick,
})
