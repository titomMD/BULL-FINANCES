import { useMemo, useState } from 'react'
import { ChartPieIcon, FileTextIcon, FunnelSimpleIcon } from '@phosphor-icons/react'
import { memberName, useHousehold } from '../../app/household-context'
import { expenseCategoryIds, summarizePeriod } from '../../lib/calculations/reports'
import { startOfMonth, todayBogota } from '../../lib/dates'
import { periodLabels, resolvePeriod, type PeriodPreset } from '../../lib/periods'
import { resolvePersonColors } from '../../lib/people'
import { SpendAlerts } from '../../components/alerts/SpendAlerts'
import { AnalysisPanel } from '../../components/charts/AnalysisPanel'
import { CategoryChips } from '../../components/forms/CategoryChips'
import { PeriodLeftCard } from '../../components/reports/PeriodLeftCard'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { ScrollFade } from '../../components/ui/ScrollFade'
import { EmptyState } from '../../components/ui/States'
import { ButtonLink } from '../../components/ui/Button'

const presets: PeriodPreset[] = [
  'week',
  'previousWeek',
  'month',
  'previousMonth',
  'last3Months',
  'custom',
]

/**
 * Reportes (spec §19-§20): lo que queda del periodo (Ingresos − Gastos = Queda) y el panel de
 * análisis con vistas seleccionables. Todo usa el mismo periodo y el mismo filtro.
 */
export function ReportsPage() {
  const data = useHousehold()
  const today = todayBogota()
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [custom, setCustom] = useState({ from: startOfMonth(today), to: today })
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)

  const range = resolvePeriod(preset, today, custom)
  const memberIds = data.members.map((member) => member.userId)
  const periodName =
    preset === 'custom' ? 'rango personalizado' : periodLabels[preset].toLowerCase()

  const { movements, summary } = useMemo(() => {
    // Filtro por categorías: solo afecta a los gastos (ingresos y transferencias siguen).
    const filtered =
      categoryFilter.length === 0
        ? data.movements
        : data.movements.filter(
            (movement) =>
              movement.kind !== 'expense' ||
              expenseCategoryIds(movement).some((id) => categoryFilter.includes(id)),
          )
    return { movements: filtered, summary: summarizePeriod(filtered, memberIds, range) }
    // memberIds se deriva de data.members
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.movements, data.members, range.from, range.to, categoryFilter])

  const names = Object.fromEntries(
    data.members.map((member) => [member.userId, memberName(data, member.userId, { you: true })]),
  )
  const people = summary.people.filter(
    (person) =>
      data.members.find((member) => member.userId === person.userId)?.active ||
      person.paid + person.incomes > 0,
  )

  return (
    <Page width="lg">
      <PageHeader
        title="Reportes"
        actions={
          <ButtonLink
            to={`/reportes/extracto?${new URLSearchParams({ desde: range.from, hasta: range.to })}`}
            variant="secondary"
            size="sm"
            icon={<FileTextIcon aria-hidden="true" className="size-4" weight="bold" />}
          >
            Extracto
          </ButtonLink>
        }
      />
      <SpendAlerts className="mb-6" linkToReports={false} />

      <div className="-mx-4 mb-6 flex flex-col gap-3 px-4">
        <ScrollFade className="pb-1">
          <div role="radiogroup" aria-label="Periodo" className="flex w-max gap-2">
            {presets.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={preset === value}
                onClick={() => setPreset(value)}
                className={`h-11 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-150 ${
                  preset === value
                    ? 'bg-fg font-semibold text-canvas'
                    : 'bg-surface-2 font-medium text-fg-muted hover:text-fg'
                }`}
              >
                {periodLabels[value]}
              </button>
            ))}
          </div>
        </ScrollFade>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Field label="Desde">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={custom.from}
                  onChange={(event) =>
                    setCustom((value) => ({ ...value, from: event.target.value }))
                  }
                />
              )}
            </Field>
            <Field label="Hasta">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="date"
                  value={custom.to}
                  onChange={(event) => setCustom((value) => ({ ...value, to: event.target.value }))}
                />
              )}
            </Field>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowCategoryFilter((value) => !value)}
            aria-expanded={showCategoryFilter}
            aria-controls="filtro-categorias"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-fg-muted hover:text-fg"
          >
            <FunnelSimpleIcon aria-hidden="true" className="size-4" weight="bold" />
            {categoryFilter.length > 0
              ? `Categorías (${categoryFilter.length})`
              : 'Filtrar por categorías'}
          </button>
          {showCategoryFilter && (
            <div id="filtro-categorias" className="rounded-2xl bg-surface p-4">
              <CategoryChips
                label="Solo gastos de estas categorías"
                categories={data.categories.filter(
                  (category) => category.kind === 'expense' && !category.archivedAt,
                )}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </div>
          )}
          {categoryFilter.length > 0 && (
            <p className="text-sm text-fg-muted">
              Los gastos están filtrados por categoría; los ingresos y transferencias no.
            </p>
          )}
        </div>
      </div>

      {summary.expenseCount === 0 && summary.totalIncomes === 0 && summary.totalTransfers === 0 ? (
        <EmptyState icon={<ChartPieIcon />} title="Sin movimientos en este periodo">
          Elige otro periodo o registra un gasto para ver los reportes.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <PeriodLeftCard summary={summary} people={people} periodLabel={periodName} />
          <AnalysisPanel
            movements={movements}
            range={range}
            today={today}
            userId={data.userId}
            memberIds={memberIds}
            summary={summary}
            people={people}
            names={names}
            colors={resolvePersonColors(data.members)}
          />
        </div>
      )}
    </Page>
  )
}
