import { parsePercentToBp } from '../../lib/money'
import type { Member, SplitInput, SplitType } from '../../types/domain'

export interface SplitFormValues {
  splitType: SplitType
  participants: string[]
  percents: Record<string, string>
}

/** Valores del formulario → división para la RPC. */
export function splitFromForm(values: SplitFormValues): SplitInput {
  if (values.splitType === 'equal') return { type: 'equal', participants: values.participants }
  return {
    type: 'percentage',
    shares: Object.entries(values.percents)
      .map(([userId, raw]) => ({ userId, shareBp: parsePercentToBp(raw || '0') ?? 0 }))
      .filter((share) => share.shareBp > 0),
  }
}

/** División guardada → valores del formulario. */
export function splitToForm(
  splitType: SplitType,
  shares: ReadonlyArray<{ userId: string; shareBp: number }>,
  members: ReadonlyArray<Member>,
): SplitFormValues {
  const percents: Record<string, string> = {}
  for (const member of members.filter((entry) => entry.active)) percents[member.userId] = '0'
  for (const share of shares)
    percents[share.userId] = (share.shareBp / 100).toLocaleString('es-CO', {
      maximumFractionDigits: 2,
      useGrouping: false,
    })
  return {
    splitType,
    participants: splitType === 'equal' ? shares.map((share) => share.userId) : activeIds(members),
    percents,
  }
}

export function activeIds(members: ReadonlyArray<Member>): string[] {
  return members.filter((member) => member.active).map((member) => member.userId)
}

/** División por defecto: partes iguales entre los miembros activos. */
export function defaultSplit(members: ReadonlyArray<Member>): SplitFormValues {
  const ids = activeIds(members)
  const percents = Object.fromEntries(
    ids.map((id, index) => [id, ids.length === 2 ? '50' : index === 0 ? '100' : '0']),
  )
  return { splitType: 'equal', participants: ids, percents }
}
