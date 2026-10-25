import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap } from '../lib/errors'
import { fetchAllPages } from './movements'
import type { PersonalMovement, RecordStatus } from '../types/domain'

// Dinero personal. RLS solo deja ver y tocar los movimientos de quien está conectado.

const PERSONAL_COLUMNS =
  'id, kind, description, amount, currency, date, category_id, notes, status, created_by, created_at, updated_by, updated_at'

/** Tus movimientos personales (activos y anulados), del más reciente al más antiguo. */
export async function fetchMyPersonalMovements(householdId: string): Promise<PersonalMovement[]> {
  // Paginado: el saldo personal necesita el historial completo (PostgREST corta en 1000 filas).
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from('personal_movements')
      .select(PERSONAL_COLUMNS)
      .eq('household_id', householdId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as PersonalMovement['kind'],
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    categoryId: row.category_id,
    notes: row.notes,
    status: row.status as RecordStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }))
}

export interface PersonalMovementInput {
  description: string
  amount: number
  date: string
  categoryId: string | null
  notes: string
}

const personalRow = (input: PersonalMovementInput) => ({
  description: input.description.trim(),
  amount: input.amount,
  date: input.date,
  category_id: input.categoryId,
  notes: input.notes.trim() || null,
})

export async function createPersonalMovement(
  householdId: string,
  kind: PersonalMovement['kind'],
  input: PersonalMovementInput,
): Promise<string> {
  const { id } = unwrap(
    await supabase
      .from('personal_movements')
      .insert({ household_id: householdId, kind, ...personalRow(input) })
      .select('id')
      .single(),
  )
  return id
}

export async function updatePersonalMovement(
  movementId: string,
  input: PersonalMovementInput,
): Promise<void> {
  assertOk(
    await supabase.from('personal_movements').update(personalRow(input)).eq('id', movementId),
  )
}

export async function voidPersonalMovement(movementId: string): Promise<void> {
  assertOk(
    await supabase.from('personal_movements').update({ status: 'voided' }).eq('id', movementId),
  )
}
