import { useId } from 'react'
import { CheckIcon } from '@phosphor-icons/react'
import { allocateAmounts, equalShares } from '../../lib/calculations/splits'
import { formatMoney, parsePercentToBp } from '../../lib/money'
import type { Member } from '../../types/domain'
import { controlClasses } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import type { SplitFormValues } from './split'

interface SplitEditorProps {
  value: SplitFormValues
  onChange: (value: SplitFormValues) => void
  /** Monto ya interpretado (null si aún no es válido): solo para la vista previa. */
  amount: number | null
  members: Member[]
  meId: string
  error?: string
  percentErrors?: Record<string, string | undefined>
}

const presets = [5000, 6000, 7000, 10000]

/** División de un gasto o ingreso: partes iguales entre quienes participan o porcentajes que suman 100 %. */
export function SplitEditor({
  value,
  onChange,
  amount,
  members,
  meId,
  error,
  percentErrors = {},
}: SplitEditorProps) {
  const errorId = useId()
  const active = members.filter((member) => member.active)
  const name = (member: Member) => (member.userId === meId ? 'Tú' : member.displayName)

  const shares =
    value.splitType === 'equal'
      ? equalShares(value.participants)
      : active.map((member) => ({
          userId: member.userId,
          shareBp: parsePercentToBp(value.percents[member.userId] || '0') ?? 0,
        }))
  const preview = new Map(
    amount ? allocateAmounts(amount, shares).map((entry) => [entry.userId, entry.amount]) : [],
  )
  const totalBp = shares.reduce((sum, share) => sum + share.shareBp, 0)

  const setPercent = (userId: string, raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, '').slice(0, 6)
    const percents = { ...value.percents, [userId]: cleaned }
    // Con dos personas, el otro porcentaje se completa solo.
    if (active.length === 2) {
      const other = active.find((member) => member.userId !== userId)
      const bp = parsePercentToBp(cleaned || '0')
      if (other && bp !== null)
        percents[other.userId] = ((10000 - bp) / 100).toLocaleString('es-CO', {
          maximumFractionDigits: 2,
          useGrouping: false,
        })
    }
    onChange({ ...value, percents })
  }

  const applyPreset = (firstBp: number) => {
    const [first, second] = active
    onChange({
      ...value,
      percents: {
        ...value.percents,
        [first.userId]: String(firstBp / 100),
        [second.userId]: String((10000 - firstBp) / 100),
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="¿Cómo se divide?"
        value={value.splitType}
        onChange={(splitType) => onChange({ ...value, splitType })}
        options={[
          { value: 'equal', label: 'Partes iguales' },
          { value: 'percentage', label: 'Porcentaje' },
        ]}
      />

      {value.splitType === 'equal' ? (
        <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-fg">¿Entre quiénes?</legend>
          {active.map((member) => {
            const checked = value.participants.includes(member.userId)
            return (
              <label
                key={member.userId}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...value,
                      participants: checked
                        ? value.participants.filter((id) => id !== member.userId)
                        : [...value.participants, member.userId],
                    })
                  }
                />
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-md border ${
                    checked ? 'border-primary bg-primary text-on-primary' : 'border-line-strong'
                  }`}
                >
                  {checked && <CheckIcon className="size-3.5" weight="bold" />}
                </span>
                <span className="flex-1 font-medium">{name(member)}</span>
                <span
                  data-not-money={!checked || undefined}
                  className="tabular text-sm text-fg-muted"
                >
                  {!checked
                    ? 'no participa'
                    : `${member.userId === meId ? 'te toca' : 'le toca'} ${
                        preview.has(member.userId) ? formatMoney(preview.get(member.userId)!) : '—'
                      }`}
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : (
        <div className="flex flex-col gap-3">
          {active.length === 2 && (
            <div role="group" aria-label="Divisiones rápidas" className="flex flex-wrap gap-2">
              {presets.map((bp) => (
                <button
                  key={bp}
                  type="button"
                  onClick={() => applyPreset(bp)}
                  className="h-11 rounded-full bg-surface-2 px-4 tabular text-sm font-medium hover:bg-line-strong"
                >
                  {bp / 100}/{(10000 - bp) / 100}
                </button>
              ))}
            </div>
          )}
          {active.map((member) => (
            <div key={member.userId} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <label htmlFor={`pct-${member.userId}`} className="flex-1 font-medium">
                  {name(member)}
                </label>
                <span className="tabular text-sm text-fg-muted">
                  {preview.has(member.userId) ? formatMoney(preview.get(member.userId)!) : ''}
                </span>
                <div className="relative w-28">
                  <input
                    id={`pct-${member.userId}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={value.percents[member.userId] ?? ''}
                    onChange={(event) => setPercent(member.userId, event.target.value)}
                    aria-label={`Porcentaje de ${name(member)}`}
                    aria-invalid={Boolean(percentErrors[member.userId])}
                    aria-describedby={
                      percentErrors[member.userId] ? `pct-error-${member.userId}` : undefined
                    }
                    className={`${controlClasses} h-12 pr-8 text-right tabular`}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted"
                  >
                    %
                  </span>
                </div>
              </div>
              {percentErrors[member.userId] && (
                <p id={`pct-error-${member.userId}`} className="text-right text-sm text-negative">
                  {percentErrors[member.userId]}
                </p>
              )}
            </div>
          ))}
          <p
            data-not-money
            className={`text-right tabular text-sm ${totalBp === 10000 ? 'text-fg-muted' : 'text-negative'}`}
          >
            Total {(totalBp / 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %
            {totalBp === 10000 ? '' : ' (debe ser 100 %)'}
          </p>
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  )
}
