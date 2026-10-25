import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSignedInUser } from '../../app/auth-context'
import { invalidateData, useResource } from '../../hooks/useResource'
import { toUserMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase/client'
import { acceptInvitation, createHousehold, fetchMyHousehold } from '../../services/household'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { ErrorState, FullScreenLoader } from '../../components/ui/States'
import { Segmented } from '../../components/ui/Segmented'
import { Brand } from '../../components/Brand'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre.').max(60, 'Máximo 60 caracteres.'),
})

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/, 'El código tiene 10 letras y números.')),
})

type Mode = 'create' | 'join'

function CreateForm() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createSchema>, unknown, z.output<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: 'Casa' },
  })

  const onSubmit = handleSubmit(async ({ name }) => {
    setError(null)
    try {
      await createHousehold(name)
      invalidateData()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(toUserMessage(caught, 'No pudimos crear el hogar.'))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <ErrorState message={error} />}
      <Field
        label="Nombre del hogar"
        hint="Después podrás invitar a tu hermano con un código."
        error={errors.name?.message}
      >
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
      <Button type="submit" size="lg" loading={isSubmitting}>
        Crear hogar
      </Button>
    </form>
  )
}

function JoinForm({ defaultCode, autoJoin }: { defaultCode?: string; autoJoin?: boolean }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof joinSchema>, unknown, z.output<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: defaultCode ?? '' },
  })

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null)
    try {
      await acceptInvitation(code)
      invalidateData()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(toUserMessage(caught, 'No pudimos unirte al hogar.'))
    }
  })

  // Quien se registró con un código se une solo, una vez (StrictMode monta dos veces).
  const tried = useRef(false)
  useEffect(() => {
    if (!autoJoin || tried.current) return
    tried.current = true
    void onSubmit()
  }, [autoJoin, onSubmit])

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <ErrorState message={error} />}
      <Field
        label="Código de invitación"
        hint="Lo genera quien creó el hogar, en Ajustes."
        error={errors.code?.message}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="tabular font-semibold tracking-[0.2em] uppercase"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('code')}
          />
        )}
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Unirme
      </Button>
    </form>
  )
}

/** Sin código de invitación: se crea solo el hogar personal («Mis finanzas») y se entra. */
function AutoSetup({ onFail }: { onFail: () => void }) {
  const navigate = useNavigate()
  // Una sola vez (StrictMode monta dos veces en desarrollo).
  const tried = useRef(false)
  useEffect(() => {
    if (tried.current) return
    tried.current = true
    createHousehold('Mis finanzas')
      .then(() => {
        invalidateData()
        navigate('/', { replace: true })
      })
      .catch(onFail)
  }, [navigate, onFail])
  return <FullScreenLoader label="Preparando tu espacio" />
}

/**
 * Primer ingreso: con código de invitación se une al hogar; sin código se crea su hogar personal.
 * Si la creación automática falla, se muestra el formulario para hacerlo a mano.
 */
export function WelcomePage() {
  const { userId, email, session } = useSignedInUser()
  // Código con el que se registró (/registro lo guarda en los metadatos de la cuenta).
  const invited = (session.user.user_metadata?.invite_code as string | undefined) ?? undefined
  const [mode, setMode] = useState<Mode>(invited ? 'join' : 'create')
  const [autoFailed, setAutoFailed] = useState(false)
  const existing = useResource(`household:${userId}`, () => fetchMyHousehold(userId))

  if (existing.loading) return <FullScreenLoader />
  if (existing.data) return <Navigate to="/" replace />
  if (!invited && !autoFailed) return <AutoSetup onFail={() => setAutoFailed(true)} />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Brand size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight">Arma tu hogar</h1>
        <p className="text-fg-muted">Crea tu espacio o únete a uno con un código de invitación.</p>
      </header>

      <Segmented<Mode>
        label="¿Qué quieres hacer?"
        hideLabel
        value={mode}
        onChange={setMode}
        options={[
          { value: 'create', label: 'Crear hogar' },
          { value: 'join', label: 'Tengo un código' },
        ]}
      />

      {mode === 'create' ? (
        <CreateForm />
      ) : (
        <JoinForm defaultCode={invited} autoJoin={Boolean(invited)} />
      )}

      <p className="text-sm text-fg-muted">
        Entraste como {email}.{' '}
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="font-medium text-fg underline hover:text-primary"
        >
          Cerrar sesión
        </button>
      </p>
    </main>
  )
}
