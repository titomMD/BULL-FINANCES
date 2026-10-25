import jovenImage from '../assets/cards/joven.webp'
import lifemilesImage from '../assets/cards/lifemiles.webp'
import negociosImage from '../assets/cards/negocios.webp'

// Imágenes de tus tarjetas (las que subiste tú). Se eligen por el nombre de la tarjeta.
const PRESETS: Array<{ test: RegExp; src: string }> = [
  { test: /empresa|negocio|business/i, src: negociosImage },
  { test: /j[óo]ven|joven/i, src: jovenImage },
  { test: /lifemiles|avianca|visa/i, src: lifemilesImage },
]

export const cardImageFor = (name: string): string | null =>
  PRESETS.find((preset) => preset.test.test(name))?.src ?? null
