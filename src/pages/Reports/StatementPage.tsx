import { useEffect, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { CopyIcon, DownloadSimpleIcon, FilePdfIcon } from '@phosphor-icons/react'
import { memberName, useHousehold } from '../../app/household-context'
import { buildStatement } from '../../lib/calculations/statement'
import { formatDay, isValidDay, todayBogota } from '../../lib/dates'
import { downloadFile } from '../../lib/export'
import { formatMoney, formatSigned } from '../../lib/money'
import { periodLabels, resolvePeriod, type PeriodPreset } from '../../lib/periods'
import { longDate, periodTitle, statementToText } from '../../lib/statementText'
import { Button } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/toast-context'

const presets: PeriodPreset[] = ['week', 'previousWeek', 'month', 'previousMonth']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex break-inside-avoid-page flex-col gap-3">
      <h2 className="border-b border-line-strong pb-1.5 text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const th = 'py-1.5 pr-3 text-left font-medium text-fg-muted last:pr-0'
const thNum = 'py-1.5 pl-3 text-right font-medium text-fg-muted whitespace-nowrap'
const td = 'py-1.5 pr-3 align-top'
const tdNum = 'py-1.5 pl-3 text-right align-top tabular whitespace-nowrap'

/**
 * Reportes → Extracto: un documento del periodo, separado por categoría y por persona, para
 * guardarlo como PDF (impresión del navegador, sin librerías) o copiarlo como texto con
 * instrucciones para pedirle el informe a Claude.
 */
export function StatementPage() {
  const data = useHousehold()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = todayBogota()

  const from = params.get('desde')
  const to = params.get('hasta')
  const range =
    from && to && isValidDay(from) && isValidDay(to) && from <= to
      ? { from, to }
      : resolvePeriod('month', today)
  const activePreset = presets.find((preset) => {
    const option = resolvePeriod(preset, today)
    return option.from === range.from && option.to === range.to
  })

  const memberIds = data.members.map((member) => member.userId)
  const statement = useMemo(
    () => buildStatement(data.movements, memberIds, range),
    // memberIds se deriva de data.members
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.movements, data.members, range.from, range.to],
  )
  const people = statement.people.filter(
    (person) =>
      data.members.find((member) => member.userId === person.userId)?.active ||
      person.paid + person.share + person.incomes + person.transfersSent > 0,
  )
  const period = periodTitle(range)
  const name = (userId: string) => memberName(data, userId)
  const categoryName = (id: string | null) =>
    data.categories.find((category) => category.id === id)?.name ?? 'Sin categoría'
  const day = (date: string) => formatDay(date, today)

  // El título del documento es el nombre que propone el navegador al guardar el PDF.
  useEffect(() => {
    const previous = document.title
    document.title = `Extracto ${range.from} a ${range.to} · BULLMILTON`
    return () => {
      document.title = previous
    }
  }, [range.from, range.to])

  const text = () =>
    statementToText(
      { ...statement, people },
      {
        household: data.household.name,
        period,
        generatedOn: today,
        personName: name,
        categoryName,
      },
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text())
      toast.show('Copiado. Pégalo en el chat con Claude y te devuelve el informe.')
    } catch {
      downloadFile(`extracto-${range.from}-a-${range.to}.md`, text(), 'text/markdown')
      toast.show('No se pudo copiar: lo descargamos como archivo de texto.')
    }
  }

  const { totals, categories } = statement

  return (
    <Page width="lg">
      <div className="print:hidden">
        <PageHeader
          title="Extracto"
          back="/reportes"
          description="Lo que se gastó en el periodo, por categoría y por persona, con el detalle de cada gasto."
        />
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-surface p-(--card-p)">
          <div role="radiogroup" aria-label="Periodo" className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={activePreset === preset}
                onClick={() => {
                  const option = resolvePeriod(preset, today)
                  setParams({ desde: option.from, hasta: option.to }, { replace: true })
                }}
                className={`h-11 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-150 ${
                  activePreset === preset
                    ? 'bg-fg font-semibold text-canvas'
                    : 'bg-surface-2 font-medium text-fg-muted hover:text-fg'
                }`}
              >
                {periodLabels[preset]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              onClick={() => window.print()}
              icon={<FilePdfIcon aria-hidden="true" className="size-5" weight="bold" />}
            >
              Guardar como PDF
            </Button>
            <Button
              variant="secondary"
              onClick={copy}
              icon={<CopyIcon aria-hidden="true" className="size-5" weight="bold" />}
            >
              Copiar para Claude
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                downloadFile(`extracto-${range.from}-a-${range.to}.md`, text(), 'text/markdown')
              }
              icon={<DownloadSimpleIcon aria-hidden="true" className="size-5" weight="bold" />}
            >
              Descargar texto
            </Button>
          </div>
          <p className="text-sm text-fg-muted">
            «Guardar como PDF» abre la impresión: elige «Guardar como PDF» como destino (en el
            celular, desde Compartir → Imprimir). «Copiar para Claude» copia todo con las
            instrucciones para que te arme el informe.
          </p>
        </div>
      </div>

      <article
        aria-label={`Extracto del ${period}`}
        className="flex flex-col gap-8 rounded-2xl bg-surface p-5 sm:p-8 print:rounded-none print:p-0"
      >
        <header className="flex flex-col gap-1">
          <p className="text-sm font-bold tracking-wide">BULLMILTON · {data.household.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Extracto de gastos</h1>
          <p className="text-fg-muted">
            Del {period}. Generado el {longDate(today)}.
          </p>
        </header>

        <Section title="Resumen">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {[
              { label: 'Ingresos', value: formatMoney(totals.incomes) },
              {
                label: 'Gastos',
                value: formatMoney(totals.expenses),
                hint: `${totals.expenseCount} ${totals.expenseCount === 1 ? 'gasto' : 'gastos'}${totals.cardExpenses > 0 ? ` · tarjeta ${formatMoney(totals.cardExpenses)}` : ''}`,
              },
              {
                label: 'Queda',
                value: formatSigned(totals.left),
                hint: 'Ingresos − gastos',
                negative: totals.left < 0,
              },
              {
                label: 'Transferencias',
                value: formatMoney(totals.transfers),
                hint: 'Entre ustedes; no son gasto',
              },
            ].map((item) => (
              <div key={item.label} className="flex flex-col">
                <dt className="text-sm text-fg-muted">{item.label}</dt>
                <dd
                  className={`tabular text-xl font-semibold ${item.negative ? 'text-negative' : ''}`}
                >
                  {item.value}
                </dd>
                {item.hint && <dd className="text-xs text-fg-muted">{item.hint}</dd>}
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Por persona">
          {/* En el celular, una ficha por persona; desde sm (y al imprimir), la tabla. */}
          <ul className="flex flex-col divide-y divide-line text-sm sm:hidden print:hidden">
            {people.map((person) => (
              <li key={person.userId} className="flex flex-col gap-1 py-2.5">
                <p className="flex justify-between gap-3 font-medium">
                  {name(person.userId)}
                  <span
                    className={`tabular font-semibold ${person.left < 0 ? 'text-negative' : ''}`}
                  >
                    le queda {formatSigned(person.left)}
                  </span>
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-fg-muted">
                  {[
                    ['Le entró', person.incomes],
                    ['Pagó', person.paid],
                    ['Su parte', person.share],
                    ['Recibió', person.transfersReceived],
                    ['Envió', person.transfersSent],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt>{label}</dt>
                      <dd className="tabular text-fg">{formatMoney(value as number)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block print:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={th}>
                    Persona
                  </th>
                  <th scope="col" className={thNum}>
                    Le entró
                  </th>
                  <th scope="col" className={thNum}>
                    Pagó
                  </th>
                  <th scope="col" className={thNum}>
                    Su parte
                  </th>
                  <th scope="col" className={thNum}>
                    Recibió
                  </th>
                  <th scope="col" className={thNum}>
                    Envió
                  </th>
                  <th scope="col" className={thNum}>
                    Le queda
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.userId} className="border-b border-line last:border-0">
                    <th scope="row" className={`${td} text-left font-medium`}>
                      {name(person.userId)}
                    </th>
                    <td className={tdNum}>{formatMoney(person.incomes)}</td>
                    <td className={tdNum}>{formatMoney(person.paid)}</td>
                    <td className={tdNum}>{formatMoney(person.share)}</td>
                    <td className={tdNum}>{formatMoney(person.transfersReceived)}</td>
                    <td className={tdNum}>{formatMoney(person.transfersSent)}</td>
                    <td
                      className={`${tdNum} font-semibold ${person.left < 0 ? 'text-negative' : ''}`}
                    >
                      {formatSigned(person.left)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg-muted">
            «Pagó» es lo que salió de su bolsillo; «su parte», lo que le toca de cada gasto según la
            división. A cada uno se le resta su parte, sin importar quién pagó.
          </p>
        </Section>

        <Section title="Por categoría">
          {categories.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin gastos en este periodo.</p>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>
                      Categoría
                    </th>
                    <th scope="col" className={thNum}>
                      Total
                    </th>
                    <th scope="col" className={thNum}>
                      %
                    </th>
                    {people.map((person) => (
                      <th
                        key={person.userId}
                        scope="col"
                        className={`${thNum} hidden sm:table-cell print:table-cell`}
                      >
                        Parte de {name(person.userId)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.categoryId} className="border-b border-line">
                      <th scope="row" className={`${td} text-left font-medium`}>
                        {categoryName(category.categoryId)}{' '}
                        <span className="font-normal text-fg-muted">({category.count})</span>
                        <span className="block text-xs font-normal text-fg-muted sm:hidden print:hidden">
                          {people
                            .map(
                              (person) =>
                                `${name(person.userId)} ${formatMoney(category.byPerson[person.userId] ?? 0)}`,
                            )
                            .join(' · ')}
                        </span>
                      </th>
                      <td className={`${tdNum} font-semibold`}>{formatMoney(category.total)}</td>
                      <td className={`${tdNum} text-fg-muted`}>
                        {Math.round(category.shareBp / 100)} %
                      </td>
                      {people.map((person) => (
                        <td
                          key={person.userId}
                          className={`${tdNum} hidden sm:table-cell print:table-cell`}
                        >
                          {formatMoney(category.byPerson[person.userId] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className={`${td} text-left font-semibold`}>
                      Total
                    </th>
                    <td className={`${tdNum} font-semibold`}>{formatMoney(totals.expenses)}</td>
                    <td className={tdNum} />
                    {people.map((person) => (
                      <td
                        key={person.userId}
                        className={`${tdNum} hidden font-semibold sm:table-cell print:table-cell`}
                      >
                        {formatMoney(person.share)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-xs text-fg-muted">
            Cada gasto cuenta una vez, en su categoría principal, para que todo sume el total.
          </p>
        </Section>

        {categories.length > 0 && (
          <Section title="Detalle de gastos">
            {categories.map((category) => (
              <div key={category.categoryId} className="flex break-inside-avoid flex-col gap-1">
                <h3 className="flex justify-between gap-3 text-sm font-semibold">
                  <span>{categoryName(category.categoryId)}</span>
                  <span className="tabular">{formatMoney(category.total)}</span>
                </h3>
                <ul className="flex flex-col divide-y divide-line text-sm">
                  {category.expenses.map((expense) => {
                    const extra = expense.extraCategoryIds.filter((id) => id !== expense.categoryId)
                    return (
                      <li key={expense.id} className="flex justify-between gap-3 py-1.5">
                        <span className="flex min-w-0 flex-col">
                          <span>
                            <span className="text-fg-muted">{day(expense.date)} · </span>
                            {expense.description}
                          </span>
                          <span className="text-xs text-fg-muted">
                            Pagó {name(expense.paidBy)}
                            {expense.paidWithCard && ' con tarjeta'} ·{' '}
                            {expense.splits
                              .filter((split) => split.amount > 0)
                              .map((split) => `${name(split.userId)} ${formatMoney(split.amount)}`)
                              .join(' · ')}
                            {extra.length > 0 && ` · también ${extra.map(categoryName).join(', ')}`}
                          </span>
                        </span>
                        <span className="shrink-0 tabular font-medium">
                          {formatMoney(expense.amount)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </Section>
        )}

        <Section title="Ingresos">
          {statement.incomes.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin ingresos en este periodo.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {statement.incomes.map((income) => (
                <li key={income.id} className="flex justify-between gap-3 py-1.5">
                  <span className="flex min-w-0 flex-col">
                    <span>
                      <span className="text-fg-muted">{day(income.date)} · </span>
                      {income.source}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {income.splits.length > 1
                        ? `Compartido: ${income.splits.map((split) => `${name(split.userId)} ${formatMoney(split.amount)}`).join(' · ')}`
                        : `De ${name(income.userId)}`}
                    </span>
                  </span>
                  <span className="shrink-0 tabular font-medium">{formatMoney(income.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {statement.transfers.length > 0 && (
          <Section title="Transferencias entre ustedes">
            <ul className="flex flex-col divide-y divide-line text-sm">
              {statement.transfers.map((transfer) => (
                <li key={transfer.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    <span className="text-fg-muted">{day(transfer.date)} · </span>
                    {name(transfer.fromUser)} → {name(transfer.toUser)}
                    {transfer.notes && <span className="text-fg-muted"> · {transfer.notes}</span>}
                  </span>
                  <span className="shrink-0 tabular font-medium">
                    {formatMoney(transfer.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </article>
    </Page>
  )
}
