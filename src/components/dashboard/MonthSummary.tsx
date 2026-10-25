import { Link } from 'react-router'
import { memberName, personColor, useHousehold } from '../../app/household-context'
import { formatMonthName } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import type { PeriodSummary } from '../../lib/calculations/reports'
import { PersonAvatar } from '../people/PersonColor'
import { personBg } from '../people/personClasses'

interface MonthSummaryProps {
  summary: PeriodSummary
  month: string
}

/** Gastos del mes: cuánto se gastó, quién lo pagó y cuánto le tocaba a cada uno (spec §17, §20). */
export function MonthSummary({ summary, month }: MonthSummaryProps) {
  const data = useHousehold()
  const monthName = formatMonthName(month)
  const people = summary.people.filter(
    (person) =>
      data.members.find((member) => member.userId === person.userId)?.active ||
      person.paid + person.incomes + person.transfersSent > 0,
  )
  const maxPaid = Math.max(1, ...people.map((person) => person.paid))

  return (
    <section aria-labelledby="mes" className="rounded-2xl bg-surface p-(--card-p)">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mes" className="text-base font-semibold">
          Gastos de {monthName}
        </h2>
        <Link
          to="/reportes"
          className="-my-2 inline-flex min-h-11 items-center text-sm font-medium text-fg-muted hover:text-fg"
        >
          Ver reportes
        </Link>
      </div>
      <p className="mt-3 text-sm text-fg-muted">
        Gastado entre {people.length === 2 ? 'los dos' : 'todos'}
      </p>
      <p className="tabular text-3xl font-semibold tracking-tight">
        {formatMoney(summary.totalExpenses)}
      </p>

      <ul className="mt-5 flex flex-col gap-4">
        {people.map((person) => (
          <li key={person.userId} className="flex flex-col gap-1.5">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 font-medium">
                <PersonAvatar
                  name={memberName(data, person.userId)}
                  color={personColor(data, person.userId)}
                  size="sm"
                />
                {memberName(data, person.userId, { you: true })}
              </span>
              <span className="tabular">
                {person.userId === data.userId ? 'pagaste' : 'pagó'}{' '}
                <span className="font-semibold">{formatMoney(person.paid)}</span>
              </span>
            </p>
            {person.paid > 0 && (
              <div
                aria-hidden="true"
                className={`h-1.5 rounded-full ${personBg[personColor(data, person.userId)]}`}
                style={{ width: `${(person.paid / maxPaid) * 100}%` }}
              />
            )}
            <p className="tabular text-xs text-fg-muted">
              {person.userId === data.userId ? 'tu parte' : 'su parte'} {formatMoney(person.share)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
