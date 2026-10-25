import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap, unwrapMaybe } from '../lib/errors'
import type {
  Expense,
  Income,
  Movement,
  RecordStatus,
  SplitInput,
  SplitType,
  Transfer,
  CardPayment,
} from '../types/domain'

// PostgREST devuelve como máximo 1000 filas por petición (max_rows): se pagina hasta el final.
const PAGE_SIZE = 1000

export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[]; error: null } | { data: null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = (unwrapMaybe(await fetchPage(from, from + PAGE_SIZE - 1)) ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}

const audit = (row: {
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}) => ({
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
})

const EXPENSE_COLUMNS =
  'id, description, amount, currency, date, category_id, paid_by, split_type, notes, paid_with_card, status, recurring_expense_id, created_by, created_at, updated_by, updated_at, expense_splits(user_id, share_bp, amount), expense_categories(category_id)'
const INCOME_COLUMNS =
  'id, user_id, source, amount, currency, date, category_id, split_type, notes, status, created_by, created_at, updated_by, updated_at, income_splits(user_id, share_bp, amount)'
const CARD_PAYMENT_COLUMNS =
  'id, user_id, amount, currency, date, notes, status, created_by, created_at, updated_by, updated_at'
const TRANSFER_COLUMNS =
  'id, from_user, to_user, amount, currency, date, notes, status, created_by, created_at, updated_by, updated_at'

/**
 * Todos los movimientos del household (activos y anulados), del más reciente al más antiguo.
 * El saldo necesita el historial completo, así que una sola carga sirve a todas las pantallas.
 */
export async function fetchAllMovements(householdId: string): Promise<Movement[]> {
  const [expenses, incomes, transfers, cardPayments] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from('expenses')
        .select(EXPENSE_COLUMNS)
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('incomes')
        .select(INCOME_COLUMNS)
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('transfers')
        .select(TRANSFER_COLUMNS)
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from('card_payments')
        .select(CARD_PAYMENT_COLUMNS)
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
  ])

  const movements: Movement[] = [
    ...expenses.map((row): Expense => ({
      kind: 'expense',
      id: row.id,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      categoryId: row.category_id,
      extraCategoryIds: row.expense_categories
        .map((entry) => entry.category_id)
        .filter((id) => id !== row.category_id),
      paidBy: row.paid_by,
      splitType: row.split_type as SplitType,
      paidWithCard: row.paid_with_card,
      splits: row.expense_splits.map((split) => ({
        userId: split.user_id,
        shareBp: split.share_bp,
        amount: split.amount,
      })),
      notes: row.notes,
      status: row.status as RecordStatus,
      recurringExpenseId: row.recurring_expense_id,
      ...audit(row),
    })),
    ...incomes.map((row): Income => ({
      kind: 'income',
      id: row.id,
      userId: row.user_id,
      source: row.source,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      categoryId: row.category_id,
      splitType: row.split_type as SplitType,
      splits: row.income_splits.map((split) => ({
        userId: split.user_id,
        shareBp: split.share_bp,
        amount: split.amount,
      })),
      notes: row.notes,
      status: row.status as RecordStatus,
      ...audit(row),
    })),
    ...transfers.map((row): Transfer => ({
      kind: 'transfer',
      id: row.id,
      fromUser: row.from_user,
      toUser: row.to_user,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      notes: row.notes,
      status: row.status as RecordStatus,
      ...audit(row),
    })),
    ...cardPayments.map((row): CardPayment => ({
      kind: 'card_payment',
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      notes: row.notes,
      status: row.status as RecordStatus,
      ...audit(row),
    })),
  ]

  return movements.sort(compareMovementsDesc)
}

/** Orden del libro: fecha descendente y, dentro del día, el último registrado primero. */
export function compareMovementsDesc(a: Movement, b: Movement): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return a.id < b.id ? 1 : -1
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

// ---------------------------------------------------------------------------
// Gastos (RPC atómicas: gasto + splits en una transacción)
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  description: string
  amount: number
  date: string
  /** La primera es la principal; las demás van como adicionales. */
  categoryIds: string[]
  paidBy: string
  split: SplitInput
  notes: string
  paidWithCard: boolean
}

function categoryParams(input: ExpenseInput) {
  const [primary, ...extra] = input.categoryIds
  return {
    p_category_id: primary,
    p_extra_category_ids: extra,
    p_paid_with_card: input.paidWithCard,
  }
}

export async function createExpense(householdId: string, input: ExpenseInput): Promise<string> {
  return unwrap(
    await supabase.rpc('create_expense', {
      p_household_id: householdId,
      p_description: input.description,
      p_amount: input.amount,
      p_paid_by: input.paidBy,
      p_date: input.date,
      p_notes: input.notes,
      ...categoryParams(input),
      ...splitParams(input.split),
    }),
  )
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  assertOk(
    await supabase.rpc('update_expense', {
      p_expense_id: expenseId,
      p_description: input.description,
      p_amount: input.amount,
      ...categoryParams(input),
      p_paid_by: input.paidBy,
      p_date: input.date,
      p_notes: input.notes,
      ...splitParams(input.split),
    }),
  )
}

export async function voidExpense(expenseId: string): Promise<void> {
  assertOk(await supabase.rpc('void_expense', { p_expense_id: expenseId }))
}

// ---------------------------------------------------------------------------
// Ingresos (RPC atómicas: ingreso + reparto). Cualquier miembro registra los de cualquiera.
// ---------------------------------------------------------------------------

export interface IncomeInput {
  /** Quién lo recibió. */
  userId: string
  source: string
  amount: number
  date: string
  categoryId: string | null
  /** De quién es: una sola persona (equal con un participante) o compartido. */
  split: SplitInput
  notes: string
}

const incomeParams = (input: IncomeInput) => ({
  p_user_id: input.userId,
  p_source: input.source.trim(),
  p_amount: input.amount,
  // Categoría opcional: sin el parámetro la RPC guarda null (también al editar).
  ...(input.categoryId ? { p_category_id: input.categoryId } : {}),
  p_date: input.date,
  p_notes: input.notes.trim(),
  ...splitParams(input.split),
})

export async function createIncome(householdId: string, input: IncomeInput): Promise<string> {
  return unwrap(
    await supabase.rpc('create_income', { p_household_id: householdId, ...incomeParams(input) }),
  )
}

export async function updateIncome(incomeId: string, input: IncomeInput): Promise<void> {
  assertOk(await supabase.rpc('update_income', { p_income_id: incomeId, ...incomeParams(input) }))
}

export async function voidIncome(incomeId: string): Promise<void> {
  assertOk(await supabase.rpc('void_income', { p_income_id: incomeId }))
}

// ---------------------------------------------------------------------------
// Transferencias
// ---------------------------------------------------------------------------

export interface TransferInput {
  fromUser: string
  toUser: string
  amount: number
  date: string
  notes: string
}

export async function createTransfer(householdId: string, input: TransferInput): Promise<string> {
  const { id } = unwrap(
    await supabase
      .from('transfers')
      .insert({
        household_id: householdId,
        from_user: input.fromUser,
        to_user: input.toUser,
        amount: input.amount,
        date: input.date,
        notes: input.notes.trim() || null,
      })
      .select('id')
      .single(),
  )
  return id
}

export async function updateTransfer(transferId: string, input: TransferInput): Promise<void> {
  assertOk(
    await supabase
      .from('transfers')
      .update({
        from_user: input.fromUser,
        to_user: input.toUser,
        amount: input.amount,
        date: input.date,
        notes: input.notes.trim() || null,
      })
      .eq('id', transferId),
  )
}

export async function voidTransfer(transferId: string): Promise<void> {
  assertOk(await supabase.from('transfers').update({ status: 'voided' }).eq('id', transferId))
}

// ---------------------------------------------------------------------------
// Pagos de tarjeta
// ---------------------------------------------------------------------------

export interface CardPaymentInput {
  userId: string
  amount: number
  date: string
  notes: string
}

export async function createCardPayment(
  householdId: string,
  input: CardPaymentInput,
): Promise<string> {
  const { id } = unwrap(
    await supabase
      .from('card_payments')
      .insert({
        household_id: householdId,
        user_id: input.userId,
        amount: input.amount,
        date: input.date,
        notes: input.notes.trim() || null,
      })
      .select('id')
      .single(),
  )
  return id
}

export async function updateCardPayment(paymentId: string, input: CardPaymentInput): Promise<void> {
  assertOk(
    await supabase
      .from('card_payments')
      .update({
        user_id: input.userId,
        amount: input.amount,
        date: input.date,
        notes: input.notes.trim() || null,
      })
      .eq('id', paymentId),
  )
}

export async function voidCardPayment(paymentId: string): Promise<void> {
  assertOk(await supabase.from('card_payments').update({ status: 'voided' }).eq('id', paymentId))
}
