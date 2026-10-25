import { supabase } from '../lib/supabase/client'
import { assertOk, unwrap, unwrapMaybe } from '../lib/errors'
import {
  isCategoryColor,
  isPersonColor,
  toAppearance,
  type Appearance,
  type CategoryColorId,
  type PersonColorId,
} from '../lib/appearance'
import type { Category, CategoryKind, Household, Member, Role } from '../types/domain'
import { toPreferences, type Preferences } from '../lib/preferences'

export interface HouseholdContextData {
  household: Household
  members: Member[]
}

/** Household activo del usuario actual (o null si todavía no pertenece a ninguno). */
export async function fetchMyHousehold(userId: string): Promise<HouseholdContextData | null> {
  const membership = unwrapMaybe(
    await supabase
      .from('household_members')
      .select('household_id, left_at')
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle(),
  )
  if (!membership) return null

  const household = unwrap(
    await supabase
      .from('households')
      .select('id, name, currency')
      .eq('id', membership.household_id)
      .single(),
  )

  const rows = unwrap(
    await supabase
      .from('household_members')
      .select('user_id, role, joined_at, left_at, profiles(display_name, person_color)')
      .eq('household_id', household.id)
      .order('joined_at'),
  )

  const members: Member[] = rows.map((row) => ({
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? 'Sin nombre',
    role: row.role as Role,
    joinedAt: row.joined_at,
    active: row.left_at === null,
    personColor: isPersonColor(row.profiles?.person_color) ? row.profiles.person_color : null,
  }))

  return { household, members }
}

export async function fetchMyProfile(userId: string): Promise<{ displayName: string }> {
  const profile = unwrap(
    await supabase.from('profiles').select('display_name').eq('id', userId).single(),
  )
  return { displayName: profile.display_name }
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  assertOk(
    await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', userId),
  )
}

export async function createHousehold(name: string): Promise<string> {
  return unwrap(await supabase.rpc('create_household', { p_name: name }))
}

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  assertOk(await supabase.from('households').update({ name: name.trim() }).eq('id', householdId))
}

export interface Invitation {
  id: string
  code: string
  expiresAt: string
  usedAt: string | null
}

export async function fetchInvitations(householdId: string): Promise<Invitation[]> {
  const rows = unwrap(
    await supabase
      .from('invitations')
      .select('id, code, expires_at, used_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
  )
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  }))
}

export async function createInvitation(
  householdId: string,
): Promise<{ code: string; expiresAt: string }> {
  const rows = unwrap(await supabase.rpc('create_invitation', { p_household_id: householdId }))
  const [row] = rows
  return { code: row.code, expiresAt: row.expires_at }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  assertOk(await supabase.from('invitations').delete().eq('id', invitationId))
}

export async function acceptInvitation(code: string): Promise<string> {
  return unwrap(await supabase.rpc('accept_invitation', { p_code: code }))
}

export async function leaveHousehold(householdId: string): Promise<void> {
  assertOk(await supabase.rpc('leave_household', { p_household_id: householdId }))
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function fetchCategories(householdId: string): Promise<Category[]> {
  const rows = unwrap(
    await supabase
      .from('categories')
      .select('id, kind, name, icon, color, archived_at')
      .eq('household_id', householdId)
      .order('name'),
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as CategoryKind,
    name: row.name,
    icon: row.icon,
    color: isCategoryColor(row.color) ? row.color : null,
    archivedAt: row.archived_at,
  }))
}

export async function createCategory(
  householdId: string,
  kind: CategoryKind,
  name: string,
  icon: string | null,
  color: CategoryColorId | null = null,
): Promise<void> {
  assertOk(
    await supabase
      .from('categories')
      .insert({ household_id: householdId, kind, name: name.trim(), icon, color }),
  )
}

export async function updateCategory(
  categoryId: string,
  changes: {
    name?: string
    icon?: string | null
    color?: CategoryColorId | null
    archived?: boolean
  },
): Promise<void> {
  assertOk(
    await supabase
      .from('categories')
      .update({
        ...(changes.name !== undefined && { name: changes.name.trim() }),
        ...(changes.icon !== undefined && { icon: changes.icon }),
        ...(changes.color !== undefined && { color: changes.color }),
        ...(changes.archived !== undefined && {
          archived_at: changes.archived ? new Date().toISOString() : null,
        }),
      })
      .eq('id', categoryId),
  )
}

export async function deleteCategory(categoryId: string): Promise<void> {
  assertOk(await supabase.from('categories').delete().eq('id', categoryId))
}

const APPEARANCE_COLUMNS =
  'theme, mode, accent, font, density, text_size, corners, motion, private_mode' as const

export async function fetchAppearance(userId: string): Promise<Appearance> {
  const row = unwrap(
    await supabase.from('profiles').select(APPEARANCE_COLUMNS).eq('id', userId).single(),
  )
  return toAppearance({
    theme: row.theme,
    mode: row.mode,
    accent: row.accent,
    font: row.font,
    density: row.density,
    textSize: row.text_size,
    corners: row.corners,
    motion: row.motion,
    privateMode: row.private_mode,
  })
}

export async function updateAppearance(userId: string, appearance: Appearance): Promise<void> {
  assertOk(
    await supabase
      .from('profiles')
      .update({
        theme: appearance.theme,
        mode: appearance.mode,
        accent: appearance.accent,
        font: appearance.font,
        density: appearance.density,
        text_size: appearance.textSize,
        corners: appearance.corners,
        motion: appearance.motion,
        private_mode: appearance.privateMode,
      })
      .eq('id', userId),
  )
}

export async function fetchPreferences(userId: string): Promise<Preferences> {
  const row = unwrap(
    await supabase
      .from('profiles')
      .select('report_chart, spend_alerts, spend_alert_threshold')
      .eq('id', userId)
      .single(),
  )
  return toPreferences({
    reportView: row.report_chart,
    spendAlerts: row.spend_alerts,
    alertThreshold: row.spend_alert_threshold,
  })
}

/** Guarda solo lo que cambió (la base de datos valida cada valor con un CHECK). */
export async function updatePreferences(
  userId: string,
  changes: Partial<Preferences>,
): Promise<void> {
  assertOk(
    await supabase
      .from('profiles')
      .update({
        ...(changes.reportView !== undefined && { report_chart: changes.reportView }),
        ...(changes.spendAlerts !== undefined && { spend_alerts: changes.spendAlerts }),
        ...(changes.alertThreshold !== undefined && {
          spend_alert_threshold: changes.alertThreshold,
        }),
      })
      .eq('id', userId),
  )
}

/** Color de persona; la base de datos rechaza uno que ya use otro miembro del hogar. */
export async function updatePersonColor(
  userId: string,
  color: PersonColorId | null,
): Promise<void> {
  assertOk(await supabase.from('profiles').update({ person_color: color }).eq('id', userId))
}
