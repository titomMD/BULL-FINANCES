import { useId, useRef, useState, type ReactNode } from 'react'
import { ArrowCounterClockwiseIcon, CheckCircleIcon, CheckIcon } from '@phosphor-icons/react'
import { useSignedInUser } from '../../app/auth-context'
import { memberName, personColor, useHousehold } from '../../app/household-context'
import {
  accents,
  appearanceAttributes,
  applyAppearance,
  cornerStyles,
  currentAppearance,
  defaultAppearance,
  densities,
  fonts,
  modes,
  motions,
  personColors,
  resolveMode,
  textSizes,
  themes,
  type Appearance,
  type PersonColorId,
} from '../../lib/appearance'
import { toUserMessage } from '../../lib/errors'
import { invalidateData } from '../../hooks/useResource'
import { updateAppearance, updatePersonColor } from '../../services/household'
import { usePreferences } from '../../hooks/usePreferences'
import { isReportView, reportViews } from '../../lib/preferences'
import { Field, Select } from '../../components/ui/Field'
import { PersonAvatar } from '../../components/people/PersonColor'
import { personBg } from '../../components/people/personClasses'
import { Button } from '../../components/ui/Button'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { Segmented } from '../../components/ui/Segmented'
import { useToast } from '../../components/ui/toast-context'

/** Opción de radio en forma de tarjeta; la marca de seleccionado no depende solo del color. */
function OptionCard({
  name,
  checked,
  onSelect,
  preview,
  title,
  detail,
}: {
  name: string
  checked: boolean
  onSelect: () => void
  preview: ReactNode
  title: string
  detail: string
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-surface transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
        checked ? 'border-fg' : 'border-transparent hover:border-line-strong'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {preview}
      <span className="flex items-start gap-2 px-3.5 py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-fg-muted">{detail}</span>
        </span>
        {checked && (
          <CheckCircleIcon aria-hidden="true" className="size-6 shrink-0 text-fg" weight="fill" />
        )}
      </span>
    </label>
  )
}

/** Miniatura de un tema en el modo elegido: se pinta con sus propios tokens. */
function ThemePreview({ id, mode }: { id: string; mode: 'dark' | 'light' }) {
  return (
    <span
      data-theme={id}
      data-mode={mode}
      aria-hidden="true"
      className="flex flex-col gap-2 bg-canvas p-3.5 text-fg"
    >
      <span className="text-xs text-fg-muted">Te queda en octubre</span>
      <span className="tabular text-xl leading-none font-semibold">$ 2.450.570</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-xs font-semibold text-on-primary">
          + Gasto
        </span>
        <span className="inline-flex h-7 items-center rounded-lg bg-surface px-2 text-xs font-semibold text-positive">
          + más
        </span>
        <span className="inline-flex h-7 items-center rounded-lg bg-surface px-2 text-xs font-semibold text-negative">
          − más
        </span>
      </span>
    </span>
  )
}

function FontPreview({ id }: { id: string }) {
  return (
    <span
      data-font={id}
      aria-hidden="true"
      className="flex flex-col gap-0.5 bg-surface-2 px-3.5 py-3 font-sans"
    >
      <span className="tabular text-2xl leading-tight font-semibold">$ 1.234.567</span>
      <span className="text-sm text-fg-muted">Mercado del sábado</span>
    </span>
  )
}

/** La app en pequeño con todo lo elegido junto (tema, modo, acento, fuente, densidad…). */
function LivePreview({ appearance }: { appearance: Appearance }) {
  const data = useHousehold()
  const others = data.members.filter((member) => member.userId !== data.userId && member.active)
  const attributes = appearanceAttributes(appearance)
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-fg-muted">Vista previa</figcaption>
      <div
        {...attributes}
        aria-hidden="true"
        className="flex flex-col gap-4 rounded-2xl border border-line-strong bg-canvas p-(--card-p) font-sans text-fg"
      >
        <div>
          <p className="text-sm text-fg-muted">Tu saldo disponible</p>
          <p className="tabular text-3xl font-semibold tracking-tight">$2.450.570</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-2/3 rounded-full bg-positive" />
          </div>
        </div>
        <div className="flex flex-col rounded-2xl bg-surface px-4">
          <div className="flex items-start gap-3 py-(--row-y)">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm">
              $
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex justify-between gap-3">
                <span className="truncate font-medium">Mercado D1</span>
                <span className="tabular font-semibold">$87.350</span>
              </span>
              <span className="text-sm text-fg-muted">Pagaste · 50/50</span>
              <span className="text-sm font-medium text-negative">
                Tu saldo −$43.675{others[0] ? ` · ${others[0].displayName} −$43.675` : ''}
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 items-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-on-primary">
            + Gasto
          </span>
          {data.members
            .filter((member) => member.active)
            .map((member) => (
              <span key={member.userId} className="inline-flex items-center gap-1.5 text-sm">
                <PersonAvatar
                  name={member.displayName}
                  color={personColor(data, member.userId)}
                  size="sm"
                />
                {member.userId === data.userId ? 'Tú' : member.displayName}
              </span>
            ))}
        </div>
      </div>
    </figure>
  )
}

function Group({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** Fila de muestras redondas (acento, color de persona). */
function Swatches<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; name: string; disabledReason?: string }>
  onChange: (value: T) => void
  render: (id: T) => ReactNode
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {options.map((option) => {
          const checked = option.id === value
          const disabled = Boolean(option.disabledReason)
          return (
            <label
              key={option.id}
              className={`flex w-16 flex-col items-center gap-1.5 text-center text-xs ${
                disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
              } has-[:focus-visible]:[&>span:first-of-type]:outline-2 has-[:focus-visible]:[&>span:first-of-type]:outline-offset-2 has-[:focus-visible]:[&>span:first-of-type]:outline-primary`}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span
                className={`grid size-11 place-items-center rounded-full border-2 ${
                  checked ? 'border-fg' : 'border-transparent'
                }`}
              >
                {render(option.id)}
              </span>
              <span className={checked ? 'font-semibold text-fg' : 'text-fg-muted'}>
                {option.name}
              </span>
              {option.disabledReason && (
                <span className="text-fg-muted">{option.disabledReason}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function AppearancePage() {
  const { userId } = useSignedInUser()
  const data = useHousehold()
  const toast = useToast()
  const [appearance, setAppearance] = useState<Appearance>(currentAppearance)
  // Último valor confirmado por la base de datos, para volver a él si falla el guardado.
  const saved = useRef(appearance)
  const name = useId()
  const mode = resolveMode(appearance.mode)
  const [preferences, updatePreferences] = usePreferences()

  const choose = async (next: Appearance) => {
    // Se aplica al instante; se guarda en la cuenta para el resto de dispositivos.
    setAppearance(next)
    applyAppearance(next)
    try {
      await updateAppearance(userId, next)
      saved.current = next
    } catch (error) {
      setAppearance(saved.current)
      applyAppearance(saved.current)
      toast.show(
        toUserMessage(error, 'No pudimos guardar la apariencia. Inténtalo de nuevo.'),
        'error',
      )
    }
  }
  const set = <K extends keyof Appearance>(key: K, value: Appearance[K]) =>
    choose({ ...appearance, [key]: value })

  const myColor = data.me.personColor
  const takenBy = (color: PersonColorId) =>
    data.members.find(
      (member) => member.active && member.userId !== userId && member.personColor === color,
    )
  const chooseColor = async (color: PersonColorId | 'auto') => {
    try {
      await updatePersonColor(userId, color === 'auto' ? null : color)
      invalidateData()
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardar tu color. Inténtalo de nuevo.'), 'error')
    }
  }

  const isDefault = (Object.keys(defaultAppearance) as Array<keyof Appearance>).every(
    (key) => appearance[key] === defaultAppearance[key],
  )

  return (
    <Page>
      <PageHeader
        title="Apariencia"
        back="/ajustes"
        description="Se guarda en tu cuenta: la verás igual en el celular y en el computador."
      />
      <div className="flex flex-col gap-8">
        <LivePreview appearance={appearance} />

        <Group title="Modo">
          <Segmented
            label="Modo"
            hideLabel
            value={appearance.mode}
            onChange={(value) => set('mode', value)}
            options={modes.map((option) => ({ value: option.id, label: option.name }))}
          />
          {appearance.mode === 'system' && (
            <p className="text-sm text-fg-muted">
              Sigue a tu teléfono o computador: ahora mismo, {mode === 'dark' ? 'oscuro' : 'claro'}.
            </p>
          )}
        </Group>

        <Group title="Tema" description="Cada tema tiene versión oscura y clara.">
          <fieldset>
            <legend className="sr-only">Tema</legend>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {themes.map((theme) => (
                <OptionCard
                  key={theme.id}
                  name={`${name}-theme`}
                  checked={appearance.theme === theme.id}
                  onSelect={() => set('theme', theme.id)}
                  preview={<ThemePreview id={theme.id} mode={mode} />}
                  title={theme.name}
                  detail={theme.detail}
                />
              ))}
            </div>
          </fieldset>
        </Group>

        <Group
          title="Color de acento"
          description="Botones, el día de hoy y lo que pide atención. El verde y el rojo del dinero no cambian."
        >
          <Swatches
            label="Color de acento"
            value={appearance.accent}
            onChange={(value) => set('accent', value)}
            options={accents}
            render={(id) => (
              <span
                data-theme={appearance.theme}
                data-mode={mode}
                data-accent={id === 'theme' ? undefined : id}
                className="grid size-8 place-items-center rounded-full bg-primary text-on-primary"
              >
                {appearance.accent === id && (
                  <CheckIcon aria-hidden="true" className="size-4" weight="bold" />
                )}
              </span>
            )}
          />
        </Group>

        <Group
          title="Tu color"
          description="Te identifica en las barras, los reportes y tu avatar. Lo ven los dos."
        >
          <Swatches
            label="Tu color"
            value={(myColor ?? 'auto') as PersonColorId | 'auto'}
            onChange={chooseColor}
            options={[
              { id: 'auto' as const, name: 'Automático' },
              ...personColors.map((color) => {
                const other = takenBy(color.id)
                return {
                  id: color.id,
                  name: color.name,
                  disabledReason: other ? `Lo usa ${memberName(data, other.userId)}` : undefined,
                }
              }),
            ]}
            render={(id) =>
              id === 'auto' ? (
                <PersonAvatar name={data.me.displayName} color={personColor(data, userId)} />
              ) : (
                <span
                  className={`grid size-8 place-items-center rounded-full text-on-swatch ${personBg[id]}`}
                >
                  {myColor === id && (
                    <CheckIcon aria-hidden="true" className="size-4" weight="bold" />
                  )}
                </span>
              )
            }
          />
        </Group>

        <Group title="Tipografía">
          <fieldset>
            <legend className="sr-only">Tipografía</legend>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {fonts.map((font) => (
                <OptionCard
                  key={font.id}
                  name={`${name}-font`}
                  checked={appearance.font === font.id}
                  onSelect={() => set('font', font.id)}
                  preview={<FontPreview id={font.id} />}
                  title={font.name}
                  detail={font.detail}
                />
              ))}
            </div>
          </fieldset>
        </Group>

        <Group title="Tamaño de texto" description="Todo crece junto: texto, botones y espacios.">
          <Segmented
            label="Tamaño de texto"
            hideLabel
            value={appearance.textSize}
            onChange={(value) => set('textSize', value)}
            options={textSizes.map((option) => ({ value: option.id, label: option.name }))}
          />
        </Group>

        <Group
          title="Densidad"
          description="Cuánto espacio hay entre filas y dentro de las tarjetas."
        >
          <Segmented
            label="Densidad"
            hideLabel
            value={appearance.density}
            onChange={(value) => set('density', value)}
            options={densities.map((option) => ({ value: option.id, label: option.name }))}
          />
        </Group>

        <Group title="Esquinas">
          <Segmented
            label="Esquinas"
            hideLabel
            value={appearance.corners}
            onChange={(value) => set('corners', value)}
            options={cornerStyles.map((option) => ({ value: option.id, label: option.name }))}
          />
        </Group>

        <Group
          title="Movimiento"
          description="Reducido quita deslizamientos y animaciones de entrada; los cambios siguen viéndose."
        >
          <Segmented
            label="Movimiento"
            hideLabel
            value={appearance.motion}
            onChange={(value) => set('motion', value)}
            options={motions.map((option) => ({ value: option.id, label: option.name }))}
          />
        </Group>

        <Group title="Modo privado">
          <label className="flex cursor-pointer items-start gap-4 rounded-2xl bg-surface p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
            <span className="flex flex-1 flex-col">
              <span className="font-medium">Ocultar los montos</span>
              <span className="text-sm text-fg-muted">
                Para abrir la app en público: los montos se ven borrosos hasta que los tocas. Con
                teclado, apágalo aquí para verlos.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={appearance.privateMode}
              onChange={(event) => set('privateMode', event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-surface-2 transition-colors peer-checked:bg-primary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-fg after:transition-[translate] peer-checked:after:translate-x-5 peer-checked:after:bg-on-primary motion-reduce:after:transition-none"
            />
          </label>
        </Group>

        <Group
          title="Gráfica inicial de Reportes"
          description="La vista con la que abre el análisis. También cambia sola cuando eliges otra en Reportes."
        >
          <Field
            label="Vista al abrir Reportes"
            hint={reportViews.find((view) => view.id === preferences.reportView)?.description}
          >
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={preferences.reportView}
                onChange={(event) => {
                  if (isReportView(event.target.value))
                    updatePreferences({ reportView: event.target.value })
                }}
              >
                {reportViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Group>

        <div className="border-t border-line pt-6">
          <Button
            variant="secondary"
            disabled={isDefault}
            onClick={() => choose(defaultAppearance)}
            icon={<ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" weight="bold" />}
          >
            Restablecer a Bullmilton
          </Button>
          <p className="mt-2 text-sm text-fg-muted">
            Vuelve al tema original: oscuro, amarillo, letra del sistema. Tu color no cambia.
          </p>
        </div>
      </div>
    </Page>
  )
}
