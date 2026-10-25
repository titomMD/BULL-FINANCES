import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import '@fontsource-variable/geist'
import '@fontsource-variable/manrope'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/atkinson-hyperlegible-next'
import './index.css'
import { AuthProvider } from './app/AuthProvider'
import { router } from './app/router'
import { ToastProvider } from './components/ui/ToastProvider'
import { applyAppearance, cachedAppearance } from './lib/appearance'
import { installPrivacyReveal } from './lib/privacy'

// Tema de este navegador antes del primer render; la cuenta lo confirma al iniciar sesión.
applyAppearance(cachedAppearance())
installPrivacyReveal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
