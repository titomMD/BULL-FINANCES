// Apariencia (Ajustes → Apariencia): todo lo que cada cuenta puede personalizar.
// Los valores visuales viven en src/styles/tokens.css; aquí solo están los ids, nombres y cómo
// aplicarlos como atributos de <html>. Los ids deben coincidir con los check de profiles en la
// base de datos (migraciones 20261012114038 y 20261012162710).

export const themes = [
  { id: 'bullmilton', name: 'Bullmilton', detail: 'Azul noche y amarillo. El original.' },
  { id: 'grafito', name: 'Grafito', detail: 'Gris neutro con naranja.' },
  { id: 'oceano', name: 'Océano', detail: 'Azul profundo con celeste.' },
  { id: 'vino', name: 'Vino', detail: 'Borgoña con durazno.' },
  { id: 'papel', name: 'Papel', detail: 'Crema cálido con ámbar.' },
  { id: 'salvia', name: 'Salvia', detail: 'Verde grisáceo con azul.' },
] as const

export const modes = [
  { id: 'dark', name: 'Oscuro' },
  { id: 'light', name: 'Claro' },
  { id: 'system', name: 'Automático' },
] as const

/** El acento cambia solo el color de acción; verde y rojo del dinero no cambian nunca. */
export const accents = [
  { id: 'theme', name: 'El del tema' },
  { id: 'amarillo', name: 'Amarillo' },
  { id: 'naranja', name: 'Naranja' },
  { id: 'coral', name: 'Coral' },
  { id: 'violeta', name: 'Violeta' },
  { id: 'azul', name: 'Azul' },
  { id: 'menta', name: 'Menta' },
  { id: 'rosa', name: 'Rosa' },
] as const

export const fonts = [
  { id: 'system', name: 'Del sistema', detail: 'La de tu teléfono o computador.' },
  { id: 'geist', name: 'Geist', detail: 'Moderna y precisa.' },
  { id: 'manrope', name: 'Manrope', detail: 'Redondeada y cercana.' },
  { id: 'plex', name: 'IBM Plex Sans', detail: 'Técnica, con carácter.' },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', detail: 'Pensada para leer sin esfuerzo.' },
] as const

export const densities = [
  { id: 'comoda', name: 'Cómoda' },
  { id: 'compacta', name: 'Compacta' },
] as const

export const textSizes = [
  { id: 'normal', name: 'Normal' },
  { id: 'grande', name: 'Grande' },
  { id: 'muy_grande', name: 'Muy grande' },
] as const

export const cornerStyles = [
  { id: 'redondeadas', name: 'Redondeadas' },
  { id: 'suaves', name: 'Suaves' },
  { id: 'rectas', name: 'Rectas' },
] as const

export const motions = [
  { id: 'sistema', name: 'Como el sistema' },
  { id: 'reducido', name: 'Siempre reducido' },
] as const

/**
 * Colores de persona (sin verde ni rojo: esos son del dinero). Únicos dentro del hogar; los
 * cuatro se distinguen entre sí (lo comprueba src/styles/tokens.test.ts).
 */
export const personColors = [
  { id: 'azul', name: 'Azul' },
  { id: 'ambar', name: 'Ámbar' },
  { id: 'rosa', name: 'Rosa' },
  { id: 'cian', name: 'Cian' },
] as const

/** Colores de categoría (paleta curada; null = neutro). */
export const categoryColors = [
  { id: 'ambar', name: 'Ámbar' },
  { id: 'naranja', name: 'Naranja' },
  { id: 'coral', name: 'Coral' },
  { id: 'rosa', name: 'Rosa' },
  { id: 'violeta', name: 'Violeta' },
  { id: 'azul', name: 'Azul' },
  { id: 'cian', name: 'Cian' },
  { id: 'menta', name: 'Menta' },
] as const

export type ThemeId = (typeof themes)[number]['id']
export type ModeId = (typeof modes)[number]['id']
export type AccentId = (typeof accents)[number]['id']
export type FontId = (typeof fonts)[number]['id']
export type DensityId = (typeof densities)[number]['id']
export type TextSizeId = (typeof textSizes)[number]['id']
export type CornersId = (typeof cornerStyles)[number]['id']
export type MotionId = (typeof motions)[number]['id']
export type PersonColorId = (typeof personColors)[number]['id']
export type CategoryColorId = (typeof categoryColors)[number]['id']

export interface Appearance {
  theme: ThemeId
  mode: ModeId
  accent: AccentId
  font: FontId
  density: DensityId
  textSize: TextSizeId
  corners: CornersId
  motion: MotionId
  privateMode: boolean
}

export const defaultAppearance: Appearance = {
  theme: 'bullmilton',
  mode: 'dark',
  accent: 'theme',
  font: 'system',
  density: 'comoda',
  textSize: 'normal',
  corners: 'redondeadas',
  motion: 'sistema',
  privateMode: false,
}

const STORAGE_KEY = 'bullmilton.appearance'

const pick = <T extends string>(options: ReadonlyArray<{ id: T }>, value: unknown, fallback: T) =>
  options.some((option) => option.id === value) ? (value as T) : fallback

export const isPersonColor = (value: unknown): value is PersonColorId =>
  personColors.some((color) => color.id === value)
export const isCategoryColor = (value: unknown): value is CategoryColorId =>
  categoryColors.some((color) => color.id === value)

/** Normaliza lo que venga de la base de datos o del navegador (valores desconocidos → defecto). */
export function toAppearance(value: Partial<Record<keyof Appearance, unknown>> | null): Appearance {
  const d = defaultAppearance
  const theme = pick(themes, value?.theme, d.theme)
  // Antes del modo, Papel y Salvia solo existían en claro.
  const legacyMode = theme === 'papel' || theme === 'salvia' ? 'light' : d.mode
  return {
    theme,
    mode: pick(modes, value?.mode, legacyMode),
    accent: pick(accents, value?.accent, d.accent),
    font: pick(fonts, value?.font, d.font),
    density: pick(densities, value?.density, d.density),
    textSize: pick(textSizes, value?.textSize, d.textSize),
    corners: pick(cornerStyles, value?.corners, d.corners),
    motion: pick(motions, value?.motion, d.motion),
    privateMode: value?.privateMode === true,
  }
}

const darkQuery = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Modo efectivo: "Automático" sigue al sistema. */
export function resolveMode(mode: ModeId): 'dark' | 'light' {
  if (mode !== 'system') return mode
  return (darkQuery()?.matches ?? true) ? 'dark' : 'light'
}

/** Atributos de <html> (o de una vista previa) para una apariencia. */
export function appearanceAttributes(appearance: Appearance): Record<string, string | undefined> {
  return {
    'data-theme': appearance.theme,
    'data-mode': resolveMode(appearance.mode),
    'data-accent': appearance.accent === 'theme' ? undefined : appearance.accent,
    'data-font': appearance.font,
    'data-density': appearance.density,
    'data-text': appearance.textSize,
    'data-corners': appearance.corners,
    'data-motion': appearance.motion,
    'data-private': appearance.privateMode ? '' : undefined,
  }
}

let current: Appearance = defaultAppearance
let followingSystem = false

/** Aplica la apariencia al documento y la recuerda en este navegador. */
export function applyAppearance(appearance: Appearance) {
  current = appearance
  const root = document.documentElement
  for (const [name, value] of Object.entries(appearanceAttributes(appearance))) {
    if (value === undefined) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }

  // Barra del navegador (y de la app instalada) con el fondo del tema.
  const canvas = getComputedStyle(root).getPropertyValue('--color-canvas').trim()
  if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas)

  // "Automático": volver a aplicar cuando el sistema cambie de claro a oscuro.
  if (!followingSystem) {
    darkQuery()?.addEventListener('change', () => {
      if (current.mode === 'system') applyAppearance(current)
    })
    followingSystem = true
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    // Sin almacenamiento (modo privado): se aplica igual, solo no se recuerda en este navegador.
  }
}

/** Lo último usado en este navegador, para pintar el tema correcto antes de cargar la cuenta. */
export function cachedAppearance(): Appearance {
  try {
    return toAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return defaultAppearance
  }
}

export function currentAppearance(): Appearance {
  return current
}
