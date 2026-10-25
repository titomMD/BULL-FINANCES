import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type { PlanCheck, PlanEntry, PlanItem, PlanKind } from '../types/domain'

// Plan del mes. RLS solo deja ver y tocar las líneas de quien está conectado.

const PLAN_COLUMNS =
  'id, kind, name, group_name, amount, currency, starts_on, ends_on, sort_order, tracked'

export async function fetchMyPlan(householdId: string): Promise<PlanItem[]> {
  const rows = unwrap(
    await supabase
      .from('plan_items')
      .select(PLAN_COLUMNS)
      .eq('household_id', householdId)
      .order('sort_order')
      .order('created_at'),
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as PlanKind,
    name: row.name,
    groupName: row.group_name,
    amount: row.amount,
    currency: row.currency,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    sortOrder: row.sort_order,
    tracked: row.tracked,
  }))
}

export interface PlanItemInput {
  name: string
  groupName: string | null
  amount: number
  /** 'YYYY-MM-DD' (primer día del mes) o null. */
  startsOn: string | null
  /** 'YYYY-MM-DD' (último día del mes) o null. */
  endsOn: string | null
  /** Lleva registro de gastos (tanqueadas). Opcional: por defecto no. */
  tracked?: boolean
}

const planRow = (input: PlanItemInput) => ({
  name: input.name.trim(),
  group_name: input.groupName?.trim() || null,
  amount: input.amount,
  starts_on: input.startsOn,
  ends_on: input.endsOn,
  ...(input.tracked === undefined ? {} : { tracked: input.tracked }),
})

export async function createPlanItem(
  householdId: string,
  kind: PlanKind,
  input: PlanItemInput,
  sortOrder = 0,
): Promise<void> {
  assertOk(
    await supabase
      .from('plan_items')
      .insert({ household_id: householdId, kind, sort_order: sortOrder, ...planRow(input) }),
  )
}

export async function createPlanItems(
  householdId: string,
  items: Array<{ kind: PlanKind } & PlanItemInput>,
): Promise<void> {
  assertOk(
    await supabase.from('plan_items').insert(
      items.map(({ kind, ...input }, index) => ({
        household_id: householdId,
        kind,
        sort_order: index,
        ...planRow(input),
      })),
    ),
  )
}

export async function updatePlanItem(itemId: string, input: PlanItemInput): Promise<void> {
  assertOk(await supabase.from('plan_items').update(planRow(input)).eq('id', itemId))
}

export async function deletePlanItem(itemId: string): Promise<void> {
  assertOk(await supabase.from('plan_items').delete().eq('id', itemId))
}

// --- Pagos marcados -------------------------------------------------------------------------

export async function fetchMyChecks(householdId: string): Promise<PlanCheck[]> {
  const rows = unwrap(
    await supabase
      .from('plan_checks')
      .select('id, plan_item_id, month, paid_amount')
      .eq('household_id', householdId),
  )
  return rows.map((row) => ({
    id: row.id,
    planItemId: row.plan_item_id,
    month: row.month,
    paidAmount: row.paid_amount,
  }))
}

export async function markPaid(
  householdId: string,
  itemId: string,
  month: string,
  paidAmount: number | null = null,
): Promise<void> {
  const result = await supabase
    .from('plan_checks')
    .insert({ household_id: householdId, plan_item_id: itemId, month, paid_amount: paidAmount })
  // Ya estaba marcado (dos toques seguidos): no es un error.
  if (result.error && result.error.code !== '23505') throw result.error
}

/**
 * Marca una línea como pagada con el valor realmente cobrado (p. ej. la cuota de manejo del
 * extracto). Si ya estaba marcada, se reemplaza para guardar el valor nuevo.
 */
export async function setPaidAmount(
  householdId: string,
  itemId: string,
  month: string,
  paidAmount: number,
): Promise<void> {
  assertOk(
    await supabase.from('plan_checks').delete().eq('plan_item_id', itemId).eq('month', month),
  )
  await markPaid(householdId, itemId, month, paidAmount)
}

export async function unmarkPaid(checkId: string): Promise<void> {
  assertOk(await supabase.from('plan_checks').delete().eq('id', checkId))
}

// --- Tanqueadas / gastos de una línea -------------------------------------------------------

export async function fetchMyEntries(householdId: string): Promise<PlanEntry[]> {
  const rows = unwrap(
    await supabase
      .from('plan_entries')
      .select('id, plan_item_id, entry_date, amount, note')
      .eq('household_id', householdId)
      .order('entry_date', { ascending: false })
      .limit(1000),
  )
  return rows.map((row) => ({
    id: row.id,
    planItemId: row.plan_item_id,
    date: row.entry_date,
    amount: row.amount,
    note: row.note,
  }))
}

export interface PlanEntryInput {
  date: string
  amount: number
  note: string
}

export async function createPlanEntry(
  householdId: string,
  itemId: string,
  input: PlanEntryInput,
): Promise<void> {
  assertOk(
    await supabase.from('plan_entries').insert({
      household_id: householdId,
      plan_item_id: itemId,
      entry_date: input.date,
      amount: input.amount,
      note: input.note.trim() || null,
    }),
  )
}

export async function deletePlanEntry(entryId: string): Promise<void> {
  assertOk(await supabase.from('plan_entries').delete().eq('id', entryId))
}

/** Cambia el nombre del grupo de todos los gastos que lo tienen (p. ej. «Tarjeta» → «Membresías»). */
export async function renamePlanGroup(
  householdId: string,
  from: string,
  to: string,
): Promise<void> {
  assertOk(
    await supabase
      .from('plan_items')
      .update({ group_name: to.trim() })
      .eq('household_id', householdId)
      .eq('group_name', from),
  )
}

/** Activa o desactiva el registro de gastos (tanqueadas) de una línea. */
export async function setTracked(itemId: string, tracked: boolean): Promise<void> {
  assertOk(await supabase.from('plan_items').update({ tracked }).eq('id', itemId))
}
