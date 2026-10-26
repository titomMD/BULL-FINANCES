import { describe, expect, it } from 'vitest'
import type { PersonalMovement, PlanItem } from '../types/domain'
import { buildXlsxSheets } from './exportXlsx'

const item = (
  over: Partial<PlanItem> & Pick<PlanItem, 'id' | 'kind' | 'name' | 'amount'>,
): PlanItem => ({
  groupName: null,
  currency: 'COP',
  startsOn: null,
  endsOn: null,
  sortOrder: 0,
  tracked: false,
  dueDay: null,
  remindDays: 3,
  ...over,
})

const plan = [
  item({ id: '1', kind: 'income', name: 'Mesada', amount: 3_000_000 }),
  item({ id: '2', kind: 'expense', name: 'Gimnasio', amount: 120_000 }),
  item({ id: '3', kind: 'expense', name: 'Google', amount: 31_000, groupName: 'Tarjeta' }),
  item({ id: '4', kind: 'saving', name: 'Ahorro', amount: 1_000_000 }),
]

const personal: PersonalMovement[] = [
  {
    id: 'p1',
    kind: 'expense',
    description: '=HYPERLINK("http://malo")',
    amount: 30_000,
    currency: 'COP',
    date: '2026-10-20',
    categoryId: null,
    notes: null,
    status: 'active',
    planMonth: null,
    createdBy: null,
    createdAt: '',
    updatedBy: null,
    updatedAt: '',
  },
]

describe('buildXlsxSheets', () => {
  const sheets = buildXlsxSheets({
    tables: { 'gastos.csv': { headers: ['id', 'monto'], rows: [['a', 5000]] } },
    plan,
    personal,
    categories: [],
    month: '2026-10',
  })

  it('crea las hojas en orden: plan, líneas, personal y hogar', () => {
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      'Plan del mes',
      'Plan (líneas)',
      'Dinero personal',
      'Gastos del hogar',
    ])
  })

  it('el resumen del plan trae los totales y Dinero mío', () => {
    const rows = sheets[0].rows
    expect(rows).toContainEqual(['INGRESOS', 3_000_000])
    expect(rows).toContainEqual(['GASTOS FIJOS', 151_000])
    expect(rows).toContainEqual(['Tarjeta (total)', 31_000])
    expect(rows).toContainEqual(['AHORRO', 1_000_000])
    expect(rows.at(-1)).toEqual(['DINERO MÍO (lo que sobra)', 1_849_000])
  })

  it('los montos quedan como números enteros, no como texto', () => {
    expect(sheets[3].rows[1]).toEqual(['a', 5000])
    expect(sheets[3].moneyColumns).toEqual([1])
  })

  it('un texto que parece fórmula se conserva tal cual (se escribe como texto)', () => {
    expect(sheets[2].rows[1][2]).toBe('=HYPERLINK("http://malo")')
  })
})
