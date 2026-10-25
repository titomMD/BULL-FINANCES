# Despliegue: GitHub → Vercel (FASE 13)

La app es un frontend estático (Vite) que habla directo con Supabase. `vercel.json` ya trae:

- redirección de SPA (cualquier ruta sirve `index.html`, menos `/assets/`);
- cabeceras de seguridad: CSP que solo permite conectar con `*.supabase.co`, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy` y `Permissions-Policy`;
- caché larga para `/assets/*` (archivos con hash) y `no-cache` para `index.html`.

## 1. Repo en GitHub

El repo está en <https://github.com/camiloherrera-dev/BULLMILTON> (rama `main`). Cada push corre
el CI (`.github/workflows/ci.yml`): lint, formato, tipos, build con detector de secretos y los
tests pgTAP sobre un Postgres de Supabase local. No necesita secretos.

## 2. Crear el proyecto en Vercel

1. <https://vercel.com/new> → _Import Git Repository_ → elige `bullmilton`.
2. Framework: Vite (lo detecta solo). Build: `npm run build`. Output: `dist`.
3. _Environment Variables_ (para **Production** y **Preview**):
   - `VITE_SUPABASE_URL` = `https://<REF>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la `sb_publishable_…`
   - **Nunca** la secret key: el build falla si detecta una (`check:secrets`).
4. _Deploy_. Cada push a `main` despliega producción; cada rama o PR, un preview.

## 3. Ajustar Supabase a la URL de producción

En el dashboard de Supabase (detalle en `docs/SUPABASE.md`, paso 5):

1. _Authentication → URL Configuration_:
   - **Site URL**: `https://<tu-app>.vercel.app`
   - **Redirect URLs**: `https://<tu-app>.vercel.app/restablecer` y
     `https://<tu-app>.vercel.app/entrar` (más las de `localhost:5173` para desarrollo).
2. _Authentication → Hooks → Before User Created_ → Postgres → `public.hook_before_user_created`
   → activar. **Antes** de permitir el registro.
3. _Authentication → Sign In / Providers_ → **Allow new users to sign up: activado**; anónimos
   desactivado.
4. _Authentication → Emails_: plantilla "Reset Password" con el enlace `token_hash` y un SMTP
   propio (el correo de Supabase solo envía unos pocos por hora).

## 4. Comprobar

- Abre la URL, entra con tu cuenta y registra un gasto de prueba (luego usa "Deshacer").
- Ajustes → Invitar → "Copiar enlace": ábrelo en una ventana privada; con el código debe dejarte
  crear la cuenta y entrar al hogar, con un código inventado no.
- "¿Olvidaste tu contraseña?" con tu email: el enlace del correo debe abrir `/restablecer`.
- Recarga en una ruta interna (p. ej. `/movimientos`): debe cargar, no dar 404.
- En el navegador, _DevTools → Network_: las peticiones van solo a tu proyecto de Supabase.
- <https://securityheaders.com> con tu URL: CSP y demás cabeceras presentes.

## Dominio propio (opcional)

_Vercel → Project → Settings → Domains_. Si lo añades, actualiza Site URL y Redirect URLs en
Supabase con el nuevo dominio.
