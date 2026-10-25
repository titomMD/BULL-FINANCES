import { memberName, nameInSentence, type HouseholdData } from '../../app/household-context'
import { availableEffects, cardEffects } from '../../lib/calculations/available'
import { formatMoney, formatShare, formatSigned } from '../../lib/money'
import type { Expense, Income, Movement, Transfer } from '../../types/domain'

// Textos de presentación de un movimiento (no son cálculos financieros: el efecto en el saldo
// disponible lo da lib/calculations/available; aquí solo se eligen las palabras).

export function movementTitle(movement: Movement): string {
  switch (movement.kind) {
    case 'expense':
      return movement.description
    case 'income':
      return movement.source
    case 'transfer':
      return movement.notes?.trim() || 'Transferencia'
    case 'card_payment':
      return movement.notes?.trim() || 'Pago de tarjeta'
  }
}

export function movementPath(movement: Movement): string {
  const base = {
    expense: '/gastos',
    income: '/ingresos',
    transfer: '/transferencias',
    card_payment: '/tarjeta/pagos',
  }[movement.kind]
  return `${base}/${movement.id}`
}

/** "50/50", "70/30" o "33,33 % / 66,67 %" según la división (en el orden de los miembros). */
export function splitLabel(movement: Expense | Income, data: HouseholdData): string {
  const ordered = [...movement.splits].sort((a, b) => {
    const position = (id: string) => data.members.findIndex((member) => member.userId === id)
    return position(a.userId) - position(b.userId)
  })
  if (ordered.length === 1) {
    return ordered[0].userId === data.userId
      ? 'todo tuyo'
      : `todo de ${memberName(data, ordered[0].userId)}`
  }
  if (ordered.length === 2 && ordered.every((split) => split.shareBp % 100 === 0)) {
    return ordered.map((split) => split.shareBp / 100).join('/')
  }
  if (movement.splitType === 'equal') return 'partes iguales'
  return ordered.map((split) => formatShare(split.shareBp)).join(' / ')
}

/** "Sebastián te pasó dinero" / "Le pasaste dinero a Sebastián" / "Ana le pasó dinero a Beto". */
export function transferSentence(transfer: Transfer, data: HouseholdData): string {
  if (transfer.toUser === data.userId)
    return `${memberName(data, transfer.fromUser)} te pasó dinero`
  if (transfer.fromUser === data.userId)
    return `Le pasaste dinero a ${memberName(data, transfer.toUser)}`
  return `${memberName(data, transfer.fromUser)} le pasó dinero a ${memberName(data, transfer.toUser)}`
}

/** Línea secundaria: quién pagó / recibió y cómo se dividió. */
export function movementDetail(movement: Movement, data: HouseholdData): string {
  switch (movement.kind) {
    case 'expense': {
      const payer =
        movement.paidBy === data.userId ? 'Pagaste' : `Pagó ${memberName(data, movement.paidBy)}`
      // Lo que descuenta de cada saldo va en la línea de efecto (effectText).
      return `${payer} · ${splitLabel(movement, data)}`
    }
    case 'income': {
      const receiver =
        movement.userId === data.userId
          ? 'Recibiste'
          : `Recibió ${nameInSentence(data, movement.userId)}`
      if (movement.splits.length > 1)
        return `${receiver} · compartido ${splitLabel(movement, data)}`
      const owner = movement.splits[0]?.userId ?? movement.userId
      if (owner === movement.userId)
        return owner === data.userId ? 'Tu ingreso' : `Ingreso de ${memberName(data, owner)}`
      return `${receiver} · ${splitLabel(movement, data)}`
    }
    case 'transfer':
      return movement.notes?.trim() ? 'Transferencia' : 'Transferencia entre ustedes'
    case 'card_payment':
      return movement.userId === data.userId
        ? 'Pagaste tu parte de la tarjeta'
        : `${memberName(data, movement.userId)} pagó su parte de la tarjeta`
  }
}

export interface EffectText {
  /** Se unen con " · "; cada pieza ("Nicolás −$15.000") no se parte al cambiar de línea. */
  parts: string[]
  /** Verde: sube tu saldo. Rojo: lo baja. Neutro: no lo toca o está anulado. */
  tone: 'positive' | 'negative' | 'neutral'
}

/**
 * Qué le hizo un movimiento al saldo disponible de cada uno, en una línea:
 * "Tu saldo −$15.000 · Nicolás −$15.000". Los montos los da lib/calculations/available.
 */
export function effectText(movement: Movement, data: HouseholdData): EffectText {
  if (movement.status === 'voided') return { parts: ['Anulado: no cuenta'], tone: 'neutral' }
  const effects = availableEffects(movement)
  const mine = effects.get(data.userId) ?? 0
  const order = (id: string) =>
    id === data.userId ? -1 : data.members.findIndex((member) => member.userId === id)

  // Gasto con tarjeta: no toca el saldo todavía, queda por pagar.
  if (movement.kind === 'expense' && movement.paidWithCard) {
    const owed = [...cardEffects(movement)]
      .filter(([, amount]) => amount !== 0)
      .sort(([a], [b]) => order(a) - order(b))
      .map(([userId, amount]) =>
        userId === data.userId
          ? `tú ${formatMoney(amount)}`
          : `${memberName(data, userId)} ${formatMoney(amount)}`,
      )
    return { parts: ['Por pagar de tarjeta', ...owed], tone: 'neutral' }
  }

  const parts = [...effects]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => order(a) - order(b))
    .map(([userId, amount]) =>
      userId === data.userId
        ? `Tu saldo ${formatSigned(amount)}`
        : `${memberName(data, userId)} ${formatSigned(amount)}`,
    )
  if (parts.length === 0) return { parts: ['No cambia ningún saldo'], tone: 'neutral' }
  if (mine === 0) parts.push('el tuyo no cambia')
  return { parts, tone: mine > 0 ? 'positive' : mine < 0 ? 'negative' : 'neutral' }
}
