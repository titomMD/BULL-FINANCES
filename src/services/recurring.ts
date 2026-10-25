import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type { Frequency, RecurringExpense, SplitInput, SplitType } from '../types/domain'

export async function fetchRecurring(householdId: string): Promise<RecurringExpense[]> {
  const rows = unwrap(
    await supabase
      .from('recurring_expenses')
      .select(
        'id, name, amount, currency, frequency, next_due_date, category_id, paid_by, split_type, notes, paid_with_card, active, created_by, created_at, updated_by, updated_at, recurring_expense_splits(user_id, share_bp)',
      )
      .eq('household_id', householdId)
      .order('next_due_date'),
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    frequency: row.frequency as Frequency,
    nextDueDate: row.next_due_date,
    categoryId: row.category_id,
    paidBy: row.paid_by,
    splitType: row.split_type as SplitType,
    splits: row.recurring_expense_splits.map((split) => ({
      userId: split.user_id,
      shareBp: split.share_bp,
    })),
    notes: row.notes,
    paidWithCard: row.paid_with_card,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }))
}

export interface RecurringInput {
  name: string
  amount: number
  frequency: Frequency
  nextDueDate: string
  categoryId: string
  paidBy: string
  split: SplitInput
  notes: string
  paidWithCard: boolean
  active: boolean
}

function splitParams(split: SplitInput) {
  return split.type === 'equal'
    ? { p_split_type: 'equal', p_participants: split.participants }
    : {
        p_split_type: 'percentage',
        p_participants: split.shares.map((share) => ({
          user_id: share.userId,
          share_bp: share.shareBp,
        })),
      }
}

export async function createRecurring(householdId: string, input: RecurringInput): Promise<string> {
  return unwrap(
    await supabase.rpc('create_recurring_expense', {
      p_household_id: householdId,
      p_name: input.name,
      p_amount: input.amount,
      p_frequency: input.frequency,
      p_next_due_date: input.nextDueDate,
      p_category_id: input.categoryId,
      p_paid_by: input.paidBy,
      p_notes: input.notes,
      p_paid_with_card: input.paidWithCard,
      ...splitParams(input.split),
    }),
  )
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<void> {
  assertOk(
    await supabase.rpc('update_recurring_expense', {
      p_recurring_expense_id: id,
      p_name: input.name,
      p_amount: input.amount,
      p_frequency: input.frequency,
      p_next_due_date: input.nextDueDate,
      p_category_id: input.categoryId,
      p_paid_by: input.paidBy,
      p_notes: input.notes,
      p_active: input.active,
      p_paid_with_card: input.paidWithCard,
      ...splitParams(input.split),
    }),
  )
}

export async function deleteRecurring(id: string): Promise<void> {
  assertOk(await supabase.from('recurring_expenses').delete().eq('id', id))
}

/** Confirma la ocurrencia vencida: crea el gasto y adelanta la próxima fecha (atómico). */
export async function generateRecurring(
  id: string,
  options: { amount?: number; date?: string } = {},
): Promise<string> {
  return unwrap(
    await supabase.rpc('generate_recurring_expense', {
      p_recurring_expense_id: id,
      p_amount: options.amount,
      p_date: options.date,
    }),
  )
}

export async function skipRecurring(id: string): Promise<void> {
  assertOk(await supabase.rpc('skip_recurring_expense', { p_recurring_expense_id: id }))
}
