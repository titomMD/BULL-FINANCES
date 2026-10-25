import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase/client'
import { toUserMessage } from '../../lib/errors'
import { newPasswordSchema } from '../../lib/validation/password'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { ErrorState } from '../../components/ui/States'
import { Brand } from '../../components/Brand'

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/, 'El código tiene 10 letras y números.')),
    name: z.string().trim().min(1, '¿Cómo te llamas?').max(60, 'Máximo 60 caracteres.'),
    email: z.email('Escribe un email válido.'),
  })
  .and(newPasswordSchema)

/**
 * Registro solo con invitación (decisión del usuario, 2026-10-12). El código viaja en los
 * metadatos de la cuenta: el hook de Supabase Auth lo verifica antes de crearla y, al entrar,
 * la bienvenida une a la persona al hogar con ese mismo código.
 */
export function RegisterPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: params.get('codigo') ?? '' },
  })

  const onSubmit = handleSubmit(async ({ code, name, email, password }) => {
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim(), invite_code: code },
        // Tras confirmar, a /entrar: el cliente no lee sesiones de la URL (detectSessionInUrl).
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    })
    if (signUpError) {
      setError(toUserMessage(signUpError, 'No pudimos crear la cuenta. Revisa el código.'))
      return
    }
    // Con sesión, AuthProvider la recibe y PublicOnly lleva a la app (la bienvenida usa el
    // código). Sin sesión, el proyecto pide confirmar el email primero.
    if (!data.session) setCheckEmail(email.trim())
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Brand size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Crea tu cuenta</h1>
        <p className="text-fg-muted">
          Solo con el código de invitación que te dio alguien del hogar.
        </p>
      </header>

      {checkEmail ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-3 rounded-xl bg-surface p-4">
            <EnvelopeSimpleIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <span>
              Te enviamos un correo a <strong className="font-semibold">{checkEmail}</strong>.
              Confírmalo y entra: te uniremos al hogar con tu código.
            </span>
          </p>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 items-center self-start text-sm font-medium underline"
          >
            Ir a entrar
          </Link>
        </div>
      ) : (
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
          <Field label="Tu nombre" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                autoComplete="given-name"
                maxLength={60}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('name')}
              />
            )}
          </Field>
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
          <Field
            label="Contraseña"
            hint="Mínimo 8 caracteres, con letras y números."
            error={errors.password?.message}
          >
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
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
            {isSubmitting ? 'Creando cuenta' : 'Crear cuenta'}
          </Button>
          <p className="text-center text-sm text-fg-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/entrar" className="font-medium text-fg underline hover:text-primary">
              Entra
            </Link>
          </p>
        </form>
      )}
    </main>
  )
}
