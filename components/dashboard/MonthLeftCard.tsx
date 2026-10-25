import { useState } from 'react'
import { CaretRightIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { memberName, personColor, useHousehold } from '../../app/household-context'
import { formatMonthName } from '../../lib/dates'
import { formatMoney, formatSigned } from '../../lib/money'
import type { PeriodSummary, PersonSummary } from '../../lib/calculations/reports'
import { dailyAllowance, householdRemaining } from '../../lib/calculations/remaining'
import { PersonAvatar } from '../people/PersonColor'
import { Sheet } from '../ui/Sheet'

interface MonthLeftCardProps {
  summary: PeriodSummary
  today: string
}

/** Sin ingresos ni transferencias recibidas no es "se pasó": aún no ha registrado lo que entró. */
const noIncome = (person: PersonSummary) => person.incomes + person.transfersReceived === 0

/** Lo que le queda, con el texto que acompaña al color (nunca va solo). */
function LeftLine({ person, mine }: { person: PersonSummary; mine: boolean }) {
  const data = useHousehold()
  const name = memberName(data, person.userId)
  const over = person.left < 0 && !noIncome(person)

  if (person.left < 0 && noIncome(person))
    return (
      <span className="text-sm text-fg-muted">
        {mine ? 'Aún no registras' : `${name} aún no registra`} ingresos ·{' '}
        {mine ? 'llevas' : 'lleva'}{' '}
        <span className="tabular font-semibold text-fg">{formatMoney(person.share)}</span> en gastos
      </span>
    )
  if (over)
    return (
      <span className="inline-flex items-start gap-1.5 text-sm font-medium text-negative">
        <WarningCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" weight="bold" />
        <span>
          {mine ? 'Gastaste' : `${name} gastó`}{' '}
          <span className="tabular">{formatMoney(-person.left)}</span> más de lo que{' '}
          {mine ? 'te' : 'le'} entró
        </span>
      </span>
    )
  return null
}

/**
 * Inicio: lo que le queda a cada uno este mes (ingresos − su parte de los gastos ± transferencias)
 * y cuánto puede gastar por día. Al tocarla, la cuenta de cada uno.
 */
export function MonthLeftCard({ summary, today }: MonthLeftCardProps) {
  const data = useHousehold()
  const [open, setOpen] = useState(false)
  const monthName = formatMonthName(today)

  const people = summary.people.filter(
    (person) =>
      data.members.find((member) => member.userId === person.userId)?.active ||
      person.incomes + person.share + person.transfersSent + person.transfersReceived > 0,
  )
  const me = people.find((person) => person.userId === data.userId)
  if (!me) return null
  const others = people.filter((person) => person.userId !== data.userId)
  const perDay = dailyAllowance(me.left, today)
  // Rojo solo si de verdad gastó más de lo que entró; sin ingresos registrados no es una alarma.
  const mineStatus = (person: PersonSummary) =>
    person.left < 0 && !noIncome(person) ? 'text-negative' : ''
  const shownLeft = (person: PersonSummary) =>
    person.left < 0 ? formatSigned(person.left) : formatMoney(person.left)

  return (
    <section aria-labelledby="queda-mes">
      <h2 id="queda-mes" className="sr-only">
        Lo que queda este mes
      </h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full flex-col gap-3 rounded-2xl bg-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/50"
      >
        <span className="flex w-full items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
              <PersonAvatar
                name={memberName(data, me.userId)}
                color={personColor(data, me.userId)}
                size="sm"
              />
              Te quedan en {monthName}
            </span>
            <span className={`tabular text-2xl font-semibold tracking-tight ${mineStatus(me)}`}>
              {shownLeft(me)}
            </span>
            {perDay > 0 && (
              <span className="text-sm text-fg-muted">
                ≈ <span className="tabular text-fg">{formatMoney(perDay)}</span> por día hasta fin
                de mes
              </span>
            )}
            <LeftLine person={me} mine />
          </span>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-fg-muted">
            Ver cuenta
            <CaretRightIcon aria-hidden="true" className="size-4" />
          </span>
        </span>
        {others.map((person) => {
          const name = memberName(data, person.userId)
          return (
            <span
              key={person.userId}
              className="flex w-full flex-col gap-1 border-t border-line pt-3"
            >
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <PersonAvatar name={name} color={personColor(data, person.userId)} size="sm" />
                  <span className="truncate">A {name} le quedan</span>
                </span>
                <span className={`tabular font-semibold ${mineStatus(person)}`}>
                  {shownLeft(person)}
                </span>
              </span>
              <LeftLine person={person} mine={false} />
            </span>
          )
        })}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={`Lo que queda en ${monthName}`}>
        <p className="text-sm text-fg-muted">
          Lo que le entró a cada uno este mes menos su parte de cada gasto (también los de tarjeta,
          aunque aún no se hayan pagado), más o menos las transferencias entre ustedes. No incluye
          lo que sobró de meses anteriores: eso está en el saldo disponible.
        </p>
        {[me, ...others].map((person) => {
          const mine = person.userId === data.userId
          const rows = [
            { label: mine ? 'Te entraron' : 'Le entraron', value: person.incomes, show: true },
            {
              label: mine ? 'Tu parte de los gastos' : 'Su parte de los gastos',
              value: -person.share,
              show: true,
            },
            {
              label: mine ? 'Te pasaron' : 'Le pasaron',
              value: person.transfersReceived,
              show: person.transfersReceived > 0,
            },
            {
              label: mine ? 'Pasaste' : 'Pasó a otros',
              value: -person.transfersSent,
              show: person.transfersSent > 0,
            },
          ].filter((row) => row.show)
          return (
            <section key={person.userId} className="flex flex-col gap-2">
              <h3 className="inline-flex items-center gap-2 font-semibold">
                <PersonAvatar
                  name={memberName(data, person.userId)}
                  color={personColor(data, person.userId)}
                  size="sm"
                />
                {memberName(data, person.userId, { you: true })}
              </h3>
              <dl className="flex flex-col divide-y divide-line rounded-xl bg-surface-2 px-4">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-sm">{row.label}</dt>
                    <dd className="tabular text-sm font-semibold">{formatSigned(row.value)}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t-[3px] border-double border-line-strong py-2.5">
                  <dt className="font-semibold">{mine ? 'Te quedan' : 'Le quedan'}</dt>
                  <dd className={`tabular font-semibold ${mineStatus(person)}`}>
                    {shownLeft(person)}
                  </dd>
                </div>
              </dl>
            </section>
          )
        })}
        {others.length > 0 && (
          <p className="flex items-center justify-between gap-4 rounded-xl border border-line-strong px-4 py-3">
            <span className="font-semibold">
              Entre {people.length === 2 ? 'los dos' : 'todos'} les quedan
            </span>
            <span
              className={`tabular font-semibold ${householdRemaining(summary) < 0 ? 'text-negative' : ''}`}
            >
              {householdRemaining(summary) < 0
                ? formatSigned(householdRemaining(summary))
                : formatMoney(householdRemaining(summary))}
            </span>
          </p>
        )}
      </Sheet>
    </section>
  )
}
