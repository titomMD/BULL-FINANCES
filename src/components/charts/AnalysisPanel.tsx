import { useMemo, useState } from 'react'
import type { Movement } from '../../types/domain'
import type { PersonColorId } from '../../lib/appearance'
import {
  compareCategories,
  incomeVsExpenseByMonth,
  monthPace,
  remainingByMonth,
} from '../../lib/calculations/charts'
import {
  expensesByCategory,
  type DateRange,
  type PeriodSummary,
  type PersonSummary,
} from '../../lib/calculations/reports'
import { usePreferences } from '../../hooks/usePreferences'
import { Segmented } from '../ui/Segmented'
import { ChartViewPicker } from './ChartViewPicker'
import { CategoryView, CompareView, PersonView } from './ListViews'
import { IncomeExpenseView, RemainingView } from './MonthlyViews'
import { PaceView } from './PaceView'

interface AnalysisPanelProps {
  /** Los mismos movimientos (ya filtrados) y el mismo periodo que el resto de Reportes. */
  movements: ReadonlyArray<Movement>
  range: DateRange
  today: string
  userId: string
  memberIds: string[]
  summary: PeriodSummary
  people: PersonSummary[]
  names: Record<string, string>
  colors: Record<string, PersonColorId>
}

/** Vistas con gráfica de ejes: tienen una alternativa en tabla. */
const charted = new Set(['income_expense', 'pace', 'remaining'])

/**
 * Panel de análisis de Reportes: un desplegable "Ver como…" cambia de vista. La vista elegida se
 * recuerda en la cuenta. Toda la lógica de las series está en lib/calculations/charts.ts.
 */
export function AnalysisPanel({
  movements,
  range,
  today,
  userId,
  memberIds,
  summary,
  people,
  names,
  colors,
}: AnalysisPanelProps) {
  const [{ reportView: view }, update] = usePreferences()
  const [asTable, setAsTable] = useState(false)
  const [scope, setScope] = useState<'household' | 'mine'>('household')
  const scoped = scope === 'mine' ? { userId } : {}

  const series = useMemo(() => {
    switch (view) {
      case 'income_expense':
        return { view, rows: incomeVsExpenseByMonth(movements, range) }
      case 'pace':
        return { view, pace: monthPace(movements, range, today) }
      case 'category':
        return { view, categories: expensesByCategory(movements, range, scoped) }
      case 'remaining':
        return { view, rows: remainingByMonth(movements, range, memberIds) }
      case 'compare':
        return { view, ...compareCategories(movements, range, scoped) }
      case 'person':
        return { view }
    }
    // scoped depende de scope y userId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, movements, range.from, range.to, today, scope, userId, memberIds])

  const visiblePeople = people.map((person) => person.userId)

  return (
    <section
      aria-labelledby="analisis"
      className="flex flex-col gap-5 rounded-2xl bg-surface p-(--card-p)"
    >
      <h2 id="analisis" className="text-base font-semibold">
        Análisis
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ChartViewPicker value={view} onChange={(next) => update({ reportView: next })} />
        <div className="flex flex-wrap items-center gap-3">
          {(view === 'category' || view === 'compare') && (
            <div className="w-48">
              <Segmented
                label="Qué sumar"
                hideLabel
                size="sm"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'household', label: 'Hogar' },
                  { value: 'mine', label: 'Mi parte' },
                ]}
              />
            </div>
          )}
          {charted.has(view) && (
            <button
              type="button"
              onClick={() => setAsTable((value) => !value)}
              aria-pressed={asTable}
              className="inline-flex min-h-11 items-center text-sm font-medium text-fg-muted underline hover:text-fg"
            >
              {asTable ? 'Ver gráfico' : 'Ver como tabla'}
            </button>
          )}
        </div>
      </div>

      {series.view === 'income_expense' && (
        <IncomeExpenseView rows={series.rows} asTable={asTable} />
      )}
      {series.view === 'pace' && <PaceView pace={series.pace} today={today} asTable={asTable} />}
      {series.view === 'category' && (
        <CategoryView
          categories={series.categories}
          totalExpenses={summary.totalExpenses}
          scope={scope}
        />
      )}
      {series.view === 'person' && <PersonView people={people} />}
      {series.view === 'remaining' && (
        <RemainingView
          rows={series.rows}
          people={visiblePeople}
          names={names}
          colors={colors}
          asTable={asTable}
        />
      )}
      {series.view === 'compare' && (
        <CompareView
          changes={series.changes}
          range={range}
          previous={series.previous}
          today={today}
        />
      )}
    </section>
  )
}
