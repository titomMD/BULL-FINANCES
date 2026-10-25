import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap, unwrapMaybe } from '../lib/errors'
import type { Budget, BudgetKind, BudgetPeriod } from '../types/domain'

// Presupuestos personales. RLS solo deja ver y tocar los de quien está conectado.

const BUDGET_COLUMNS =
  'id, name, kind, category_id, amount, period, created_at, budget_expenses(expense_id)'

export async function fetchMyBudgets(householdId: string): Promise<Budget[]> {
  const rows =
    unwrapMaybe(
      await supabase
        .from('budgets')
        .select(BUDGET_COLUMNS)
        .eq('household_id', householdId)
        .order('created_at', { ascending: true }),
    ) ?? []
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as BudgetKind,
    categoryId: row.category_id,
    amount: row.amount,
    period: row.period as BudgetPeriod,
    createdAt: row.created_at,
    expenseIds: row.budget_expenses.map((entry) => entry.expense_id),
  }))
}

export interface BudgetInput {
  name: string
  kind: BudgetKind
  categoryId: string | null
  amount: number
  period: BudgetPeriod
}

const budgetRow = (input: BudgetInput) => ({
  name: input.name.trim(),
  kind: input.kind,
  category_id: input.kind === 'category' ? input.categoryId : null,
  amount: input.amount,
  period: input.period,
})

export async function createBudget(householdId: string, input: BudgetInput): Promise<string> {
  const { id } = unwrap(
    await supabase
      .from('budgets')
      .insert({ household_id: householdId, ...budgetRow(input) })
      .select('id')
      .single(),
  )
  return id
}

export async function updateBudget(budgetId: string, input: BudgetInput): Promise<void> {
  assertOk(await supabase.from('budgets').update(budgetRow(input)).eq('id', budgetId))
}

export async function deleteBudget(budgetId: string): Promise<void> {
  assertOk(await supabase.from('budgets').delete().eq('id', budgetId))
}

/** Reemplaza en cuáles de tus presupuestos libres cuenta un gasto. */
export async function setExpenseBudgets(expenseId: string, budgetIds: string[]): Promise<void> {
  assertOk(
    await supabase.rpc('set_expense_budgets', {
      p_expense_id: expenseId,
      p_budget_ids: budgetIds,
    }),
  )
}
