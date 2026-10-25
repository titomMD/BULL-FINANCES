// Reparto de un monto entre personas. La autoridad es la base de datos
// (private.allocate_split_amounts); esta copia solo sirve para la vista previa del formulario
// y replica exactamente el mismo algoritmo: floor(monto · bp / 10000) y los pesos sobrantes,
// uno a uno, por mayor resto y, a igualdad, por user_id.

export interface Share {
  userId: string
  shareBp: number
}

export interface Allocation extends Share {
  amount: number
}

export function allocateAmounts(amount: number, shares: ReadonlyArray<Share>): Allocation[] {
  const base = shares.map((share) => {
    const product = amount * share.shareBp
    return {
      ...share,
      floor: Math.floor(product / 10000),
      remainder: product % 10000,
    }
  })
  const leftover = amount - base.reduce((sum, entry) => sum + entry.floor, 0)
  const ranked = [...base].sort(
    (a, b) => b.remainder - a.remainder || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  )
  const bonus = new Set(ranked.slice(0, Math.max(0, leftover)).map((entry) => entry.userId))
  return base.map(({ userId, shareBp, floor }) => ({
    userId,
    shareBp,
    amount: floor + (bonus.has(userId) ? 1 : 0),
  }))
}

/** Partes iguales en puntos básicos; los puntos sobrantes van a los primeros por user_id. */
export function equalShares(userIds: ReadonlyArray<string>): Share[] {
  const sorted = [...new Set(userIds)].sort()
  const count = sorted.length
  if (count === 0) return []
  return sorted.map((userId, index) => ({
    userId,
    shareBp: Math.floor(10000 / count) + (index < 10000 % count ? 1 : 0),
  }))
}
