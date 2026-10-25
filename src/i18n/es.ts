// Textos que dependen de lógica (errores, etiquetas de enumeraciones). Centralizados para poder
// añadir otro idioma sin tocar servicios ni cálculos (spec §44).

export const errorMessages = {
  not_authenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  forbidden: 'No tienes acceso a este hogar.',
  already_in_household: 'Ya perteneces a un hogar. Sal de él antes de unirte a otro.',
  invalid_invitation: 'Ese código no es válido o ya venció. Pide uno nuevo.',
  split_must_total_100: 'Los porcentajes deben sumar 100 %.',
  invalid_split: 'Revisa cómo se divide el gasto.',
  invalid_expense_splits: 'Revisa cómo se divide el gasto.',
  invalid_income_splits: 'Revisa cómo se divide el ingreso.',
  invalid_recurring_splits: 'Revisa cómo se divide el gasto recurrente.',
  user_not_active_member: 'Esa persona ya no pertenece al hogar.',
  invalid_category: 'Elige una categoría válida.',
  too_many_categories: 'Un gasto puede tener máximo 6 categorías.',
  invalid_budget: 'Ese presupuesto ya no está disponible. Recarga e inténtalo de nuevo.',
  record_voided: 'Este movimiento fue anulado y ya no se puede modificar.',
  household_immutable: 'No se puede mover un movimiento a otro hogar.',
  not_found: 'No encontramos ese movimiento.',
  recurring_not_due: 'Ese gasto recurrente todavía no está pendiente.',
  recurring_inactive: 'Ese gasto recurrente está pausado.',
  invalid_credentials: 'El email o la contraseña no coinciden.',
  weak_password: 'La contraseña debe tener al menos 8 caracteres, con letras y números.',
  network: 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  category_in_use: 'Esa categoría tiene movimientos. Archívala en lugar de borrarla.',
  duplicate_category: 'Ya existe una categoría con ese nombre.',
  person_color_taken: 'Ese color ya lo usa alguien del hogar. Elige otro.',
  email_taken: 'Ya hay una cuenta con ese email. Entra con ella o recupera la contraseña.',
  signup_disabled: 'El registro está cerrado. Pide a quien creó el hogar que lo active.',
  unknown: 'Algo salió mal. Inténtalo de nuevo.',
} as const

export type ErrorKey = keyof typeof errorMessages

export const frequencyLabels: Record<string, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
}

export const splitTypeLabels: Record<string, string> = {
  equal: 'Partes iguales',
  percentage: 'Porcentaje',
}
