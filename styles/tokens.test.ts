/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { accents, categoryColors, personColors, themes } from '../lib/appearance'

// Contraste WCAG de todo el sistema de personalización, leído directamente de tokens.css (el
// único lugar con valores de color). Si alguien añade un tema o acento que no pasa AA, falla.

// Se lee del disco (no con ?raw): Vitest no procesa los .css y los devolvería vacíos.
const source = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const css = source.replace(/\/\*[\s\S]*?\*\//g, '')

type Vars = Record<string, string>

function parseVars(body: string): Vars {
  const vars: Vars = {}
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[match[1]] = match[2].trim()
  return vars
}

const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)![1]
const base = parseVars(themeBlock)
const rules = new Map<string, Vars>()
for (const match of css.replace(/@theme\s*\{[\s\S]*?\n\}/, '').matchAll(/([^{}]+)\{([^{}]*)\}/g))
  rules.set(match[1].trim().replace(/\s+/g, ' '), parseVars(match[2]))

// --- Color: sRGB ↔ OKLab -----------------------------------------------------------------
type RGBA = [number, number, number, number]

const hex = (value: string): RGBA => {
  const h = value.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as RGBA
}
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function toOklab([r, g, b]: RGBA): [number, number, number] {
  const [lr, lg, lb] = [r, g, b].map(toLinear)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function fromOklab([L, a, b]: [number, number, number]): RGBA {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, fromLinear(c))))
  return [rgb[0], rgb[1], rgb[2], 1]
}

/** Resuelve un valor de token: HEX, var(--x) o color-mix(in oklab, A p%, B). */
function resolve(value: string, vars: Vars, depth = 0): RGBA {
  if (depth > 10) throw new Error(`referencia circular: ${value}`)
  value = value.trim()
  if (value.startsWith('#')) return hex(value)
  if (value === 'transparent') return [0, 0, 0, 0]
  const variable = value.match(/^var\((--[\w-]+)\)$/)
  if (variable) return resolve(vars[variable[1]], vars, depth + 1)
  const mix = value.match(/^color-mix\(in oklab,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/)
  if (mix) {
    const a = resolve(mix[1], vars, depth + 1)
    const b = resolve(mix[3], vars, depth + 1)
    const t = Number(mix[2]) / 100
    if (b[3] === 0) return [a[0], a[1], a[2], t] // mezcla con transparente: solo baja la opacidad
    const [la, lb] = [toOklab(a), toOklab(b)]
    return fromOklab([0, 1, 2].map((i) => la[i] * t + lb[i] * (1 - t)) as [number, number, number])
  }
  throw new Error(`valor no soportado: ${value}`)
}

/** Color translúcido sobre un fondo opaco. */
const over = (top: RGBA, bottom: RGBA): RGBA => [
  top[0] * top[3] + bottom[0] * (1 - top[3]),
  top[1] * top[3] + bottom[1] * (1 - top[3]),
  top[2] * top[3] + bottom[2] * (1 - top[3]),
  1,
]
const luminance = ([r, g, b]: RGBA) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
function contrast(a: RGBA, b: RGBA) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** Distancia perceptual (OKLab × 100). */
function distance(a: RGBA, b: RGBA) {
  const [p, q] = [toOklab(a), toOklab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100
}

function palette(theme: string, mode: 'dark' | 'light', accent?: string): Vars {
  return {
    ...base,
    ...rules.get(`[data-mode='${mode}']`),
    ...rules.get(`[data-theme='${theme}'][data-mode='${mode}']`),
    ...(accent ? rules.get(`[data-accent='${accent}'][data-mode='${mode}']`) : {}),
  }
}

const modes = ['dark', 'light'] as const
const accentIds = accents.filter((accent) => accent.id !== 'theme').map((accent) => accent.id)

describe('tokens.css: cada tema existe en oscuro y en claro', () => {
  it.each(themes.flatMap((theme) => modes.map((mode) => [theme.id, mode] as const)))(
    '%s · %s está definido',
    (theme, mode) => {
      expect(rules.get(`[data-theme='${theme}'][data-mode='${mode}']`)).toBeDefined()
    },
  )

  it.each(accentIds.flatMap((accent) => modes.map((mode) => [accent, mode] as const)))(
    'acento %s · %s está definido',
    (accent, mode) => {
      expect(rules.get(`[data-accent='${accent}'][data-mode='${mode}']`)).toBeDefined()
    },
  )
})

describe('tokens.css: contraste AA de texto en cada tema × modo × acento', () => {
  const cases = themes.flatMap((theme) =>
    modes.flatMap((mode) =>
      [undefined, ...accentIds].map((accent) => [theme.id, mode, accent ?? 'propio'] as const),
    ),
  )

  it.each(cases)('%s · %s · acento %s', (theme, mode, accent) => {
    const vars = palette(theme, mode, accent === 'propio' ? undefined : accent)
    const c = (name: string) => resolve(vars[`--color-${name}`], vars)
    const canvas = c('canvas')
    const failures: string[] = []
    const check = (label: string, fg: RGBA, bg: RGBA, min = 4.5) => {
      const ratio = contrast(fg, over(bg, canvas))
      if (ratio < min) failures.push(`${label} ${ratio.toFixed(2)} < ${min}`)
    }
    for (const bg of ['canvas', 'surface', 'surface-2']) {
      check(`fg/${bg}`, c('fg'), c(bg))
      check(`fg-muted/${bg}`, c('fg-muted'), c(bg))
    }
    for (const bg of ['canvas', 'surface']) {
      check(`primary/${bg}`, c('primary'), c(bg))
      check(`positive/${bg}`, c('positive'), c(bg))
      check(`negative/${bg}`, c('negative'), c(bg))
    }
    check('on-primary/primary', c('on-primary'), c('primary'))
    check('on-primary/primary-soft', c('on-primary'), c('primary-soft'))
    check('positive/positive-bg', c('positive'), c('positive-bg'))
    check('negative/negative-bg', c('negative'), c('negative-bg'))
    check('fg-muted/primary-wash', c('fg-muted'), over(c('primary-wash'), canvas))
    check('canvas/fg (selección)', c('canvas'), c('fg'))
    // Hover de filas con texto rojo (surface-2 al 50 % sobre surface).
    check(
      'negative/hover',
      c('negative'),
      over([...c('surface-2').slice(0, 3), 0.5] as RGBA, c('surface')),
    )
    expect(failures).toEqual([])
  })
})

describe('tokens.css: muestras de persona y categoría', () => {
  const allThemes = themes.map((theme) => theme.id)

  it.each(modes)(
    'en modo %s los colores de persona y categoría se ven y llevan texto legible',
    (mode) => {
      const failures: string[] = []
      for (const theme of allThemes) {
        const vars = palette(theme, mode)
        const c = (name: string) => resolve(vars[`--color-${name}`], vars)
        const swatches = [
          ...categoryColors.map((color) => `swatch-${color.id}`),
          ...personColors.map((color) => `person-${color.id}`),
        ]
        for (const swatch of swatches) {
          const color = c(swatch)
          for (const bg of ['surface', 'surface-2', 'canvas']) {
            const ratio = contrast(color, c(bg))
            // Barras e iconos: no es texto, 3:1 (WCAG 1.4.11).
            if (ratio < 3) failures.push(`${theme}/${swatch} sobre ${bg} ${ratio.toFixed(2)}`)
          }
          // Icono de categoría sobre su círculo teñido (muestra al 18 % sobre surface).
          const tint = over([...color.slice(0, 3), 0.18] as RGBA, c('surface'))
          if (contrast(color, tint) < 3)
            failures.push(`${theme}/${swatch} icono ${contrast(color, tint).toFixed(2)}`)
          // Inicial del avatar sobre la muestra.
          const avatar = contrast(c('on-swatch'), color)
          if (avatar < 4.5) failures.push(`${theme}/${swatch} avatar ${avatar.toFixed(2)}`)
        }
      }
      expect(failures).toEqual([])
    },
  )

  it.each(modes)('en modo %s los colores de persona se distinguen entre sí', (mode) => {
    const vars = palette('bullmilton', mode)
    const ids = personColors.map((color) => color.id)
    const failures: string[] = []
    for (let i = 0; i < ids.length; i += 1)
      for (let j = i + 1; j < ids.length; j += 1) {
        const d = distance(
          resolve(vars[`--color-person-${ids[i]}`], vars),
          resolve(vars[`--color-person-${ids[j]}`], vars),
        )
        if (d < 15) failures.push(`${ids[i]}/${ids[j]} ΔE ${d.toFixed(1)}`)
      }
    expect(failures).toEqual([])
  })

  it.each(modes)(
    'en modo %s ninguna persona se confunde con el verde o el rojo del dinero',
    (mode) => {
      const failures: string[] = []
      for (const theme of themes.map((item) => item.id)) {
        const vars = palette(theme, mode)
        for (const person of personColors.map((color) => color.id)) {
          const color = resolve(vars[`--color-person-${person}`], vars)
          for (const semantic of ['positive', 'negative']) {
            const d = distance(color, resolve(vars[`--color-${semantic}`], vars))
            if (d < 10) failures.push(`${theme}/${person}~${semantic} ΔE ${d.toFixed(1)}`)
          }
        }
      }
      expect(failures).toEqual([])
    },
  )
})
