# Iniciar sesión con Google

El botón «Continuar con Google» ya está en `/entrar` y `/registro`. Para que funcione hay que
configurar Google y Supabase una sola vez.

## 1. Google Cloud (credenciales OAuth)

1. <https://console.cloud.google.com> → crea un proyecto (o reutiliza el de otra app).
2. _APIs y servicios → Pantalla de consentimiento OAuth_: tipo **Externo**, nombre de la app,
   correo de soporte. Publícala (_En producción_) para que cualquiera pueda entrar; en modo
   _Prueba_ solo entran los correos que añadas como usuarios de prueba.
3. _Credenciales → Crear credenciales → ID de cliente de OAuth_ → tipo **Aplicación web**.
   - **Orígenes autorizados de JavaScript:** `https://freyappp.netlify.app`
   - **URI de redireccionamiento autorizados:** `https://<REF>.supabase.co/auth/v1/callback`
     (`<REF>` = las 20 letras de tu URL de Supabase).
4. Copia el **ID de cliente** y el **Secreto del cliente**.

## 2. Supabase

1. _Authentication → Sign In / Providers → Google_: actívalo y pega el ID y el secreto.
2. _Authentication → URL Configuration_:
   - **Site URL:** `https://freyappp.netlify.app`
   - **Redirect URLs:** `https://freyappp.netlify.app/**` (y `http://localhost:5173/**` si pruebas en local).

## Cómo funciona en el código

- `GoogleButton` llama a `supabase.auth.signInWithOAuth({ provider: 'google' })` con
  `redirectTo` = el origen del sitio.
- Al volver, la sesión llega en la URL (`#access_token=…`). El cliente tiene
  `detectSessionInUrl: false` (el enlace de recuperar contraseña lo lee `/restablecer`), así que
  `AuthProvider` la toma con `setSession` y limpia la URL.
- La cuenta nueva pasa por `/bienvenida`, que crea el hogar personal «Mis finanzas».
- El nombre del perfil sale de `full_name` de Google (migración `20261025120000_open_signup_plan.sql`).
