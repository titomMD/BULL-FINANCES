// Exportación a Excel (.xlsx). La parte que arma las hojas es pura (se prueba con vitest); la
// descarga carga la librería solo cuando se pide (un trozo aparte, no pesa en la pantalla de inicio).

import type {
  Category,
  DebtAccount,
  DebtCardExpense,
  DebtPayment,
  DebtStatement,
  PersonalMovement,
  PlanEntry,
  PlanItem,
} from '../types/domain'
import { planSummary } from './calculations/plan'
import type { Cell, Table } from './export'

export interface SheetModel {
  name: string
  rows: Cell[][]
  /** Filas (desde 0) que van en negrita. */
  boldRows: number[]
  /** Columnas (desde 0) con dinero: se muestran con separador de miles. */
  moneyColumns: number[]
}

const KIND_LABEL: Record<PlanItem['kind'], string> = {
  income: 'ingreso',
  expense: 'gasto fijo',
  saving: 'ahorro',
}

const isMoneyHeader = (header: string) => /^(monto|parte_)/.test(header)

function fromTable(name: string, { headers, rows }: Table): SheetModel {
  return {
    name,
    rows: [headers, ...rows],
    boldRows: [0],
    moneyColumns: headers.flatMap((header, index) => (isMoneyHeader(header) ? [index] : [])),
  }
}

/** Resumen de un mes del plan, en el orden en que se lee en la app. */
function planMonthSheet(items: PlanItem[], month: string): SheetModel {
  const summary = planSummary(items, month)
  const rows: Cell[][] = []
  const boldRows: number[] = []
  const heading = (text: string, total?: number) => {
    boldRows.push(rows.length)
    rows.push([text, total ?? null])
  }

  heading(`Plan de ${month}`)
  rows.push([])
  heading('INGRESOS', summary.totalIncome)
  for (const item of summary.incomes) rows.push([item.name, item.amount])
  rows.push([])
  heading('GASTOS FIJOS', summary.totalExpenses)
  for (const group of summary.expenseGroups) {
    if (group.name === null) {
      rows.push([group.items[0].name, group.items[0].amount])
      continue
    }
    rows.push([`${group.name} (total)`, group.total])
    for (const item of group.items) rows.push([`   ${item.name}`, item.amount])
  }
  rows.push([])
  heading('AHORRO', summary.totalSavings)
  for (const item of summary.savings) rows.push([item.name, item.amount])
  rows.push([])
  heading('DINERO MÍO (lo que sobra)', summary.free)

  return { name: 'Plan del mes', rows, boldRows, moneyColumns: [1] }
}

export interface XlsxInput {
  /** Tablas del hogar (las mismas del CSV): gastos, ingresos, transferencias, etc. */
  tables: Record<string, Table>
  plan: PlanItem[]
  personal: PersonalMovement[]
  categories: Category[]
  /** Mes del resumen del plan, 'YYYY-MM'. */
  month: string
  /** Tanqueadas y otros gastos registrados en el plan. */
  entries?: PlanEntry[]
  accounts?: DebtAccount[]
  statements?: DebtStatement[]
  payments?: DebtPayment[]
  cardExpenses?: DebtCardExpense[]
}

export function buildXlsxSheets(input: XlsxInput): SheetModel[] {
  const categoryName = (id: string | null) =>
    input.categories.find((category) => category.id === id)?.name ?? ''

  const planLines: Table = {
    headers: ['tipo', 'nombre', 'grupo', 'monto', 'desde', 'hasta'],
    rows: input.plan.map((item) => [
      KIND_LABEL[item.kind],
      item.name,
      item.groupName ?? '',
      item.amount,
      item.startsOn ?? '',
      item.endsOn ?? '',
    ]),
  }

  const personal: Table = {
    headers: ['fecha', 'tipo', 'descripcion', 'categoria', 'monto', 'moneda', 'estado', 'nota'],
    rows: input.personal.map((movement) => [
      movement.date,
      movement.kind === 'income' ? 'ingreso' : 'gasto',
      movement.description,
      categoryName(movement.categoryId),
      movement.amount,
      movement.currency,
      movement.status === 'active' ? 'activo' : 'anulado',
      movement.notes,
    ]),
  }

  const itemName = (id: string) => input.plan.find((item) => item.id === id)?.name ?? ''
  const accountName = (id: string) => input.accounts?.find((a) => a.id === id)?.name ?? ''

  const entries: Table = {
    headers: ['fecha', 'linea', 'monto', 'nota'],
    rows: (input.entries ?? []).map((e) => [e.date, itemName(e.planItemId), e.amount, e.note]),
  }
  const statements: Table = {
    headers: [
      'tarjeta',
      'corte',
      'limite_pago',
      'mes_de_pago',
      'total',
      'minimo',
      'pagado',
      'dolares_total_usd',
      'dolares_minimo_usd',
      'dolares_pagado_usd',
      'cuota_manejo',
      'tasa_mensual_pct',
      'nota',
    ],
    rows: (input.statements ?? []).map((s) => [
      accountName(s.accountId),
      s.statementDate,
      s.dueDate ?? '',
      s.payMonth,
      s.totalDue,
      s.minimumDue,
      s.paidAmount,
      s.usdTotalDue / 100,
      s.usdMinimumDue / 100,
      s.usdPaid / 100,
      s.feeAmount ?? '',
      s.monthlyRatePpm ? s.monthlyRatePpm / 10000 : '',
      s.notes,
    ]),
  }
  const money = (currency: string, amount: number) => (currency === 'USD' ? amount / 100 : amount)
  const payments: Table = {
    headers: ['fecha', 'tarjeta', 'tipo', 'moneda', 'monto', 'tasa_cop_por_usd'],
    rows: (input.payments ?? []).map((p) => [
      p.paidOn,
      accountName(p.accountId),
      p.kind === 'minimum' ? 'minimo' : p.kind === 'full' ? 'total' : 'abono',
      p.currency,
      money(p.currency, p.amount),
      p.fxRateCents ? p.fxRateCents / 100 : '',
    ]),
  }
  const cardExpenses: Table = {
    headers: ['fecha', 'tarjeta', 'detalle', 'moneda', 'monto'],
    rows: (input.cardExpenses ?? []).map((e) => [
      e.expenseDate,
      accountName(e.accountId),
      e.description,
      e.currency,
      money(e.currency, e.amount),
    ]),
  }
  const statementLines: Table = {
    headers: ['tarjeta', 'corte', 'fecha', 'detalle', 'valor'],
    rows: (input.statements ?? []).flatMap((s) =>
      s.lines.map((line) => [
        accountName(s.accountId),
        s.statementDate,
        line.date,
        line.detail,
        line.amount,
      ]),
    ),
  }

  const household = (filename: string, name: string) =>
    input.tables[filename] ? [fromTable(name, input.tables[filename])] : []

  return [
    planMonthSheet(input.plan, input.month),
    fromTable('Plan (líneas)', planLines),
    ...(input.entries?.length ? [fromTable('Tanqueadas', entries)] : []),
    ...(input.statements?.length
      ? [
          fromTable('Extractos de tarjetas', statements),
          fromTable('Movimientos de extractos', statementLines),
        ]
      : []),
    ...(input.payments?.length ? [fromTable('Pagos de tarjetas', payments)] : []),
    ...(input.cardExpenses?.length ? [fromTable('Gastos con tarjeta', cardExpenses)] : []),
    fromTable('Dinero personal', personal),
    ...household('gastos.csv', 'Gastos del hogar'),
    ...household('ingresos.csv', 'Ingresos del hogar'),
    ...household('transferencias.csv', 'Transferencias'),
    ...household('pagos_tarjeta.csv', 'Pagos de tarjeta'),
    ...household('recurrentes.csv', 'Recurrentes'),
    ...household('categorias.csv', 'Categorías'),
  ]
}

const MIN_WIDTH = 10
const MAX_WIDTH = 48

function columnWidths(rows: Cell[][]): { width: number }[] {
  const widths: number[] = []
  for (const row of rows)
    row.forEach((cell, index) => {
      const length = cell === null || cell === undefined ? 0 : String(cell).length
      widths[index] = Math.max(widths[index] ?? 0, length)
    })
  return widths.map((width) => ({ width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + 2)) }))
}

/** Arma el .xlsx y lo descarga. La librería se carga aquí, al pulsar el botón. */
export async function downloadXlsx(filename: string, sheets: SheetModel[]): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const book = sheets.map((sheet) => ({
    sheet: sheet.name,
    columns: columnWidths(sheet.rows),
    stickyRowsCount: sheet.boldRows[0] === 0 ? 1 : 0,
    data: sheet.rows.map((row, rowIndex) =>
      row.map((cell, columnIndex) => {
        if (cell === null || cell === undefined || cell === '') return null
        const bold = sheet.boldRows.includes(rowIndex)
        if (typeof cell === 'number')
          return {
            value: cell,
            ...(sheet.moneyColumns.includes(columnIndex) ? { format: '#,##0' } : {}),
            ...(bold ? { fontWeight: 'bold' as const } : {}),
          }
        // Los textos van como texto: Excel no los interpreta como fórmula aunque empiecen por "=".
        return {
          value: String(cell),
          type: String,
          ...(bold ? { fontWeight: 'bold' as const } : {}),
        }
      }),
    ),
  }))
  const blob = await writeExcelFile(book).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
