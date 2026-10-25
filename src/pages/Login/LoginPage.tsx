import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase/client'
import { toUserMessage } from '../../lib/errors'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { ErrorState } from '../../components/ui/States'
import { Brand } from '../../components/Brand'
import { GoogleButton } from '../../components/GoogleButton'

const schema = z.object({
  email: z.email('Escribe un email válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

type FormValues = z.infer<typeof schema>

// Registro abierto: /registro (email o Google). El código de invitación solo sirve para unirse a un hogar.
// La contraseña olvidada se recupera por email: /recuperar → /restablecer.
export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    // Con éxito, AuthProvider recibe la sesión y PublicOnly redirige a la app.
    if (signInError) setError(toUserMessage(signInError))
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Brand size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Entra para ver cómo van tus finanzas
        </h1>
      </header>

      <GoogleButton />
      <p className="flex items-center gap-3 text-sm text-fg-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        o con tu email
      </p>

      <form onSubmit={onSubmit} noValidate className="-mt-4 flex flex-col gap-4">
        {error && <ErrorState message={error} />}
        <Field label="Email" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('email')}
            />
          )}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
          {isSubmitting ? 'Entrando' : 'Entrar'}
        </Button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/registro" className="font-medium text-fg underline hover:text-primary">
          Crea tu cuenta
        </Link>
      </p>
      <Link
        to="/recuperar"
        className="inline-flex min-h-11 items-center self-center text-sm font-medium text-fg-muted underline hover:text-fg"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </main>
  )
}
