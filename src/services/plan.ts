import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type { PlanItem, PlanKind } from '../types/domain'

// Plan del mes. RLS solo deja ver y tocar las líneas de quien está conectado.

const PLAN_COLUMNS = 'id, kind, name, group_name, amount, currency, starts_on, ends_on, sort_order'

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
}

const planRow = (input: PlanItemInput) => ({
  name: input.name.trim(),
  group_name: input.groupName?.trim() || null,
  amount: input.amount,
  starts_on: input.startsOn,
  ends_on: input.endsOn,
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
