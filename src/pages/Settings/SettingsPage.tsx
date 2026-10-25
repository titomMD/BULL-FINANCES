import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CaretRightIcon,
  CopyIcon,
  DownloadSimpleIcon,
  KeyIcon,
  BellIcon,
  PaletteIcon,
  RepeatIcon,
  SignOutIcon,
  TagIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useHousehold } from '../../app/household-context'
import { useSignedInUser } from '../../app/auth-context'
import { invalidateData, useResource } from '../../hooks/useResource'
import { formatDay, toBogotaDay } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { currentAppearance, fonts, modes, themes } from '../../lib/appearance'
import { usePreferences } from '../../hooks/usePreferences'
import { buildExport, downloadFile } from '../../lib/export'
import { newPasswordSchema, type NewPasswordValues } from '../../lib/validation/password'
import { supabase } from '../../lib/supabase/client'
import {
  createInvitation,
  fetchInvitations,
  leaveHousehold,
  renameHousehold,
  revokeInvitation,
  updateDisplayName,
} from '../../services/household'
import { fetchRecurring } from '../../services/recurring'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/toast-context'

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id ?? title}-title`}
      className="flex scroll-mt-6 flex-col gap-4 border-t border-line py-7 first:border-t-0 first:pt-0"
    >
      <div>
        <h2 id={`${id ?? title}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const nameSchema = z.object({
  name: z.string().trim().min(1, 'No puede quedar vacío.').max(60, 'Máximo 60 caracteres.'),
})

function NameForm({
  label,
  initial,
  onSave,
  success,
}: {
  label: string
  initial: string
  onSave: (name: string) => Promise<void>
  success: string
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: initial },
  })
  // Cambió de verdad (escribir y volver al mismo nombre no cuenta).
  const changed = (useWatch({ control, name: 'name' }) ?? '').trim() !== initial.trim()
  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      await onSave(name)
      reset({ name })
      invalidateData()
      toast.show(success)
    } catch (error) {
      toast.show(toUserMessage(error), 'error')
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={label} error={errors.name?.message} className="flex-1">
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            maxLength={60}
            {...register('name')}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant={changed ? 'primary' : 'secondary'}
        loading={isSubmitting}
        disabled={!changed}
      >
        {changed ? 'Guardar' : 'Sin cambios'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) })
  const onSubmit = handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.show(toUserMessage(error), 'error')
      return
    }
    reset({ password: '', confirm: '' })
    setOpen(false)
    toast.show('Contraseña actualizada')
  })
  if (!open)
    return (
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => setOpen(true)}
        icon={<KeyIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Cambiar contraseña
      </Button>
    )
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <Field label="Nueva contraseña" error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            type="password"
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('password')}
          />
        )}
      </Field>
      <Field label="Repítela" error={errors.confirm?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            type="password"
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('confirm')}
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          Cambiar
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            reset({ password: '', confirm: '' })
            setOpen(false)
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function Invitations() {
  const { household, members } = useHousehold()
  const full = members.filter((member) => member.active).length > 1
  const toast = useToast()
  const invitations = useResource(`invitations:${household.id}`, () =>
    fetchInvitations(household.id),
  )
  const [creating, setCreating] = useState(false)
  const now = new Date().toISOString()
  const pending = (invitations.data ?? []).filter((item) => !item.usedAt && item.expiresAt > now)

  const create = async () => {
    setCreating(true)
    try {
      await createInvitation(household.id)
      invalidateData()
    } catch (error) {
      toast.show(toUserMessage(error), 'error')
    } finally {
      setCreating(false)
    }
  }

  const copy = async (code: string) => {
    try {
      // Enlace directo al registro con el código ya puesto (sirve también si ya tiene cuenta:
      // entra y escribe el código en la bienvenida).
      await navigator.clipboard.writeText(`${window.location.origin}/registro?codigo=${code}`)
      toast.show('Enlace de invitación copiado')
    } catch {
      toast.show('No se pudo copiar; selecciónalo y cópialo a mano.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pending.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p
              data-not-money
              className="tabular text-xl font-semibold tracking-[0.18em] select-all"
            >
              {item.code}
            </p>
            <p className="text-sm text-fg-muted">
              Vence el {formatDay(toBogotaDay(item.expiresAt))}. Sirve una sola vez.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copy(item.code)}
            icon={<CopyIcon aria-hidden="true" className="size-4" />}
          >
            Copiar enlace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Revocar el código ${item.code}`}
            onClick={async () => {
              try {
                await revokeInvitation(item.id)
                invalidateData()
              } catch (error) {
                toast.show(toUserMessage(error), 'error')
              }
            }}
            icon={<TrashIcon aria-hidden="true" className="size-4" />}
          >
            Revocar
          </Button>
        </div>
      ))}
      <Button
        variant={pending.length || full ? 'secondary' : 'primary'}
        className="self-start"
        loading={creating}
        onClick={create}
      >
        {pending.length ? 'Generar otro código' : 'Generar código de invitación'}
      </Button>
    </div>
  )
}

function ExportButtons() {
  const data = useHousehold()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (format: 'json' | 'csv') => {
    setBusy(true)
    try {
      const recurring = await fetchRecurring(data.household.id)
      const exportedAt = new Date().toISOString()
      const result = buildExport({
        householdName: data.household.name,
        members: data.members,
        categories: data.categories,
        movements: data.movements,
        recurring,
        exportedAt,
      })
      const stamp = toBogotaDay(exportedAt)
      if (format === 'json') {
        downloadFile(`bullmilton-${stamp}.json`, result.json, 'application/json')
      } else {
        for (const [name, content] of Object.entries(result.csv))
          downloadFile(`bullmilton-${stamp}-${name}`, content, 'text/csv;charset=utf-8')
      }
      toast.show('Exportación lista')
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos preparar la exportación.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        loading={busy}
        onClick={() => run('json')}
        icon={<DownloadSimpleIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Respaldo JSON
      </Button>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => run('csv')}
        icon={<DownloadSimpleIcon aria-hidden="true" className="size-4" weight="bold" />}
      >
        Archivos CSV
      </Button>
    </div>
  )
}

function LinkRow({
  to,
  icon,
  title,
  detail,
}: {
  to: string
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-4 py-3 transition-colors duration-150 hover:bg-surface-2"
    >
      <span className="text-fg-muted [&>svg]:size-5">{icon}</span>
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-fg-muted">{detail}</span>
      </span>
      <CaretRightIcon aria-hidden="true" className="size-4 text-fg-muted" weight="bold" />
    </Link>
  )
}

export function SettingsPage() {
  const data = useHousehold()
  const { userId, email } = useSignedInUser()
  const toast = useToast()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const activeMembers = data.members.filter((member) => member.active)
  const appearance = currentAppearance()
  const [preferences] = usePreferences()

  return (
    <Page>
      <PageHeader title="Ajustes" />

      <Section title="Tu perfil" description={`Entraste como ${email}.`}>
        <NameForm
          label="Tu nombre visible"
          initial={data.me.displayName}
          success="Nombre actualizado"
          onSave={(name) => updateDisplayName(userId, name)}
        />
        <PasswordForm />
      </Section>

      <Section title="Hogar">
        <NameForm
          label="Nombre del hogar"
          initial={data.household.name}
          success="Hogar actualizado"
          onSave={(name) => renameHousehold(data.household.id, name)}
        />
        <div>
          <h3 className="mb-2 text-sm font-medium">Miembros</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface px-4">
            {data.members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 py-3">
                <span className="font-medium">
                  {member.displayName}
                  {member.userId === userId && <span className="text-fg-muted"> (tú)</span>}
                </span>
                <span className="text-sm text-fg-muted">
                  {!member.active
                    ? 'Salió del hogar'
                    : member.role === 'owner'
                      ? 'Creó el hogar'
                      : 'Miembro'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="invitar"
        title="Invitar"
        description={
          activeMembers.length > 1
            ? 'Ya son dos en el hogar. Solo necesitas un código si se suma alguien más.'
            : 'Genera un código y compártelo con tu hermano. Él lo escribe al entrar por primera vez.'
        }
      >
        <Invitations />
      </Section>

      <Section title="Apariencia">
        <LinkRow
          to="/ajustes/apariencia"
          icon={<PaletteIcon />}
          title="Colores, letra y tamaño"
          detail={`${themes.find((theme) => theme.id === appearance.theme)?.name} ${modes.find((mode) => mode.id === appearance.mode)?.name.toLowerCase()} · ${fonts.find((font) => font.id === appearance.font)?.name}`}
        />
      </Section>

      <Section title="Alertas">
        <LinkRow
          to="/ajustes/alertas"
          icon={<BellIcon />}
          title="Avisos de gasto"
          detail={
            preferences.spendAlerts
              ? `Activados · atención desde el ${preferences.alertThreshold} %`
              : 'Desactivados'
          }
        />
      </Section>

      <Section title="Organizar">
        <div className="flex flex-col gap-2">
          <LinkRow
            to="/recurrentes"
            icon={<RepeatIcon />}
            title="Gastos recurrentes"
            detail="Arriendo, servicios, suscripciones"
          />
          <LinkRow
            to="/ajustes/categorias"
            icon={<TagIcon />}
            title="Categorías"
            detail="Crear, renombrar o archivar"
          />
        </div>
      </Section>

      <Section
        title="Exportar"
        description="Descarga todo como respaldo: gastos, ingresos, transferencias, categorías y recurrentes."
      >
        <ExportButtons />
      </Section>

      <Section title="Sesión">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => supabase.auth.signOut()}
            icon={<SignOutIcon aria-hidden="true" className="size-4" weight="bold" />}
          >
            Cerrar sesión
          </Button>
        </div>
      </Section>

      <section
        aria-labelledby="peligro-title"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-negative/40 p-5"
      >
        <h2 id="peligro-title" className="flex items-center gap-2 text-lg font-semibold">
          <WarningIcon aria-hidden="true" className="size-5 text-negative" weight="bold" />
          Zona de peligro
        </h2>
        <p className="text-sm text-fg-muted">
          Salir del hogar te quita el acceso a {data.household.name}. No se puede deshacer desde
          aquí.
        </p>
        <Button variant="danger" className="self-start" onClick={() => setConfirmLeave(true)}>
          Salir del hogar
        </Button>
      </section>

      <ConfirmDialog
        open={confirmLeave}
        title="¿Salir del hogar?"
        confirmLabel="Sí, salir"
        loading={leaving}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={async () => {
          setLeaving(true)
          try {
            await leaveHousehold(data.household.id)
            invalidateData()
          } catch (error) {
            toast.show(toUserMessage(error), 'error')
            setLeaving(false)
            setConfirmLeave(false)
          }
        }}
      >
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Dejarás de ver los movimientos, el saldo y los reportes de {data.household.name}.</li>
          <li>
            Nada se borra: lo que registraste sigue en el historial y en los saldos de{' '}
            {activeMembers.filter((member) => member.userId !== userId).length
              ? activeMembers
                  .filter((member) => member.userId !== userId)
                  .map((member) => member.displayName)
                  .join(', ')
              : 'el hogar'}
            .
          </li>
          <li>
            No podrás registrar ni anular movimientos. Para volver necesitas un código de invitación
            nuevo de alguien del hogar.
          </li>
        </ul>
      </ConfirmDialog>
    </Page>
  )
}
