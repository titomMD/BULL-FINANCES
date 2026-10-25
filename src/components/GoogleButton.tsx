import { useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { toUserMessage } from '../lib/errors'
import { Button } from './ui/Button'

// El logo de Google vive como archivo (public/google-g.svg): sus colores son de marca, no de la paleta.
function GoogleMark() {
  return <img src="/google-g.svg" alt="" aria-hidden="true" className="size-5" />
}

/**
 * Entrar o crear cuenta con Google. Si la cuenta no existe, Supabase la crea; al volver, la app
 * lee la sesión de la URL (AuthProvider) y la bienvenida arma el hogar personal.
 */
export function GoogleButton({ label = 'Continuar con Google' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setLoading(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // Con éxito el navegador ya se está yendo a Google; solo hay que reaccionar a un fallo.
    if (oauthError) {
      setError(toUserMessage(oauthError, 'No pudimos abrir Google. Inténtalo de nuevo.'))
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="lg"
        loading={loading}
        onClick={start}
        icon={loading ? undefined : <GoogleMark />}
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  )
}
