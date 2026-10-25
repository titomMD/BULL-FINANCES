import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from '@phosphor-icons/react'
import { memberName, personColor, useHousehold } from '../../app/household-context'
import type { CategoryChange } from '../../lib/calculations/charts'
import type { CategoryTotal, DateRange, PersonSummary } from '../../lib/calculations/reports'
import { endOfMonth, formatDay, formatMonthName, startOfMonth } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { CategoryIcon } from '../movements/CategoryIcon'
import { categorySolid } from '../movements/categoryColors'
import { PersonAvatar } from '../people/PersonColor'
import { personBg } from '../people/personClasses'

// Vistas que se leen mejor como listas con barras horizontales (nada de tortas): el texto lleva
// el monto y el porcentaje, la barra solo ayuda a comparar.

const useCategory = () => {
  const data = useHousehold()
  return (id: string | null) => data.categories.find((category) => category.id === id)
}

/** Vista 3: gasto por categoría, de mayor a menor, con monto y %. */
export function CategoryView({
  categories,
  totalExpenses,
  scope,
}: {
  categories: CategoryTotal[]
  totalExpenses: number
  scope: 'household' | 'mine'
}) {
  const categoryOf = useCategory()
  if (categories.length === 0)
    return <p className="text-sm text-fg-muted">Sin gastos en este periodo.</p>
  const max = Math.max(1, ...categories.map((entry) => entry.amount))
  const total = categories.reduce((sum, entry) => sum + entry.amount, 0)

  return (
    <>
      <table className="w-full text-sm">
        <caption className="sr-only">Gasto por categoría, de mayor a menor</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Categoría</th>
            <th scope="col">Porcentaje</th>
            <th scope="col">Monto</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((entry) => {
            const category = categoryOf(entry.categoryId)
            return (
              <tr key={entry.categoryId ?? 'none'} className="align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <CategoryIcon icon={category?.icon} className="size-4 shrink-0 text-fg-muted" />
                    {category?.name ?? 'Sin categoría'}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 block h-2 rounded-full ${category?.color ? categorySolid[category.color] : 'bg-primary'}`}
                    style={{ width: `${Math.max(2, (entry.amount / max) * 100)}%` }}
                  />
                </th>
                <td className="w-14 py-2 text-right tabular text-fg-muted">
                  {Math.round(entry.shareBp / 100)} %
                </td>
                <td className="w-28 py-2 text-right tabular font-semibold">
                  {formatMoney(entry.amount)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <th scope="row" className="pt-2 text-left font-medium text-fg-muted">
              Total
            </th>
            <td />
            <td className="pt-2 text-right tabular font-semibold">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
      {scope === 'household' && total > totalExpenses && (
        <p className="text-xs text-fg-muted">
          Hay gastos con varias categorías: cuentan completos en cada una, por eso la suma supera el
          total gastado ({formatMoney(totalExpenses)}).
        </p>
      )}
    </>
  )
}

/** Vista 4: lo que pagó cada uno contra lo que le correspondía, en su color y con texto. */
export function PersonView({ people }: { people: PersonSummary[] }) {
  const data = useHousehold()
  const max = Math.max(1, ...people.flatMap((person) => [person.paid, person.share]))
  if (people.every((person) => person.paid === 0 && person.share === 0))
    return <p className="text-sm text-fg-muted">Sin gastos en este periodo.</p>

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-5">
        {people.map((person) => {
          const mine = person.userId === data.userId
          const color = personColor(data, person.userId)
          const difference = person.paid - person.share
          return (
            <li key={person.userId} className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-medium">
                <PersonAvatar name={memberName(data, person.userId)} color={color} size="sm" />
                {memberName(data, person.userId, { you: true })}
              </span>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">{mine ? 'Pagaste' : 'Pagó'}</dt>
                    <dd className="tabular font-semibold">{formatMoney(person.paid)}</dd>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`block h-2.5 rounded-full ${personBg[color]}`}
                    style={{ width: `${Math.max(1, (person.paid / max) * 100)}%` }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">
                      {mine ? 'Te correspondía' : 'Le correspondía'}
                    </dt>
                    <dd className="tabular font-semibold">{formatMoney(person.share)}</dd>
                  </div>
                  {/* Lo que le tocaba: la misma barra en contorno, para no depender del tono. */}
                  <span
                    aria-hidden="true"
                    className="block h-2.5 rounded-full border-2 bg-transparent"
                    style={{
                      width: `${Math.max(1, (person.share / max) * 100)}%`,
                      borderColor: `var(--color-person-${color})`,
                    }}
                  />
                </div>
              </dl>
              <p className="text-xs text-fg-muted">
                {difference === 0
                  ? `${mine ? 'Pagaste' : 'Pagó'} justo lo que ${mine ? 'te' : 'le'} tocaba.`
                  : difference > 0
                    ? `${mine ? 'Pagaste' : 'Pagó'} ${formatMoney(difference)} más de lo que ${mine ? 'te' : 'le'} tocaba.`
                    : `${mine ? 'Pagaste' : 'Pagó'} ${formatMoney(-difference)} menos de lo que ${mine ? 'te' : 'le'} tocaba.`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-fg-muted">
        Barra llena: lo que pagó de su bolsillo. Barra en contorno: su parte según la división de
        cada gasto. Quién pagó no cambia el saldo de nadie: a cada uno se le resta su parte.
      </p>
    </div>
  )
}

/** Vista 6: qué subió y qué bajó por categoría frente al periodo anterior. */
export function CompareView({
  changes,
  range,
  previous,
  today,
}: {
  changes: CategoryChange[]
  range: DateRange
  previous: DateRange
  today: string
}) {
  const categoryOf = useCategory()
  // Un mes completo se nombra ("octubre"); otro rango, con sus fechas.
  const label = (period: DateRange) =>
    period.from === startOfMonth(period.from) && period.to === endOfMonth(period.from)
      ? formatMonthName(period.from)
      : `${formatDay(period.from, today)} al ${formatDay(period.to, today)}`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted first-letter:uppercase">
        {label(range)} contra {label(previous)}. Subir en rojo, bajar en verde.
      </p>
      {changes.length === 0 ? (
        <p className="text-sm text-fg-muted">Sin gastos en ninguno de los dos periodos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {changes.map((entry) => {
            const category = categoryOf(entry.categoryId)
            const up = entry.change > 0
            const isNew = entry.previous === 0
            const gone = entry.current === 0
            const pct =
              entry.changeBp === null
                ? ''
                : ` (${up ? '+' : '−'}${Math.abs(Math.round(entry.changeBp / 100))} %)`
            return (
              <li
                key={entry.categoryId ?? 'none'}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    <CategoryIcon icon={category?.icon} className="size-4 shrink-0 text-fg-muted" />
                    <span className="truncate">{category?.name ?? 'Sin categoría'}</span>
                  </span>
                  <span className="tabular text-xs text-fg-muted">
                    {formatMoney(entry.current)} · antes {formatMoney(entry.previous)}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 text-sm font-medium ${
                    entry.change === 0 ? 'text-fg-muted' : up ? 'text-negative' : 'text-positive'
                  }`}
                >
                  {entry.change === 0 ? null : isNew ? (
                    <PlusIcon aria-hidden="true" className="size-4" weight="bold" />
                  ) : up ? (
                    <ArrowUpIcon aria-hidden="true" className="size-4" weight="bold" />
                  ) : (
                    <ArrowDownIcon aria-hidden="true" className="size-4" weight="bold" />
                  )}
                  <span className="tabular">
                    {entry.change === 0
                      ? 'igual'
                      : isNew
                        ? `nueva ${formatMoney(entry.change)}`
                        : gone
                          ? `ya no ${formatMoney(-entry.change)}`
                          : `${up ? 'sube' : 'baja'} ${formatMoney(Math.abs(entry.change))}${pct}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
