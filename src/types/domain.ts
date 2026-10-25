import type { CategoryColorId, PersonColorId } from '../lib/appearance'

// Modelo de dominio del frontend. Los montos son enteros en la unidad mínima (COP).

export type Role = 'owner' | 'member'
export type CategoryKind = 'expense' | 'income'
export type SplitType = 'equal' | 'percentage'
export type RecordStatus = 'active' | 'voided'
export type Frequency = 'monthly' | 'quarterly'

export interface Member {
  userId: string
  displayName: string
  role: Role
  joinedAt: string
  active: boolean
  /** Color que eligió (null = automático según el orden de llegada; ver lib/people.ts). */
  personColor: PersonColorId | null
}

export interface Household {
  id: string
  name: string
  currency: string
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  icon: string | null
  /** Color de la paleta curada; null = neutro. */
  color: CategoryColorId | null
  archivedAt: string | null
}

export interface Audit {
  createdBy: string | null
  createdAt: string
  updatedBy: string | null
  updatedAt: string
}

/** Parte de una persona en un gasto o en un ingreso compartido. */
export interface ExpenseSplit {
  userId: string
  shareBp: number
  amount: number
}

export interface Expense extends Audit {
  kind: 'expense'
  id: string
  description: string
  amount: number
  currency: string
  date: string
  /** Categoría principal (icono del movimiento). */
  categoryId: string
  /** Categorías adicionales, sin repetir la principal. */
  extraCategoryIds: string[]
  paidBy: string
  splitType: SplitType
  splits: ExpenseSplit[]
  notes: string | null
  paidWithCard: boolean
  status: RecordStatus
  recurringExpenseId: string | null
}

export interface Income extends Audit {
  kind: 'income'
  id: string
  /** Quién recibió el dinero. De quién es lo dicen los splits (solo reportes, no saldo). */
  userId: string
  source: string
  amount: number
  currency: string
  date: string
  categoryId: string | null
  splitType: SplitType
  splits: ExpenseSplit[]
  notes: string | null
  status: RecordStatus
}

export interface Transfer extends Audit {
  kind: 'transfer'
  id: string
  fromUser: string
  toUser: string
  amount: number
  currency: string
  date: string
  notes: string | null
  status: RecordStatus
}

/** Lo que una persona abona de su parte de la tarjeta: baja su saldo y lo que tiene por pagar. */
export interface CardPayment extends Audit {
  kind: 'card_payment'
  id: string
  userId: string
  amount: number
  currency: string
  date: string
  notes: string | null
  status: RecordStatus
}

export type Movement = Expense | Income | Transfer | CardPayment
export type MovementKind = Movement['kind']

export interface RecurringSplit {
  userId: string
  shareBp: number
}

export interface RecurringExpense extends Audit {
  id: string
  name: string
  amount: number
  currency: string
  frequency: Frequency
  nextDueDate: string
  categoryId: string
  paidBy: string
  splitType: SplitType
  splits: RecurringSplit[]
  notes: string | null
  paidWithCard: boolean
  active: boolean
}

export type BudgetKind = 'category' | 'total' | 'free'
export type BudgetPeriod = 'month' | 'week'

/** Presupuesto personal y privado (solo lo ve quien lo creó). */
export interface Budget {
  id: string
  name: string
  kind: BudgetKind
  /** Solo en los de tipo 'category'. */
  categoryId: string | null
  amount: number
  period: BudgetPeriod
  createdAt: string
  /** Gastos asignados a mano (solo en los de tipo 'free'). */
  expenseIds: string[]
}

/**
 * Ingreso o gasto del dinero personal de quien está conectado. Privado y aparte: no entra en el
 * saldo disponible, en lo que queda ni en los reportes del hogar.
 */
export interface PersonalMovement extends Audit {
  id: string
  kind: 'income' | 'expense'
  description: string
  amount: number
  currency: string
  date: string
  categoryId: string | null
  notes: string | null
  status: RecordStatus
}

/** División pedida al crear/editar: participantes (iguales) o porcentajes en puntos básicos. */
export type SplitInput =
  { type: 'equal'; participants: string[] } | { type: 'percentage'; shares: RecurringSplit[] }
