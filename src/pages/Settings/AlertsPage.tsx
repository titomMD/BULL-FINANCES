import { TrendUpIcon, WarningIcon, WarningOctagonIcon } from '@phosphor-icons/react'
import { usePreferences } from '../../hooks/usePreferences'
import { alertThresholds } from '../../lib/preferences'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'

/** Ajustes → Alertas: avisos dentro de la app cuando el mes va mal (sin notificaciones). */
export function AlertsPage() {
  const [preferences, update] = usePreferences()

  return (
    <Page>
      <PageHeader
        title="Alertas"
        back="/ajustes"
        description="Avisos en Inicio y Reportes cuando el mes va mal. Solo dentro de la app: no llegan notificaciones."
      />
      <div className="flex flex-col gap-8">
        <label className="flex cursor-pointer items-start gap-4 rounded-2xl bg-surface p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          <span className="flex flex-1 flex-col">
            <span className="font-medium">Avisarme cuando el gasto se complica</span>
            <span className="text-sm text-fg-muted">
              Cada aviso se puede cerrar; vuelve si el estado cambia.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={preferences.spendAlerts}
            onChange={(event) => update({ spendAlerts: event.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-surface-2 transition-colors peer-checked:bg-primary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-fg after:transition-[translate] peer-checked:after:translate-x-5 peer-checked:after:bg-on-primary motion-reduce:after:transition-none"
          />
        </label>

        <section aria-labelledby="umbral" className="flex flex-col gap-3">
          <div>
            <h2 id="umbral" className="text-lg font-semibold">
              Avisar de «Atención» desde
            </h2>
            <p className="text-sm text-fg-muted">
              El porcentaje de lo que entró en el mes que ya se gastó.
            </p>
          </div>
          <fieldset disabled={!preferences.spendAlerts} className="disabled:opacity-50">
            <Segmented
              label="Umbral de atención"
              hideLabel
              value={String(preferences.alertThreshold)}
              onChange={(value) =>
                update({
                  alertThreshold: alertThresholds.find((option) => String(option) === value) ?? 80,
                })
              }
              options={alertThresholds.map((option) => ({
                value: String(option),
                label: `${option} %`,
              }))}
            />
          </fieldset>
        </section>

        <section aria-labelledby="cuales" className="flex flex-col gap-3">
          <h2 id="cuales" className="text-lg font-semibold">
            Qué avisos hay
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface px-4">
            {[
              {
                icon: WarningIcon,
                title: 'Atención',
                text: `Ya se gastó el ${preferences.alertThreshold} % o más de lo que entró en el mes.`,
              },
              {
                icon: TrendUpIcon,
                title: 'A este ritmo',
                text: 'Si siguen gastando igual, a fin de mes gastarían más de lo que entró (se calcula desde el día 5; los recurrentes cuentan una vez).',
              },
              {
                icon: WarningOctagonIcon,
                title: 'Gastando más de lo que entra',
                text: 'Lo que queda del mes es negativo, del hogar o de una persona que registró ingresos.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 py-3">
                <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <span className="flex flex-col">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-fg-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Page>
  )
}
