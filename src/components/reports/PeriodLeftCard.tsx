import { CreditCardIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { memberName, personColor, useHousehold } from '../../app/household-context'
import { formatMoney, formatSigned } from '../../lib/money'
import { periodRemaining } from '../../lib/calculations/remaining'
import type { PeriodSummary, PersonSummary } from '../../lib/calculations/reports'
import { PersonAvatar } from '../people/PersonColor'

interface PeriodLeftCardProps {
  summary: PeriodSummary
  people: PersonSummary[]
  /** "Este mes", "Últimos 3 meses"... */
  periodLabel: string
}

const percent = (bp: number) => `${Math.floor(bp / 100)} %`

/**
 * Reportes, arriba: Ingresos − Gastos = Queda del periodo, el % del ingreso gastado y lo que le
 * queda a cada uno con la misma regla (remaining.ts).
 */
export function PeriodLeftCard({ summary, people, periodLabel }: PeriodLeftCardProps) {
  const data = useHousehold()
  const { incomes, expenses, left, spentBp } = periodRemaining(summary)
  const over = left < 0 && incomes > 0

  return (
    <section
      aria-labelledby="queda-periodo"
      className="grid gap-6 rounded-2xl bg-surface p-(--card-p) lg:grid-cols-2 lg:gap-10"
    >
      <div className="flex flex-col gap-4">
        <h2 id="queda-periodo" className="text-base font-semibold">
          Lo que queda · <span className="font-normal text-fg-muted">{periodLabel}</span>
        </h2>
        <dl className="flex flex-col">
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-fg-muted">Ingresos</dt>
            <dd className="tabular text-lg font-semibold">{formatMoney(incomes)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-fg-muted">
              <span aria-hidden="true">− </span>Gastos
            </dt>
            <dd className="tabular text-lg font-semibold">{formatMoney(expenses)}</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t-[3px] border-double border-line-strong pt-2.5">
            <dt className="font-semibold">
              <span aria-hidden="true">= </span>Queda
            </dt>
            <dd
              className={`tabular text-3xl font-semibold tracking-tight ${over ? 'text-negative' : ''}`}
            >
              {left < 0 ? formatSigned(left) : formatMoney(left)}
            </dd>
          </div>
        </dl>

        {spentBp === null ? (
          <p className="text-sm text-fg-muted">
            No hay ingresos registrados en este periodo: no hay con qué comparar lo gastado.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div
              role="meter"
              aria-label="Porcentaje del ingreso gastado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.floor(spentBp / 100))}
              aria-valuetext={`${percent(spentBp)} del ingreso gastado`}
              className="h-2 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={`h-full rounded-full ${over ? 'bg-negative' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, spentBp / 100)}%` }}
              />
            </div>
            <p className={`text-sm ${over ? 'font-medium text-negative' : 'text-fg-muted'}`}>
              {over ? (
                <span className="inline-flex items-start gap-1.5">
                  <WarningCircleIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                    weight="bold"
                  />
                  Gastaron el {percent(spentBp)} de lo que entró: {formatMoney(-left)} de más.
                </span>
              ) : (
                <>
                  Gastaron el <span className="tabular text-fg">{percent(spentBp)}</span> de lo que
                  entró.
                </>
              )}
            </p>
          </div>
        )}
        {summary.cardExpenses > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
            <CreditCardIcon aria-hidden="true" className="size-4" />
            De los gastos, con tarjeta{' '}
            <span className="tabular font-semibold text-fg">
              {formatMoney(summary.cardExpenses)}
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg-muted">A cada uno</h3>
        <ul className="flex flex-col divide-y divide-line">
          {people.map((person) => {
            const mine = person.userId === data.userId
            const name = memberName(data, person.userId)
            const negative = person.left < 0 && person.incomes + person.transfersReceived > 0
            return (
              <li key={person.userId} className="flex flex-col gap-1 py-3 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <PersonAvatar name={name} color={personColor(data, person.userId)} size="sm" />
                    {memberName(data, person.userId, { you: true })}
                  </span>
                  <span className={`tabular font-semibold ${negative ? 'text-negative' : ''}`}>
                    {person.left < 0 ? formatSigned(person.left) : formatMoney(person.left)}
                  </span>
                </div>
                <p className="flex flex-wrap gap-x-3 tabular text-xs text-fg-muted">
                  <span>
                    {mine ? 'te entró' : 'le entró'} {formatMoney(person.incomes)}
                  </span>
                  <span>
                    − {mine ? 'tu' : 'su'} parte {formatMoney(person.share)}
                  </span>
                  {person.transfersReceived > 0 && (
                    <span>+ recibió {formatMoney(person.transfersReceived)}</span>
                  )}
                  {person.transfersSent > 0 && (
                    <span>− envió {formatMoney(person.transfersSent)}</span>
                  )}
                </p>
                {negative && (
                  <p className="inline-flex items-start gap-1.5 text-xs font-medium text-negative">
                    <WarningCircleIcon
                      aria-hidden="true"
                      className="mt-px size-3.5 shrink-0"
                      weight="bold"
                    />
                    {mine ? 'Gastaste' : `${name} gastó`} {formatMoney(-person.left)} más de lo que{' '}
                    {mine ? 'te' : 'le'} entró
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-fg-muted">
          A cada uno: lo que le entró menos su parte de cada gasto, más o menos las transferencias.
          Las transferencias no son gasto: entre los dos se anulan.
        </p>
      </div>
    </section>
  )
}
