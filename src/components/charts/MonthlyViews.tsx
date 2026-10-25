import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PersonColorId } from '../../lib/appearance'
import type { IncomeExpenseMonth, RemainingMonth } from '../../lib/calculations/charts'
import { formatMonthAbbr, formatMonthName } from '../../lib/dates'
import { formatMoney, formatSigned } from '../../lib/money'
import { ChartBox, ChartLegend, DataTable, TooltipBox } from './chartParts'
import { axisTick, gridStroke, yAxisProps } from './chartStyle'

const INCOME = 'var(--color-positive)'
const EXPENSE = 'var(--color-primary)'
const LEFT = 'var(--color-fg)'

const monthTitle = (month: string) => `${formatMonthName(month)} ${month.slice(0, 4)}`

/** Vista 1: barras agrupadas de ingresos y gastos por mes, con la línea de lo que quedó. */
export function IncomeExpenseView({
  rows,
  asTable,
}: {
  rows: IncomeExpenseMonth[]
  asTable: boolean
}) {
  if (asTable)
    return (
      <DataTable
        caption="Ingresos, gastos y lo que quedó por mes"
        rows={rows}
        rowKey={(row) => row.month}
        columns={[
          { header: 'Mes', cell: (row) => monthTitle(row.month) },
          { header: 'Ingresos', cell: (row) => formatMoney(row.incomes) },
          { header: 'Gastos', cell: (row) => formatMoney(row.expenses) },
          { header: 'Quedó', cell: (row) => formatSigned(row.left) },
        ]}
      />
    )

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        label="Series"
        items={[
          { label: 'Ingresos', color: INCOME },
          { label: 'Gastos', color: EXPENSE },
          { label: 'Quedó', color: LEFT, mark: 'line' },
        ]}
      />
      <ChartBox
        label={`Ingresos y gastos por mes: ${rows
          .map(
            (row) =>
              `${monthTitle(row.month)}, entró ${formatMoney(row.incomes)}, se gastó ${formatMoney(row.expenses)}, quedó ${formatSigned(row.left)}`,
          )
          .join('; ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthAbbr}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              interval={0}
            />
            <YAxis {...yAxisProps()} />
            <ReferenceLine y={0} stroke="var(--color-line-strong)" />
            <Tooltip
              cursor={{ fill: 'var(--color-line)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as IncomeExpenseMonth | undefined
                if (!active || !row) return null
                return (
                  <TooltipBox
                    title={monthTitle(row.month)}
                    rows={[
                      { label: 'Ingresos', value: formatMoney(row.incomes), color: INCOME },
                      { label: 'Gastos', value: formatMoney(row.expenses), color: EXPENSE },
                      { label: 'Quedó', value: formatSigned(row.left), strong: true },
                    ]}
                  />
                )
              }}
            />
            <Bar
              dataKey="incomes"
              name="Ingresos"
              fill={INCOME}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenses"
              name="Gastos"
              fill={EXPENSE}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Line
              dataKey="left"
              name="Quedó"
              stroke={LEFT}
              strokeWidth={2}
              dot={{ r: 4, fill: LEFT, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>
    </div>
  )
}

/** Vista 5: lo que le quedó a cada persona, mes a mes (barras por persona, en su color). */
export function RemainingView({
  rows,
  people,
  names,
  colors,
  asTable,
}: {
  rows: RemainingMonth[]
  people: string[]
  names: Record<string, string>
  colors: Record<string, PersonColorId>
  asTable: boolean
}) {
  const colorOf = (userId: string) => `var(--color-person-${colors[userId] ?? 'azul'})`

  if (asTable)
    return (
      <DataTable
        caption="Lo que le quedó a cada persona por mes"
        rows={rows}
        rowKey={(row) => row.month}
        columns={[
          { header: 'Mes', cell: (row) => monthTitle(row.month) },
          ...people.map((userId) => ({
            header: names[userId] ?? 'Alguien',
            cell: (row: RemainingMonth) => formatSigned(row.byPerson[userId] ?? 0),
          })),
        ]}
      />
    )

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        label="Personas"
        items={people.map((userId) => ({ label: names[userId], color: colorOf(userId) }))}
      />
      <ChartBox
        label={`Lo que le quedó a cada uno por mes: ${rows
          .map(
            (row) =>
              `${monthTitle(row.month)}: ${people
                .map((userId) => `${names[userId]} ${formatSigned(row.byPerson[userId] ?? 0)}`)
                .join(', ')}`,
          )
          .join('; ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthAbbr}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              interval={0}
            />
            <YAxis {...yAxisProps()} />
            <ReferenceLine y={0} stroke="var(--color-line-strong)" />
            <Tooltip
              cursor={{ fill: 'var(--color-line)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as RemainingMonth | undefined
                if (!active || !row) return null
                return (
                  <TooltipBox
                    title={monthTitle(row.month)}
                    rows={people.map((userId) => ({
                      label: `${names[userId]}: quedó`,
                      value: formatSigned(row.byPerson[userId] ?? 0),
                      color: colorOf(userId),
                    }))}
                  />
                )
              }}
            />
            {people.map((userId) => (
              <Bar
                key={userId}
                name={names[userId]}
                dataKey={(row: RemainingMonth) => row.byPerson[userId] ?? 0}
                fill={colorOf(userId)}
                radius={4}
                maxBarSize={22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartBox>
    </div>
  )
}
