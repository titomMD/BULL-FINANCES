import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import type { DebtAccount, DebtStatement, StatementLine } from '../types/domain'
import type { Json } from '../types/database'

// Tarjetas de crédito / deudas y sus extractos. Privado por RLS. Los archivos viven en el bucket
// privado «freyapp-files», dentro de la carpeta de cada persona (<user_id>/...).

const BUCKET = 'freyapp-files'

export async function fetchMyAccounts(householdId: string): Promise<DebtAccount[]> {
  const rows = unwrap(
    await supabase
      .from('debt_accounts')
      .select('id, name, last4, cut_day, due_day, notes, image_path, archived_at')
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
        'id, account_id, statement_date, due_date, pay_month, total_due, minimum_due, previous_balance, interest, purchases, paid_amount, paid_on, notes, lines, file_path, file_name',
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
}

const accountRow = (input: AccountInput) => ({
  name: input.name.trim(),
  last4: input.last4.trim() || null,
  cut_day: input.cutDay,
  due_day: input.dueDay,
  notes: input.notes.trim() || null,
  image_path: input.imagePath,
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
  paidAmount: number
  paidOn: string | null
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
  paid_amount: input.paidAmount,
  paid_on: input.paidOn,
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

export async function deleteStatement(statementId: string): Promise<void> {
  assertOk(await supabase.from('debt_statements').delete().eq('id', statementId))
}

/** Registra un pago (total o parcial) de un extracto. */
export async function setStatementPayment(
  statementId: string,
  paidAmount: number,
  paidOn: string | null,
): Promise<void> {
  assertOk(
    await supabase
      .from('debt_statements')
      .update({ paid_amount: paidAmount, paid_on: paidOn })
      .eq('id', statementId),
  )
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
