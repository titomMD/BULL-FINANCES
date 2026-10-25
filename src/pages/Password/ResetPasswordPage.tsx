import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../lib/supabase/client'
import { toUserMessage } from '../../lib/errors'
import { newPasswordSchema, type NewPasswordValues } from '../../lib/validation/password'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Field'
import { ErrorState, FullScreenLoader } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'
import { Brand } from '../../components/Brand'

type Status = 'checking' | 'ready' | 'invalid'

/**
 * Lee el enlace de recuperación una sola vez. El cliente tiene detectSessionInUrl desactivado, así
 * que aquí se aceptan las dos formas que manda Supabase:
 *  - ?token_hash=…&type=recovery (plantilla recomendada en docs/SUPABASE.md; sirve aunque el
 *    correo se abra en otro navegador) → verifyOtp, que dispara PASSWORD_RECOVERY.
 *  - #access_token=…&type=recovery (plantilla por defecto) → setSession.
 * Después se limpia la URL para que los tokens no queden en el historial.
 */
async function consumeRecoveryLink(): Promise<boolean> {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  window.history.replaceState(null, '', window.location.pathname)

  if (hash.get('error') || query.get('error')) return false
  const tokenHash = query.get('token_hash')
  if (tokenHash && query.get('type') === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    return !error
  }
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken && hash.get('type') === 'recovery') {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    return !error
  }
  return false
}

// Un solo intento por carga de página (StrictMode monta dos veces en desarrollo).
let pending: Promise<boolean> | null = null
const forgetLink = () => {
  pending = null
}

/** /restablecer: el enlace del correo abre aquí y se elige una contraseña nueva. */
export function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const navigate = useNavigate()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) })

  useEffect(() => {
    let active = true
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) setStatus('ready')
    })
    pending ??= consumeRecoveryLink()
    pending.then(async (ok) => {
      if (!active) return
      // Sin enlace válido pero con la sesión abierta también se puede cambiar aquí.
      const { data: current } = await supabase.auth.getSession()
      if (active) setStatus(ok || current.session ? 'ready' : 'invalid')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const onSubmit = handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.show(toUserMessage(error), 'error')
      return
    }
    forgetLink()
    toast.show('Contraseña actualizada')
    navigate('/', { replace: true })
  })

  if (status === 'checking') return <FullScreenLoader label="Revisando el enlace" />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Brand size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {status === 'ready' ? 'Elige una contraseña nueva' : 'El enlace ya no sirve'}
        </h1>
      </header>

      {status === 'invalid' ? (
        <div className="flex flex-col gap-4">
          <ErrorState message="Puede que haya vencido o que ya lo hayas usado. Pide otro y ábrelo apenas llegue." />
          <Link
            to="/recuperar"
            className="inline-flex min-h-11 items-center self-start text-sm font-medium underline"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field
            label="Nueva contraseña"
            hint="Mínimo 8 caracteres, con letras y números."
            error={errors.password?.message}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="new-password"
                autoFocus
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
            {isSubmitting ? 'Guardando' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </main>
  )
}
