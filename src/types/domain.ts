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
  /** 'YYYY-MM' si es el ingreso «Dinero mío» que el plan genera solo; null en los demás. */
  planMonth: string | null
}

/** División pedida al crear/editar: participantes (iguales) o porcentajes en puntos básicos. */
export type SplitInput =
  { type: 'equal'; participants: string[] } | { type: 'percentage'; shares: RecurringSplit[] }

/** Línea del plan mensual personal: ingreso, gasto fijo o ahorro. */
export type PlanKind = 'income' | 'expense' | 'saving'

export interface PlanItem {
  id: string
  kind: PlanKind
  name: string
  /** Agrupa gastos que se pagan juntos (p. ej. "Tarjeta"). */
  groupName: string | null
  amount: number
  currency: string
  /** Primer y último día (cuenta el mes). Null = sin límite. */
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
  /** Lleva registros de gasto del mes (p. ej. las tanqueadas de la gasolina o los recibos). */
  tracked: boolean
  /** Día del mes en que hay que pagar (1-31), o null. */
  dueDay: number | null
  /** Cuántos días antes avisar del pago. */
  remindDays: number
}

/** «Ya lo pagué este mes»: una marca por línea y mes. */
export interface PlanCheck {
  id: string
  planItemId: string
  /** 'YYYY-MM' */
  month: string
  /** Lo realmente pagado, si difiere del monto del plan (p. ej. cuota de manejo). */
  paidAmount: number | null
}

/** Un gasto registrado contra una línea del plan (una tanqueada, por ejemplo). */
export interface PlanEntry {
  id: string
  planItemId: string
  date: string
  amount: number
  note: string | null
  /** Foto o PDF del recibo, en el almacenamiento privado. */
  filePath: string | null
  fileName: string | null
}

/** Tarjeta de crédito o deuda. Solo se guardan los últimos 4 dígitos. */
export interface DebtAccount {
  id: string
  name: string
  last4: string | null
  cutDay: number | null
  dueDay: number | null
  notes: string | null
  /** Ruta de la imagen de la tarjeta en el almacenamiento privado. */
  imagePath: string | null
  archivedAt: string | null
  /** Línea del plan (Membresías) donde se descuenta la cuota de manejo. */
  feePlanItemId: string | null
}

/** Movimiento copiado de un extracto (solo para consultar). */
export interface StatementLine {
  date: string
  detail: string
  amount: number
}

export interface DebtStatement {
  id: string
  accountId: string
  statementDate: string
  dueDate: string | null
  /** 'YYYY-MM': mes del plan en el que se paga. */
  payMonth: string
  totalDue: number
  minimumDue: number
  previousBalance: number | null
  interest: number | null
  purchases: number | null
  paidAmount: number
  paidOn: string | null
  /** Cuenta en dólares, en centavos. */
  usdTotalDue: number
  usdMinimumDue: number
  usdPaid: number
  /** Cuota de manejo cobrada (COP). */
  feeAmount: number | null
  /** Tasa mensual vencida en millonésimas (2,1593 % = 21593). */
  monthlyRatePpm: number | null
  notes: string | null
  lines: StatementLine[]
  filePath: string | null
  fileName: string | null
}

export type DebtCurrency = 'COP' | 'USD'

/** Pago a una tarjeta: pesos enteros o centavos de dólar, cada moneda por separado. */
export interface DebtPayment {
  id: string
  accountId: string
  statementId: string | null
  currency: DebtCurrency
  amount: number
  kind: 'minimum' | 'extra' | 'full'
  paidOn: string
  /** Pesos por dólar × 100 (solo USD). */
  fxRateCents: number | null
  note: string | null
}

/** Gasto con la tarjeta que aún no sale en un extracto. */
export interface DebtCardExpense {
  id: string
  accountId: string
  expenseDate: string
  description: string
  currency: DebtCurrency
  amount: number
  fxRateCents: number | null
}
