import { describe, expect, it } from 'vitest'
import type { Expense, Member } from '../types/domain'
import { buildExport, toCsv } from './export'

describe('toCsv', () => {
  it('usa ; como separador, CRLF y BOM UTF-8', () => {
    expect(toCsv(['a', 'b'], [[1, 'dos']])).toBe('﻿a;b\r\n1;dos\r\n')
  })

  it('escapa comillas, separadores y saltos de línea', () => {
    const csv = toCsv(['nota'], [['dijo "hola"; luego\nse fue']])
    expect(csv).toContain('"dijo ""hola""; luego\nse fue"')
  })

  it('neutraliza fórmulas de hoja de cálculo', () => {
    const csv = toCsv(['x'], [['=HYPERLINK("http://malo")'], ['+57'], ['@sum'], ['-1']])
    expect(csv).toContain(`"'=HYPERLINK(""http://malo"")"`)
    expect(csv).toContain(`'+57`)
    expect(csv).toContain(`'@sum`)
    expect(csv).toContain(`'-1`)
  })

  it('los números se exportan tal cual (enteros, sin formato)', () => {
    expect(toCsv(['monto'], [[1000000]])).toContain('\r\n1000000\r\n')
  })
})

describe('buildExport', () => {
  const members: Member[] = [
    {
      userId: 'a',
      displayName: 'Ana',
      role: 'owner',
      joinedAt: '',
      active: true,
      personColor: null,
    },
    {
      userId: 'b',
      displayName: 'Beto',
      role: 'member',
      joinedAt: '',
      active: true,
      personColor: null,
    },
  ]
  const expense: Expense = {
    kind: 'expense',
    id: 'e1',
    description: 'Arriendo',
    amount: 1_000_000,
    currency: 'COP',
    date: '2026-10-01',
    categoryId: 'c1',
    paidBy: 'a',
    splitType: 'equal',
    splits: [
      { userId: 'a', shareBp: 5000, amount: 500_000 },
      { userId: 'b', shareBp: 5000, amount: 500_000 },
    ],
    notes: null,
    status: 'active',
    extraCategoryIds: [],
    paidWithCard: false,
    recurringExpenseId: null,
    createdBy: 'a',
    createdAt: '2026-10-01T12:00:00Z',
    updatedBy: 'a',
    updatedAt: '2026-10-01T12:00:00Z',
  }

  const result = buildExport({
    householdName: 'Casa',
    members,
    categories: [
      { id: 'c1', kind: 'expense', name: 'Vivienda', icon: 'home', color: null, archivedAt: null },
    ],
    movements: [expense],
    recurring: [],
    exportedAt: '2026-10-12T00:00:00Z',
  })

  it('genera los CSV de la spec y el de pagos de tarjeta', () => {
    expect(Object.keys(result.csv).sort()).toEqual([
      'categorias.csv',
      'gastos.csv',
      'ingresos.csv',
      'pagos_tarjeta.csv',
      'recurrentes.csv',
      'transferencias.csv',
    ])
  })

  it('el CSV de gastos incluye la parte de cada persona con nombres legibles', () => {
    const [header, row] = result.csv['gastos.csv'].replace('﻿', '').split('\r\n')
    expect(header).toContain('parte_Ana;parte_Beto')
    expect(row).toBe(
      'e1;2026-10-01;Arriendo;Vivienda;1000000;COP;Ana;no;iguales;500000;500000;activo;;2026-10-01T12:00:00Z',
    )
  })

  it('el JSON es un respaldo completo y legible', () => {
    const parsed = JSON.parse(result.json)
    expect(parsed.app).toBe('BULLMILTON')
    expect(parsed.expenses).toHaveLength(1)
    expect(parsed.expenses[0].splits).toHaveLength(2)
  })
})
