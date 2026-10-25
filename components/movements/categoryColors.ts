import type { CategoryColorId } from '../../lib/appearance'

// Clases completas por color de categoría (Tailwind solo genera las que aparecen tal cual).
// El círculo es la muestra al 18 % sobre el panel y el icono la muestra entera: contraste ≥ 3:1
// comprobado en src/styles/tokens.test.ts.

export const categoryTint: Record<CategoryColorId, string> = {
  ambar: 'bg-swatch-ambar/18 text-swatch-ambar',
  naranja: 'bg-swatch-naranja/18 text-swatch-naranja',
  coral: 'bg-swatch-coral/18 text-swatch-coral',
  rosa: 'bg-swatch-rosa/18 text-swatch-rosa',
  violeta: 'bg-swatch-violeta/18 text-swatch-violeta',
  azul: 'bg-swatch-azul/18 text-swatch-azul',
  cian: 'bg-swatch-cian/18 text-swatch-cian',
  menta: 'bg-swatch-menta/18 text-swatch-menta',
}

export const categorySolid: Record<CategoryColorId, string> = {
  ambar: 'bg-swatch-ambar',
  naranja: 'bg-swatch-naranja',
  coral: 'bg-swatch-coral',
  rosa: 'bg-swatch-rosa',
  violeta: 'bg-swatch-violeta',
  azul: 'bg-swatch-azul',
  cian: 'bg-swatch-cian',
  menta: 'bg-swatch-menta',
}
