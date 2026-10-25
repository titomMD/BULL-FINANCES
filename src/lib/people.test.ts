import { describe, expect, it } from 'vitest'
import { initialOf, resolvePersonColors } from './people'

describe('resolvePersonColors', () => {
  it('respeta el color elegido', () => {
    expect(
      resolvePersonColors([
        { userId: 'a', personColor: 'rosa' },
        { userId: 'b', personColor: 'cian' },
      ]),
    ).toEqual({ a: 'rosa', b: 'cian' })
  })

  it('sin elección, reparte la paleta en orden de llegada', () => {
    expect(
      resolvePersonColors([
        { userId: 'a', personColor: null },
        { userId: 'b', personColor: null },
      ]),
    ).toEqual({ a: 'azul', b: 'ambar' })
  })

  it('el automático nunca repite el color que eligió el otro', () => {
    const colors = resolvePersonColors([
      { userId: 'a', personColor: null },
      { userId: 'b', personColor: 'azul' },
    ])
    expect(colors.b).toBe('azul')
    expect(colors.a).not.toBe('azul')
  })
})

describe('initialOf', () => {
  it('toma la primera letra en mayúscula', () => {
    expect(initialOf('sebastián')).toBe('S')
    expect(initialOf('  Ángela')).toBe('Á')
    expect(initialOf('')).toBe('?')
  })
})
