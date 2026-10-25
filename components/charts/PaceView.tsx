import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import {
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PACE_MIN_DAYS, type MonthPace, type PacePoint } from '../../lib/calculations/charts'
import { formatDay, formatMonthName } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { ButtonLink } from '../ui/Button'
import { ChartBox, ChartLegend, DataTable, TooltipBox } from './chartParts'
import { axisTick, gridStroke, yAxisProps } from './chartStyle'

const SPENT = 'var(--color-primary)'
const INCOME = 'var(--color-positive)'

/** Vista 2: gasto acumulado del mes día a día contra lo que entró, con la proyección. */
export function PaceView({
  pace,
  today,
  asTable,
}: {
  pace: MonthPace
  today: string
  asTable: boolean
}) {
  const monthName = formatMonthName(pace.month)

  if (pace.incomes === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-2 p-4">
        <p className="font-medium">Aún no hay ingresos en {monthName}</p>
        <p className="text-sm text-fg-muted">
          El ritmo compara lo que llevan gastado con lo que entró en el mes. Registra lo que les
          entró (salario, mesada, un trabajo) y aquí verás si van a llegar a fin de mes.
        </p>
        {pace.spent > 0 && (
          <p className="text-sm text-fg-muted">
            Por ahora llevan{' '}
            <span className="tabular font-semibold text-fg">{formatMoney(pace.spent)}</span> en
            gastos.
          </p>
        )}
        <ButtonLink to="/ingresos/nuevo" variant="secondary" size="sm">
          Registrar un ingreso
        </ButtonLink>
      </div>
    )

  const finished = pace.elapsed >= pace.days
  const projecting = !finished && pace.elapsed >= PACE_MIN_DAYS
  const overBy = pace.projected - pace.incomes
  const percent = Math.floor((pace.spent * 100) / pace.incomes)
  const top = Math.max(pace.incomes, pace.projected, pace.spent)

  const status = finished ? (
    <p className="text-sm text-fg-muted">
      {monthName[0].toUpperCase() + monthName.slice(1)} cerró con{' '}
      <span className="tabular font-semibold text-fg">{formatMoney(pace.spent)}</span> gastados de{' '}
      <span className="tabular font-semibold text-fg">{formatMoney(pace.incomes)}</span> que
      entraron.
    </p>
  ) : (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-fg-muted">
        Llevan <span className="tabular font-semibold text-fg">{formatMoney(pace.spent)}</span> de{' '}
        <span className="tabular font-semibold text-fg">{formatMoney(pace.incomes)}</span> que
        entraron ({percent} %).
      </p>
      {projecting ? (
        overBy > 0 ? (
          <p className="inline-flex items-start gap-1.5 text-sm font-medium text-negative">
            <WarningCircleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
              weight="bold"
            />
            A este ritmo terminan el mes en {formatMoney(pace.projected)}: se pasarían por{' '}
            {formatMoney(overBy)}.
          </p>
        ) : (
          <p className="inline-flex items-start gap-1.5 text-sm text-fg">
            <CheckCircleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-positive"
              weight="bold"
            />
            A este ritmo terminan el mes en {formatMoney(pace.projected)}: les sobrarían{' '}
            {formatMoney(-overBy)}.
          </p>
        )
      ) : (
        <p className="text-sm text-fg-muted">
          La proyección aparece desde el día {PACE_MIN_DAYS}: antes, un gasto grande la distorsiona.
        </p>
      )}
    </div>
  )

  const weekly = pace.points.filter(
    (point) => point.day % 7 === 0 || point.day === pace.days || point.day === pace.elapsed,
  )

  return (
    <div className="flex flex-col gap-3">
      {status}
      {asTable ? (
        <DataTable
          caption={`Gasto acumulado de ${monthName}`}
          rows={weekly}
          rowKey={(point) => point.date}
          columns={[
            { header: 'Día', cell: (point) => formatDay(point.date, today) },
            {
              header: 'Acumulado',
              cell: (point) => (point.spent === null ? '—' : formatMoney(point.spent)),
            },
            {
              header: 'Proyección',
              cell: (point) => (point.projected === null ? '—' : formatMoney(point.projected)),
            },
          ]}
        />
      ) : (
        <>
          <ChartLegend
            label="Series"
            items={[
              { label: 'Gastado', color: SPENT, mark: 'line' },
              ...(projecting
                ? [{ label: 'A este ritmo', color: SPENT, mark: 'dashed' as const }]
                : []),
              { label: 'Lo que entró', color: INCOME, mark: 'line' },
            ]}
          />
          <ChartBox
            label={`Ritmo de ${monthName}: llevan ${formatMoney(pace.spent)} de ${formatMoney(pace.incomes)} que entraron${projecting ? `; a este ritmo terminan en ${formatMoney(pace.projected)}` : ''}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pace.points} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  ticks={[1, 8, 15, 22, pace.days]}
                />
                <YAxis {...yAxisProps()} domain={[0, Math.ceil(top * 1.08)]} />
                <ReferenceLine
                  y={pace.incomes}
                  stroke={INCOME}
                  strokeWidth={2}
                  label={{
                    value: 'Lo que entró',
                    position: 'insideTopLeft',
                    fill: 'var(--color-fg-muted)',
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as PacePoint | undefined
                    if (!active || !point) return null
                    return (
                      <TooltipBox
                        title={formatDay(point.date, today)}
                        rows={[
                          ...(point.spent !== null
                            ? [{ label: 'Gastado', value: formatMoney(point.spent), color: SPENT }]
                            : []),
                          ...(point.projected !== null && point.day > pace.elapsed
                            ? [{ label: 'A este ritmo', value: formatMoney(point.projected) }]
                            : []),
                          { label: 'Entró', value: formatMoney(pace.incomes), color: INCOME },
                        ]}
                      />
                    )
                  }}
                />
                <Line
                  dataKey="spent"
                  name="Gastado"
                  stroke={SPENT}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {projecting && (
                  <Line
                    dataKey="projected"
                    name="A este ritmo"
                    stroke={SPENT}
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
          <p className="text-xs text-fg-muted">
            Los gastos recurrentes (arriendo, servicios) cuentan una sola vez en la proyección; el
            resto se extiende al ritmo de lo que va del mes.
          </p>
        </>
      )}
    </div>
  )
}
