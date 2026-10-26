import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type {
  DebtAccount,
  DebtCardExpense,
  DebtCurrency,
  DebtPayment,
  DebtStatement,
  StatementLine,
} from '../types/domain'
import type { Json } from '../types/database'

// Tarjetas de crédito / deudas y sus extractos. Privado por RLS. Los archivos viven en el bucket
// privado «freyapp-files», dentro de la carpeta de cada persona (<user_id>/...).

const BUCKET = 'freyapp-files'

export async function fetchMyAccounts(householdId: string): Promise<DebtAccount[]> {
  const rows = unwrap(
    await supabase
      .from('debt_accounts')
      .select('id, name, last4, cut_day, due_day, notes, image_path, archived_at, fee_plan_item_id')
      .eq('household_id', householdId)
      .order('created_at'),
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    last4: row.last4,
    cutDay: row.cut_day,
    dueDay: row.due_day,
    notes: row.notes,
    imagePath: row.image_path,
    archivedAt: row.archived_at,
    feePlanItemId: row.fee_plan_item_id,
  }))
}

const parseLines = (value: Json): StatementLine[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const { date, detail, amount } = entry
        if (typeof amount !== 'number') return []
        return [
          {
            date: typeof date === 'string' ? date : '',
            detail: typeof detail === 'string' ? detail : '',
            amount,
          },
        ]
      })
    : []

export async function fetchMyStatements(householdId: string): Promise<DebtStatement[]> {
  const rows = unwrap(
    await supabase
      .from('debt_statements')
      .select(
        'id, account_id, statement_date, due_date, pay_month, total_due, minimum_due, previous_balance, interest, purchases, paid_amount, paid_on, usd_total_due, usd_minimum_due, usd_paid, fee_amount, monthly_rate_ppm, notes, lines, file_path, file_name',
      )
      .eq('household_id', householdId)
      .order('statement_date', { ascending: false }),
  )
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    statementDate: row.statement_date,
    dueDate: row.due_date,
    payMonth: row.pay_month,
    totalDue: row.total_due,
    minimumDue: row.minimum_due,
    previousBalance: row.previous_balance,
    interest: row.interest,
    purchases: row.purchases,
    paidAmount: row.paid_amount,
    paidOn: row.paid_on,
    usdTotalDue: row.usd_total_due,
    usdMinimumDue: row.usd_minimum_due,
    usdPaid: row.usd_paid,
    feeAmount: row.fee_amount,
    monthlyRatePpm: row.monthly_rate_ppm,
    notes: row.notes,
    lines: parseLines(row.lines),
    filePath: row.file_path,
    fileName: row.file_name,
  }))
}

export interface AccountInput {
  name: string
  last4: string
  cutDay: number | null
  dueDay: number | null
  notes: string
  imagePath: string | null
  feePlanItemId: string | null
}

const accountRow = (input: AccountInput) => ({
  name: input.name.trim(),
  last4: input.last4.trim() || null,
  cut_day: input.cutDay,
  due_day: input.dueDay,
  notes: input.notes.trim() || null,
  image_path: input.imagePath,
  fee_plan_item_id: input.feePlanItemId,
})

export async function createAccount(householdId: string, input: AccountInput): Promise<string> {
  const { id } = unwrap(
    await supabase
      .from('debt_accounts')
      .insert({ household_id: householdId, ...accountRow(input) })
      .select('id')
      .single(),
  )
  return id
}

export async function updateAccount(accountId: string, input: AccountInput): Promise<void> {
  assertOk(await supabase.from('debt_accounts').update(accountRow(input)).eq('id', accountId))
}

export async function deleteAccount(accountId: string): Promise<void> {
  assertOk(await supabase.from('debt_accounts').delete().eq('id', accountId))
}

export interface StatementInput {
  statementDate: string
  dueDate: string | null
  payMonth: string
  totalDue: number
  minimumDue: number
  previousBalance: number | null
  interest: number | null
  purchases: number | null
  usdTotalDue: number
  usdMinimumDue: number
  feeAmount: number | null
  monthlyRatePpm: number | null
  notes: string
  lines: StatementLine[]
  filePath: string | null
  fileName: string | null
}

const statementRow = (input: StatementInput) => ({
  statement_date: input.statementDate,
  due_date: input.dueDate,
  pay_month: input.payMonth,
  total_due: input.totalDue,
  minimum_due: input.minimumDue,
  previous_balance: input.previousBalance,
  interest: input.interest,
  purchases: input.purchases,
  usd_total_due: input.usdTotalDue,
  usd_minimum_due: input.usdMinimumDue,
  fee_amount: input.feeAmount,
  monthly_rate_ppm: input.monthlyRatePpm,
  notes: input.notes.trim() || null,
  lines: input.lines as unknown as Json,
  file_path: input.filePath,
  file_name: input.fileName,
})

export async function createStatement(
  householdId: string,
  accountId: string,
  input: StatementInput,
): Promise<void> {
  assertOk(
    await supabase
      .from('debt_statements')
      .insert({ household_id: householdId, account_id: accountId, ...statementRow(input) }),
  )
}

export async function updateStatement(statementId: string, input: StatementInput): Promise<void> {
  assertOk(await supabase.from('debt_statements').update(statementRow(input)).eq('id', statementId))
}

/** Cambia con el presupuesto de qué mes se paga el extracto. */
export async function updateStatementPayMonth(
  statementId: string,
  payMonth: string,
): Promise<void> {
  assertOk(
    await supabase.from('debt_statements').update({ pay_month: payMonth }).eq('id', statementId),
  )
}

export async function deleteStatement(statementId: string): Promise<void> {
  assertOk(await supabase.from('debt_statements').delete().eq('id', statementId))
}

// --- Pagos a tarjetas (pesos y dólares por separado) ---------------------------------------------

export async function fetchMyPayments(householdId: string): Promise<DebtPayment[]> {
  const rows = unwrap(
    await supabase
      .from('debt_payments')
      .select('id, account_id, statement_id, currency, amount, kind, paid_on, fx_rate_cents, note')
      .eq('household_id', householdId)
      .order('paid_on', { ascending: false })
      .limit(1000),
  )
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    statementId: row.statement_id,
    currency: row.currency as DebtCurrency,
    amount: row.amount,
    kind: row.kind as DebtPayment['kind'],
    paidOn: row.paid_on,
    fxRateCents: row.fx_rate_cents,
    note: row.note,
  }))
}

export interface PaymentInput {
  statementId: string | null
  currency: DebtCurrency
  amount: number
  kind: DebtPayment['kind']
  paidOn: string
  fxRateCents: number | null
  note: string
}

export async function createPayment(
  householdId: string,
  accountId: string,
  input: PaymentInput,
): Promise<void> {
  assertOk(
    await supabase.from('debt_payments').insert({
      household_id: householdId,
      account_id: accountId,
      statement_id: input.statementId,
      currency: input.currency,
      amount: input.amount,
      kind: input.kind,
      paid_on: input.paidOn,
      fx_rate_cents: input.fxRateCents,
      note: input.note.trim() || null,
    }),
  )
}

export async function deletePayment(paymentId: string): Promise<void> {
  assertOk(await supabase.from('debt_payments').delete().eq('id', paymentId))
}

// --- Gastos con la tarjeta (los del próximo extracto) ---------------------------------------------

export async function fetchMyCardExpenses(householdId: string): Promise<DebtCardExpense[]> {
  const rows = unwrap(
    await supabase
      .from('debt_card_expenses')
      .select('id, account_id, expense_date, description, currency, amount, fx_rate_cents')
      .eq('household_id', householdId)
      .order('expense_date', { ascending: false })
      .limit(1000),
  )
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    expenseDate: row.expense_date,
    description: row.description,
    currency: row.currency as DebtCurrency,
    amount: row.amount,
    fxRateCents: row.fx_rate_cents,
  }))
}

export interface CardExpenseInput {
  expenseDate: string
  description: string
  currency: DebtCurrency
  amount: number
  fxRateCents: number | null
}

export async function createCardExpense(
  householdId: string,
  accountId: string,
  input: CardExpenseInput,
): Promise<void> {
  assertOk(
    await supabase.from('debt_card_expenses').insert({
      household_id: householdId,
      account_id: accountId,
      expense_date: input.expenseDate,
      description: input.description.trim(),
      currency: input.currency,
      amount: input.amount,
      fx_rate_cents: input.fxRateCents,
    }),
  )
}

export async function deleteCardExpense(expenseId: string): Promise<void> {
  assertOk(await supabase.from('debt_card_expenses').delete().eq('id', expenseId))
}

// --- Archivos ---------------------------------------------------------------------------------

const safeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-80)

/** Sube un archivo a tu carpeta privada y devuelve su ruta. */
export async function uploadFile(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`
  assertOk(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type }))
  return path
}

export async function removeFile(path: string): Promise<void> {
  assertOk(await supabase.storage.from(BUCKET).remove([path]))
}

/** Descarga el archivo (la CSP no deja cargar imágenes por URL firmada; se muestra como blob). */
export async function downloadFile(path: string): Promise<Blob> {
  return unwrap(await supabase.storage.from(BUCKET).download(path))
}
