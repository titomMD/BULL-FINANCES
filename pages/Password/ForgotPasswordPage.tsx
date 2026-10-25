import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase/client'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { Brand } from '../../components/Brand'

const schema = z.object({ email: z.email('Escribe un email válido.') })

/**
 * "¿Olvidaste tu contraseña?": pide el enlace de Supabase. El mensaje final es el mismo exista o
 * no la cuenta, para no revelar qué emails están registrados.
 */
export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    const address = email.trim()
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    // Los errores (límite de envíos, email desconocido) solo van al log: la respuesta es igual.
    if (error && import.meta.env.DEV) console.error('[BULLMILTON]', error)
    setSentTo(address)
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Brand size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Recupera tu contraseña
        </h1>
      </header>

      {sentTo ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-3 rounded-xl bg-surface p-4">
            <EnvelopeSimpleIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <span>
              Si <strong className="font-semibold">{sentTo}</strong> tiene cuenta, te llegará un
              enlace para elegir una contraseña nueva. Vence en una hora.
            </span>
          </p>
          <p className="text-sm text-fg-muted">
            ¿No llega? Revisa el correo no deseado o espera unos minutos antes de pedir otro.
          </p>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 items-center self-start text-sm font-medium underline"
          >
            Volver a entrar
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <p className="text-fg-muted">
            Escribe el email con el que entras y te enviaremos un enlace para cambiarla.
          </p>
          <Field label="Email" error={errors.email?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...register('email')}
              />
            )}
          </Field>
          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
            {isSubmitting ? 'Enviando' : 'Enviar enlace'}
          </Button>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 items-center self-center text-sm font-medium text-fg-muted underline hover:text-fg"
          >
            Volver a entrar
          </Link>
        </form>
      )}
    </main>
  )
}
