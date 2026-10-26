import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type {
  Pocket,
  PocketMove,
  PocketMoveKind,
  ReceivableEntry,
  ReceivableFrequency,
  ReceivableRule,
} from '../types/domain'
import type { PendingCharge } from '../lib/calculations/receivables'

// Bolsillos y cuenta con mamá. Todo privado por RLS.

// --- Bolsillos ------------------------------------------------------------------------------------

export async function fetchMyPockets(householdId: string): Promise<Pocket[]> {
  const rows = unwrap(
    await supabase
      .from('pockets')
      .select('id, name, goal, covers_receivable, sort_order, archived_at')
      .eq('household_id', householdId)
      .order('sort_order')
      .order('created_at'),
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    goal: row.goal,
    coversReceivable: row.covers_receivable,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  }))
}

export interface PocketInput {
  name: string
  goal: number | null
  coversReceivable: boolean
}

/** Crea el bolsillo y, si ya tiene dinero, su saldo inicial como primer depósito. */
export async function createPocket(
  householdId: string,
  input: PocketInput,
  openingBalance: number,
  sortOrder = 0,
): Promise<string> {
  const row = unwrap(
    await supabase
      .from('pockets')
      .insert({
        household_id: householdId,
        name: input.name.trim(),
        goal: input.goal,
        covers_receivable: input.coversReceivable,
        sort_order: sortOrder,
      })
      .select('id')
      .single(),
  )
  if (openingBalance !== 0) {
    await createPocketMove(householdId, {
      pocketId: row.id,
      amount: openingBalance,
      kind: openingBalance > 0 ? 'deposit' : 'withdraw',
      date: null,
      note: 'Saldo inicial',
    })
  }
  return row.id
}

export async function updatePocket(pocketId: string, input: PocketInput): Promise<void> {
  assertOk(
    await supabase
      .from('pockets')
      .update({
        name: input.name.trim(),
        goal: input.goal,
        covers_receivable: input.coversReceivable,
      })
      .eq('id', pocketId),
  )
}

export async function setPocketArchived(pocketId: string, archived: boolean): Promise<void> {
  assertOk(
    await supabase
      .from('pockets')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', pocketId),
  )
}

export async function deletePocket(pocketId: string): Promise<void> {
  assertOk(await supabase.from('pockets').delete().eq('id', pocketId))
}

// --- Movimientos ----------------------------------------------------------------------------------

export async function fetchMyPocketMoves(householdId: string): Promise<PocketMove[]> {
  const rows = unwrap(
    await supabase
      .from('pocket_moves')
      .select('id, pocket_id, amount, kind, move_date, note, link_id')
      .eq('household_id', householdId)
      .order('move_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(2000),
  )
  return rows.map((row) => ({
    id: row.id,
    pocketId: row.pocket_id,
    amount: row.amount,
    kind: row.kind as PocketMoveKind,
    date: row.move_date,
    note: row.note,
    linkId: row.link_id,
  }))
}

export interface PocketMoveInput {
  pocketId: string
  /** Con signo (el tipo decide qué signo es válido). */
  amount: number
  kind: PocketMoveKind
  /** 'YYYY-MM-DD'; null = hoy. */
  date: string | null
  note: string
}

export async function createPocketMove(householdId: string, input: PocketMoveInput): Promise<void> {
  assertOk(
    await supabase.from('pocket_moves').insert({
      household_id: householdId,
      pocket_id: input.pocketId,
      amount: input.amount,
      kind: input.kind,
      ...(input.date ? { move_date: input.date } : {}),
      note: input.note.trim() || null,
    }),
  )
}

export async function movePocketMoney(input: {
  from: string
  to: string
  amount: number
  kind: 'transfer' | 'loan' | 'loan_back'
  date: string | null
  note: string
}): Promise<void> {
  assertOk(
    await supabase.rpc('move_between_pockets', {
      p_from: input.from,
      p_to: input.to,
      p_amount: input.amount,
      p_kind: input.kind,
      ...(input.date ? { p_date: input.date } : {}),
      ...(input.note.trim() ? { p_note: input.note.trim() } : {}),
    }),
  )
}

export async function deletePocketMove(moveId: string): Promise<void> {
  assertOk(await supabase.from('pocket_moves').delete().eq('id', moveId))
}

// --- Cuenta con mamá -----------------------------------------------------------------------------

export async function fetchMyReceivableEntries(householdId: string): Promise<ReceivableEntry[]> {
  const rows = unwrap(
    await supabase
      .from('receivable_entries')
      .select('id, kind, amount, entry_date, note, rule_id')
      .eq('household_id', householdId)
      .order('entry_date', { ascending: false })
      .limit(2000),
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as 'charge' | 'payment',
    amount: row.amount,
    date: row.entry_date,
    note: row.note,
    ruleId: row.rule_id,
  }))
}

export async function createReceivableEntry(
  householdId: string,
  input: { kind: 'charge' | 'payment'; amount: number; date: string; note: string },
): Promise<void> {
  assertOk(
    await supabase.from('receivable_entries').insert({
      household_id: householdId,
      kind: input.kind,
      amount: input.amount,
      entry_date: input.date,
      note: input.note.trim() || null,
    }),
  )
}

export async function deleteReceivableEntry(entryId: string): Promise<void> {
  assertOk(await supabase.from('receivable_entries').delete().eq('id', entryId))
}

export async function fetchMyReceivableRules(householdId: string): Promise<ReceivableRule[]> {
  const rows = unwrap(
    await supabase
      .from('receivable_rules')
      .select('id, label, amount, frequency, starts_on, ends_on, active, generated_until')
      .eq('household_id', householdId)
      .order('created_at'),
  )
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    amount: row.amount,
    frequency: row.frequency as ReceivableFrequency,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    active: row.active,
    generatedUntil: row.generated_until,
  }))
}

export interface ReceivableRuleInput {
  label: string
  amount: number
  frequency: ReceivableFrequency
  startsOn: string
  endsOn: string | null
}

export async function createReceivableRule(
  householdId: string,
  input: ReceivableRuleInput,
): Promise<void> {
  assertOk(
    await supabase.from('receivable_rules').insert({
      household_id: householdId,
      label: input.label.trim(),
      amount: input.amount,
      frequency: input.frequency,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    }),
  )
}

export async function setReceivableRuleActive(ruleId: string, active: boolean): Promise<void> {
  assertOk(await supabase.from('receivable_rules').update({ active }).eq('id', ruleId))
}

export async function deleteReceivableRule(ruleId: string): Promise<void> {
  assertOk(await supabase.from('receivable_rules').delete().eq('id', ruleId))
}

/**
 * Registra los cobros automáticos que ya tocaban. Cada cobro es único por (regla, día), así que si
 * dos pestañas corren a la vez no se duplica. Luego marca la regla como generada hasta hoy.
 */
export async function applyPendingCharges(
  householdId: string,
  pending: PendingCharge[],
  ruleIds: string[],
  today: string,
): Promise<void> {
  if (pending.length > 0) {
    assertOk(
      await supabase.from('receivable_entries').upsert(
        pending.map((charge) => ({
          household_id: householdId,
          kind: 'charge',
          amount: charge.amount,
          entry_date: charge.date,
          note: charge.note,
          rule_id: charge.ruleId,
        })),
        { onConflict: 'rule_id,entry_date', ignoreDuplicates: true },
      ),
    )
  }
  for (const ruleId of ruleIds) {
    assertOk(
      await supabase.from('receivable_rules').update({ generated_until: today }).eq('id', ruleId),
    )
  }
}
