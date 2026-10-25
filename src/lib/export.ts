// Exportación y respaldo (spec §21): CSV y JSON con gastos, ingresos, transferencias, pagos de tarjeta,
// categorías y gastos recurrentes. Funciones puras; la descarga vive en downloadFile().

import type { Category, Member, Movement, RecurringExpense } from '../types/domain'

/** Excel en español (Colombia) usa ';' como separador de listas. */
export const CSV_DELIMITER = ';'

type Cell = string | number | boolean | null | undefined

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Evita inyección de fórmulas al abrir el CSV en una hoja de cálculo.
  let text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[";\n\r,]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(CSV_DELIMITER))
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export interface ExportInput {
  householdName: string
  members: Member[]
  categories: Category[]
  movements: Movement[]
  recurring: RecurringExpense[]
  exportedAt: string
}

export function buildExport(input: ExportInput) {
  const name = (userId: string) =>
    input.members.find((member) => member.userId === userId)?.displayName ?? userId
  const categoryName = (id: string | null) =>
    input.categories.find((category) => category.id === id)?.name ?? ''
  const people = input.members

  const expenses = input.movements.filter((movement) => movement.kind === 'expense')
  const incomes = input.movements.filter((movement) => movement.kind === 'income')
  const transfers = input.movements.filter((movement) => movement.kind === 'transfer')
  const cardPayments = input.movements.filter((movement) => movement.kind === 'card_payment')

  const csv: Record<string, string> = {
    'gastos.csv': toCsv(
      [
        'id',
        'fecha',
        'descripcion',
        'categorias',
        'monto',
        'moneda',
        'pago',
        'tarjeta',
        'division',
        ...people.map((person) => `parte_${person.displayName}`),
        'estado',
        'nota',
        'creado',
      ],
      expenses.map((expense) => [
        expense.id,
        expense.date,
        expense.description,
        // Varias categorías: la principal primero, separadas por " + ".
        [expense.categoryId, ...expense.extraCategoryIds].map(categoryName).join(' + '),
        expense.amount,
        expense.currency,
        name(expense.paidBy),
        expense.paidWithCard ? 'si' : 'no',
        expense.splitType === 'equal' ? 'iguales' : 'porcentaje',
        ...people.map(
          (person) => expense.splits.find((split) => split.userId === person.userId)?.amount ?? 0,
        ),
        expense.status === 'active' ? 'activo' : 'anulado',
        expense.notes,
        expense.createdAt,
      ]),
    ),
    'ingresos.csv': toCsv(
      [
        'id',
        'fecha',
        'fuente',
        'categoria',
        'monto',
        'moneda',
        'recibio',
        'division',
        ...people.map((person) => `parte_${person.displayName}`),
        'estado',
        'nota',
        'creado',
      ],
      incomes.map((income) => [
        income.id,
        income.date,
        income.source,
        categoryName(income.categoryId),
        income.amount,
        income.currency,
        name(income.userId),
        income.splits.length === 1
          ? 'una persona'
          : income.splitType === 'equal'
            ? 'iguales'
            : 'porcentaje',
        ...people.map(
          (person) => income.splits.find((split) => split.userId === person.userId)?.amount ?? 0,
        ),
        income.status === 'active' ? 'activo' : 'anulado',
        income.notes,
        income.createdAt,
      ]),
    ),
    'transferencias.csv': toCsv(
      ['id', 'fecha', 'envia', 'recibe', 'monto', 'moneda', 'estado', 'nota', 'creado'],
      transfers.map((transfer) => [
        transfer.id,
        transfer.date,
        name(transfer.fromUser),
        name(transfer.toUser),
        transfer.amount,
        transfer.currency,
        transfer.status === 'active' ? 'activo' : 'anulado',
        transfer.notes,
        transfer.createdAt,
      ]),
    ),
    'pagos_tarjeta.csv': toCsv(
      ['id', 'fecha', 'persona', 'monto', 'moneda', 'estado', 'nota', 'creado'],
      cardPayments.map((payment) => [
        payment.id,
        payment.date,
        name(payment.userId),
        payment.amount,
        payment.currency,
        payment.status === 'active' ? 'activo' : 'anulado',
        payment.notes,
        payment.createdAt,
      ]),
    ),
    'categorias.csv': toCsv(
      ['id', 'tipo', 'nombre', 'icono', 'archivada'],
      input.categories.map((category) => [
        category.id,
        category.kind === 'expense' ? 'gasto' : 'ingreso',
        category.name,
        category.icon,
        category.archivedAt ? 'si' : 'no',
      ]),
    ),
    'recurrentes.csv': toCsv(
      [
        'id',
        'nombre',
        'monto',
        'moneda',
        'frecuencia',
        'proxima_fecha',
        'categoria',
        'paga',
        'tarjeta',
        ...people.map((person) => `porcentaje_${person.displayName}`),
        'activo',
      ],
      input.recurring.map((item) => [
        item.id,
        item.name,
        item.amount,
        item.currency,
        item.frequency === 'monthly' ? 'mensual' : 'trimestral',
        item.nextDueDate,
        categoryName(item.categoryId),
        name(item.paidBy),
        item.paidWithCard ? 'si' : 'no',
        ...people.map(
          (person) =>
            (item.splits.find((split) => split.userId === person.userId)?.shareBp ?? 0) / 100,
        ),
        item.active ? 'si' : 'no',
      ]),
    ),
  }

  const json = {
    app: 'BULLMILTON',
    version: 1,
    exportedAt: input.exportedAt,
    household: input.householdName,
    note: 'Montos en la unidad mínima de la moneda (COP sin decimales). Porcentajes en puntos básicos (10000 = 100 %).',
    members: input.members,
    categories: input.categories,
    expenses,
    incomes,
    transfers,
    recurringExpenses: input.recurring,
  }

  return { csv, json: JSON.stringify(json, null, 2) }
}

/** Descarga un archivo generado en el navegador (sin pasar por ningún servidor). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
