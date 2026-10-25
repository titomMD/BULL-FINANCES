import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TrendUpIcon, WarningIcon, WarningOctagonIcon, XIcon } from '@phosphor-icons/react'
import { memberName, useHousehold } from '../../app/household-context'
import { usePreferences } from '../../hooks/usePreferences'
import { alertKey, spendAlerts, type SpendAlert } from '../../lib/calculations/alerts'
import { summarizePeriod } from '../../lib/calculations/reports'
import { endOfMonth, startOfMonth, todayBogota } from '../../lib/dates'
import { formatMoney } from '../../lib/money'

// Avisos dentro de la app cuando el mes va mal (sin notificaciones push). Se pueden cerrar hasta
// que cambie el estado (otro tipo de aviso, otra persona u otro mes); eso se recuerda solo en
// este navegador, porque es una comodidad de quien mira.

const STORAGE_KEY = 'bullmilton.dismissedAlerts'

function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Sin almacenamiento: el aviso vuelve a aparecer al recargar.
  }
}

interface AlertCopy {
  tone: 'attention' | 'danger'
  title: string
  body: string
}

function useAlertCopy() {
  const data = useHousehold()
  return (alert: SpendAlert): AlertCopy => {
    switch (alert.kind) {
      case 'over':
        if (alert.userId === null)
          return {
            tone: 'danger',
            title: 'Gastando más de lo que entra',
            body: `Van ${formatMoney(alert.amount)} por encima de lo que entró este mes. Frenen lo que pueda esperar o registren los ingresos que falten.`,
          }
        if (alert.userId === data.userId)
          return {
            tone: 'danger',
            title: 'Estás gastando más de lo que te entra',
            body: `Vas ${formatMoney(alert.amount)} por encima de lo que te entró este mes. Frena lo que pueda esperar o registra los ingresos que falten.`,
          }
        return {
          tone: 'danger',
          title: `${memberName(data, alert.userId)} está gastando más de lo que le entra`,
          body: `Va ${formatMoney(alert.amount)} por encima de lo que le entró este mes.`,
        }
      case 'pace':
        return {
          tone: 'attention',
          title: 'A este ritmo se pasan',
          body: `Terminarían el mes gastando ${formatMoney(alert.projected)}, ${formatMoney(alert.overBy)} más de lo que entró. Para no pasarse: ≈ ${formatMoney(alert.perDay)} por día hasta fin de mes.`,
        }
      case 'threshold':
        return {
          tone: 'attention',
          title: `Atención: ya gastaron el ${alert.percent} % de lo que entró`,
          body: `Quedan ${formatMoney(alert.left)} este mes: ≈ ${formatMoney(alert.perDay)} por día hasta fin de mes.`,
        }
    }
  }
}

const icons = {
  over: WarningOctagonIcon,
  pace: TrendUpIcon,
  threshold: WarningIcon,
} as const

/** Avisos del mes en curso, según Ajustes → Alertas. Nada si están apagados o no aplica. */
export function SpendAlerts({
  className = '',
  linkToReports = true,
}: {
  className?: string
  /** En Reportes el enlace sobra. */
  linkToReports?: boolean
}) {
  const data = useHousehold()
  const [preferences] = usePreferences()
  const copy = useAlertCopy()
  const [dismissed, setDismissed] = useState(readDismissed)
  const today = todayBogota()

  const alerts = useMemo(() => {
    if (!preferences.spendAlerts) return []
    const month = { from: startOfMonth(today), to: endOfMonth(today) }
    const summary = summarizePeriod(
      data.movements,
      data.members.map((member) => member.userId),
      month,
    )
    return spendAlerts(summary, data.movements, today, { threshold: preferences.alertThreshold })
  }, [data.movements, data.members, today, preferences.spendAlerts, preferences.alertThreshold])

  const visible = alerts.filter((alert) => !dismissed.includes(alertKey(alert, today)))
  if (visible.length === 0) return null

  const dismiss = (alert: SpendAlert) => {
    // Solo se guardan las claves de avisos que siguen vigentes (las viejas ya no sirven).
    const current = new Set(alerts.map((item) => alertKey(item, today)))
    const next = [...dismissed.filter((key) => current.has(key)), alertKey(alert, today)]
    setDismissed(next)
    writeDismissed(next)
  }

  return (
    <section aria-label="Avisos de gasto" className={`flex flex-col gap-2 ${className}`}>
      {visible.map((alert) => {
        const { tone, title, body } = copy(alert)
        const Icon = icons[alert.kind]
        return (
          <div
            key={alertKey(alert, today)}
            role="status"
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              tone === 'danger'
                ? 'border-negative/40 bg-negative-bg'
                : 'border-primary/40 bg-primary-wash'
            }`}
          >
            <Icon
              aria-hidden="true"
              weight="bold"
              className={`mt-0.5 size-5 shrink-0 ${tone === 'danger' ? 'text-negative' : 'text-primary'}`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className={`font-semibold ${tone === 'danger' ? 'text-negative' : ''}`}>{title}</p>
              <p data-money className="text-sm text-fg">
                {body}
              </p>
              {linkToReports && (
                <Link
                  to="/reportes"
                  className="-my-1 inline-flex min-h-9 items-center self-start text-sm font-medium text-fg-muted underline hover:text-fg"
                >
                  Ver en qué se fue
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(alert)}
              className="-m-2 grid size-11 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <XIcon aria-hidden="true" className="size-5" weight="bold" />
              <span className="sr-only">Cerrar este aviso</span>
            </button>
          </div>
        )
      })}
    </section>
  )
}
