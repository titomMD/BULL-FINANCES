// Preferencias de la cuenta que no son de apariencia: la gráfica de Reportes y las alertas de
// gasto. Se guardan en profiles (con CHECK de valores permitidos) y se recuerdan en este navegador
// para no esperar a la red. Los ids deben coincidir con la migración report_chart_spend_alerts.

export const reportViews = [
  {
    id: 'income_expense',
    name: 'Ingresos vs gastos',
    description: '¿Entra más de lo que sale? Mes a mes, con lo que quedó.',
  },
  {
    id: 'pace',
    name: 'Ritmo del mes',
    description: '¿Nos vamos a pasar? Gasto acumulado contra lo que entró.',
  },
  {
    id: 'category',
    name: 'Por categoría',
    description: '¿En qué se va la plata? De mayor a menor.',
  },
  {
    id: 'person',
    name: 'Por persona',
    description: 'Lo que pagó cada uno contra lo que le tocaba.',
  },
  {
    id: 'remaining',
    name: 'Restante por persona',
    description: '¿Cuánto le quedó a cada uno? Mes a mes.',
  },
  {
    id: 'compare',
    name: 'Comparar con el mes anterior',
    description: '¿Qué subió y qué bajó? Por categoría.',
  },
] as const

export type ReportView = (typeof reportViews)[number]['id']

export const alertThresholds = [50, 60, 70, 80, 90] as const
export type AlertThreshold = (typeof alertThresholds)[number]

export interface Preferences {
  reportView: ReportView
  spendAlerts: boolean
  alertThreshold: AlertThreshold
}

export const defaultPreferences: Preferences = {
  reportView: 'income_expense',
  spendAlerts: true,
  alertThreshold: 80,
}

export const isReportView = (value: unknown): value is ReportView =>
  reportViews.some((view) => view.id === value)

/** Normaliza lo que venga de la base de datos o del navegador (valores desconocidos → defecto). */
export function toPreferences(
  value: Partial<Record<keyof Preferences, unknown>> | null,
): Preferences {
  const threshold = alertThresholds.find((option) => option === value?.alertThreshold)
  return {
    reportView: isReportView(value?.reportView) ? value.reportView : defaultPreferences.reportView,
    spendAlerts: value?.spendAlerts !== false,
    alertThreshold: threshold ?? defaultPreferences.alertThreshold,
  }
}

const STORAGE_KEY = 'bullmilton.preferences'
const listeners = new Set<() => void>()

function cached(): Preferences {
  try {
    return toPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return defaultPreferences
  }
}

let current: Preferences = cached()

export function getPreferences(): Preferences {
  return current
}

/** Cambia las preferencias en esta sesión (y en este navegador) y avisa a quien las use. */
export function setPreferences(next: Preferences) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sin almacenamiento: se usan igual, solo no se recuerdan en este navegador.
  }
  for (const listener of listeners) listener()
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
