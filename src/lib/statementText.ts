// El extracto como texto (Markdown) con instrucciones, para copiarlo y pedirle a Claude el
// informe en documento. Función pura: recibe los nombres ya resueltos.

import type { Statement } from './calculations/statement'
import { formatDay, formatMonthName } from './dates'
import { formatMoney, formatSigned } from './money'

export interface StatementLabels {
  household: string
  /** "1 al 31 de octubre de 2026" */
  period: string
  /** Fecha en que se generó (YYYY-MM-DD). */
  generatedOn: string
  personName: (userId: string) => string
  categoryName: (categoryId: string | null) => string
}

const pct = (bp: number) => `${Math.round(bp / 100)} %`
const cell = (text: string) => text.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()

/** "1 al 31 de octubre de 2026", "13 al 19 de octubre de 2026", "28 de sept al 4 de oct de 2026". */
export function periodTitle(range: { from: string; to: string }): string {
  const [y1, m1, d1] = range.from.split('-').map(Number)
  const [y2, m2, d2] = range.to.split('-').map(Number)
  const month = (day: string) => formatMonthName(day)
  if (y1 === y2 && m1 === m2) return `${d1} al ${d2} de ${month(range.to)} de ${y2}`
  if (y1 === y2) return `${d1} de ${month(range.from)} al ${d2} de ${month(range.to)} de ${y2}`
  return `${d1} de ${month(range.from)} de ${y1} al ${d2} de ${month(range.to)} de ${y2}`
}

/** "20 de octubre de 2026" */
export function longDate(day: string): string {
  const [year, , d] = day.split('-').map(Number)
  return `${d} de ${formatMonthName(day)} de ${year}`
}

export function statementToText(statement: Statement, labels: StatementLabels): string {
  const { totals, people, categories, incomes, transfers } = statement
  const name = labels.personName
  const day = (date: string) => formatDay(date, labels.generatedOn)
  const lines: string[] = []
  const push = (...items: string[]) => lines.push(...items)

  push(
    'Hazme un informe claro, en español y listo para guardar como PDF, de los gastos de mi hogar',
    'con estos datos. Incluye: un resumen corto, los gastos por categoría y por persona (con',
    'tablas), en qué se fue la mayor parte y 2 o 3 observaciones útiles para el próximo periodo.',
    'Los montos están en pesos colombianos (COP, sin decimales); no inventes datos que no estén aquí.',
    '',
    `# Extracto de gastos · ${labels.household}`,
    `Periodo: ${labels.period}. Generado el ${longDate(labels.generatedOn)} desde BULLMILTON.`,
    '',
    '## Resumen',
    `- Ingresos: ${formatMoney(totals.incomes)}`,
    `- Gastos: ${formatMoney(totals.expenses)} (${totals.expenseCount} ${totals.expenseCount === 1 ? 'gasto' : 'gastos'}${totals.cardExpenses > 0 ? `; con tarjeta ${formatMoney(totals.cardExpenses)}` : ''})`,
    `- Queda (ingresos − gastos): ${formatSigned(totals.left)}`,
    `- Transferencias entre ustedes: ${formatMoney(totals.transfers)} (no son gasto)`,
    '',
    '## Por persona',
    'Su parte = lo que le toca de cada gasto según la división, sin importar quién lo pagó.',
    '',
    '| Persona | Le entró | Pagó | Su parte de los gastos | Recibió | Envió | Le queda |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...people.map(
      (person) =>
        `| ${cell(name(person.userId))} | ${formatMoney(person.incomes)} | ${formatMoney(person.paid)} | ${formatMoney(person.share)} | ${formatMoney(person.transfersReceived)} | ${formatMoney(person.transfersSent)} | ${formatSigned(person.left)} |`,
    ),
    '',
    '## Por categoría',
    'Cada gasto cuenta una vez, en su categoría principal.',
    '',
    `| Categoría | Total | % | Gastos | ${people.map((person) => `Parte de ${cell(name(person.userId))}`).join(' | ')} |`,
    `|---|---:|---:|---:|${people.map(() => '---:').join('|')}|`,
    ...categories.map(
      (category) =>
        `| ${cell(labels.categoryName(category.categoryId))} | ${formatMoney(category.total)} | ${pct(category.shareBp)} | ${category.count} | ${people.map((person) => formatMoney(category.byPerson[person.userId] ?? 0)).join(' | ')} |`,
    ),
    '',
    '## Detalle de gastos',
  )

  if (categories.length === 0) push('', 'Sin gastos en este periodo.')
  for (const category of categories) {
    push('', `### ${labels.categoryName(category.categoryId)} · ${formatMoney(category.total)}`)
    for (const expense of category.expenses) {
      const parts = expense.splits
        .filter((split) => split.amount > 0)
        .map((split) => `${name(split.userId)} ${formatMoney(split.amount)}`)
        .join(', ')
      const extra = expense.extraCategoryIds
        .filter((id) => id !== expense.categoryId)
        .map(labels.categoryName)
      push(
        `- ${day(expense.date)} · ${cell(expense.description)} · ${formatMoney(expense.amount)} · pagó ${name(expense.paidBy)}${expense.paidWithCard ? ' con tarjeta' : ''} · partes: ${parts}${extra.length ? ` · también: ${extra.join(', ')}` : ''}`,
      )
    }
  }

  push('', '## Ingresos')
  if (incomes.length === 0) push('', 'Sin ingresos en este periodo.')
  for (const income of incomes) {
    const shared = income.splits.length > 1
    push(
      `- ${day(income.date)} · ${cell(income.source)} · ${formatMoney(income.amount)} · de ${name(income.userId)}${
        shared
          ? ` · compartido: ${income.splits.map((split) => `${name(split.userId)} ${formatMoney(split.amount)}`).join(', ')}`
          : ''
      }`,
    )
  }

  if (transfers.length > 0) {
    push('', '## Transferencias entre ustedes')
    for (const transfer of transfers)
      push(
        `- ${day(transfer.date)} · ${name(transfer.fromUser)} → ${name(transfer.toUser)} · ${formatMoney(transfer.amount)}${transfer.notes ? ` · ${cell(transfer.notes)}` : ''}`,
      )
  }

  return lines.join('\n') + '\n'
}
