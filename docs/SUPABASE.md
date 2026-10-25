# Supabase — puesta en marcha

Todo lo de Supabase vive en `supabase/` y se maneja con el CLI instalado como dependencia de
desarrollo (`npx supabase ...` o los scripts `npm run db:*`). No hace falta instalar nada global.

```text
supabase/
├── config.toml                 configuración del entorno local (Auth, API, puertos)
├── migrations/                 esquema versionado: la única fuente de verdad de la BD
│   ├── 20261012000100_base.sql        esquema private, auditoría, profiles
│   ├── 20261012000200_households.sql  households, miembros, invitaciones + RPC
│   └── 20261012000300_finance.sql     categorías, gastos, splits, ingresos, transferencias, recurrentes
├── seed.sql                    datos de desarrollo (solo local, nunca en producción)
└── tests/database/             tests pgTAP de RLS e integridad
```

## Opción A — Proyecto en la nube (no necesita Docker)

Autenticación (decisiones del 2026-10-12): **registro solo con código de invitación** en
`/registro`, y la contraseña olvidada se recupera desde la app ("¿Olvidaste tu contraseña?" →
correo → `/restablecer`). Ver el paso 5.

Los comandos `npx supabase ...` piden datos de forma interactiva (navegador, contraseña,
confirmación): ejecútalos en tu propia terminal, en la carpeta del proyecto.

1. **Crear el proyecto** en <https://supabase.com/dashboard> → _New project_.
   - Nombre: `bullmilton`. Región: la más cercana a Colombia (p. ej. `East US (North Virginia)`).
   - **Database password**: genera una y guárdala en tu gestor de contraseñas (no en el repo).
   - Si aparecen las opciones de Data API: deja **Data API activada**. "Exponer tablas nuevas
     automáticamente" puede ir desactivado: las migraciones dan los permisos explícitos.
2. **Iniciar sesión con el CLI**:
   ```bash
   npx supabase login
   ```
3. **Enlazar el repo con el proyecto** (pide la database password):
   ```bash
   npx supabase link --project-ref <REF>
   ```
   `REF` es el id de la URL del dashboard: `supabase.com/dashboard/project/<REF>`.
4. **Aplicar las migraciones** (lista las 3 migraciones y pide confirmación):
   ```bash
   npm run db:push
   ```
   El seed **no** se sube: tiene contraseñas conocidas y es solo para desarrollo local.
5. **Configurar Auth** en el dashboard (el `config.toml` solo aplica al entorno local):
   - **Primero el hook, después el registro** (en este orden; al revés, el registro quedaría
     abierto unos minutos): _Authentication → Hooks → Before User Created_ → **Postgres** →
     schema `public`, función `hook_before_user_created` → activarlo. La función la crea la
     migración `20261012171142_invite_only_signup.sql`: rechaza cualquier cuenta sin un código de
     invitación vigente. Con el hook activo, "Add user" del panel también pide código; las
     cuentas nuevas se crean desde `/registro`.
   - _Authentication → Sign In / Providers_:
     - **Allow new users to sign up: activado** (solo después de activar el hook).
     - **Allow anonymous sign-ins: desactivado.**
     - Email: activado. "Confirm email" da igual (las cuentas se crean ya confirmadas).
   - _Authentication → URL Configuration_ (las redirecciones que no estén aquí se rechazan):
     - **Site URL**: `http://localhost:5173` en desarrollo; en producción, la URL de Vercel
       (`https://<tu-app>.vercel.app`).
     - **Redirect URLs** (añade cada una):
       - `http://localhost:5173/restablecer` y `http://localhost:5173/entrar`
       - `https://<tu-app>.vercel.app/restablecer` y `https://<tu-app>.vercel.app/entrar`
         (`/entrar` es a donde lleva el correo de confirmación del registro)
       - Si usas despliegues de vista previa de Vercel:
         `https://<tu-app>-*-<tu-equipo>.vercel.app/restablecer`
       - Si conectas un dominio propio: `https://<tu-dominio>/restablecer`
   - _Authentication → Emails → Reset Password_ (plantilla): cambia el enlace por
     ```html
     <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery"
       >Elegir una contraseña nueva</a
     >
     ```
     Es la misma plantilla que `supabase/templates/recovery.html` (la local). Con ella el enlace
     funciona aunque se abra en otro navegador o dispositivo. Si dejas la plantilla por defecto
     también funciona, pero solo en el navegador donde se abra el enlace.
   - El correo por defecto de Supabase permite muy pocos envíos por hora y es solo para pruebas.
     Para uso diario configura un SMTP propio en _Authentication → Emails → SMTP Settings_.
   - _Authentication → Policies / Password_ (si está disponible): longitud mínima 8.
6. **Crear las dos cuentas**: _Authentication → Users → Add user → Create new user_.
   - Email y contraseña de cada uno, con **Auto Confirm User** marcado.
   - Cada cuenta crea su fila en `public.profiles` automáticamente (lo hace un trigger).
7. **Poner los nombres visibles** (por defecto se usa lo que va antes de la @ del email):
   _SQL Editor_ →
   ```sql
   update public.profiles p set display_name = v.name
   from (values ('tu@email.com', 'Camilo'), ('hermano@email.com', 'Nombre')) as v (email, name)
   join auth.users u on u.email = v.email
   where p.id = u.id;

   select display_name from public.profiles;
   ```
8. **Comprobar la seguridad**: _Advisors → Security Advisor_ no debe mostrar errores de RLS.
   En _Table Editor_, todas las tablas deben aparecer con RLS activado.
9. **Variables del frontend**: copia `.env.example` a `.env.local` y completa los dos valores:
   - `VITE_SUPABASE_URL`: botón _Connect_ o _Project Settings → Data API_ (`https://<REF>.supabase.co`).
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: _Project Settings → API Keys_, la que empieza por
     `sb_publishable_`. **Nunca la secret key.**
10. **Generar los tipos TypeScript** desde el esquema real:
    ```bash
    npm run db:types           # escribe src/types/database.ts
    npm run build              # debe terminar con "Sin secretos en el frontend"
    ```

El household se crea desde la app en la FASE 3: uno lo crea y el otro se une con el código de
invitación.

## Opción B — Supabase local (requiere Docker Desktop)

```bash
npm run db:start           # levanta Supabase local (la primera vez descarga imágenes)
npm run db:reset           # aplica migraciones + seed.sql desde cero
npm run db:test            # tests pgTAP contra Supabase real
npx supabase status        # URL y publishable key locales → .env.local
npm run db:types:local     # tipos desde la BD local
npm run db:stop
```

- Studio local: <http://127.0.0.1:54323> · Emails de prueba (Mailpit): <http://127.0.0.1:54324>
- Cuentas del seed: `ana@bullmilton.test` / `beto@bullmilton.test`, contraseña `Bullmilton2026`.
- El registro está desactivado también en local (`config.toml`); para más cuentas usa Studio.

## Tests de base de datos

| Comando                         | Qué usa                                                  | Cuándo                                         |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `npm run test:db`               | Postgres en WASM (PGlite) + simulador mínimo de Supabase | Siempre; no necesita Docker ni red             |
| `npm run db:test`               | Supabase local real (Docker)                             | Si tienes Docker                               |
| CI (`.github/workflows/ci.yml`) | Supabase real en GitHub Actions                          | En cada push/PR una vez el repo esté en GitHub |

`test:db` es la verificación rápida del día a día. La de referencia es `supabase test db`
(local o CI), porque usa los roles, extensiones y Auth reales de Supabase.

> `supabase test db --linked` existe, pero el CLI ejecuta `pg_prove` dentro de un contenedor,
> así que también necesita Docker.

## Flujo para cambios de esquema (fases siguientes)

1. Crear una migración nueva: `npx supabase migration new <nombre>` (nunca editar una ya aplicada
   en la nube).
2. Al final de cada migración, repetir el bloque de privilegios:
   ```sql
   revoke execute on all functions in schema public, private from public, anon;
   grant ... to authenticated;   -- solo lo necesario
   ```
3. Añadir/actualizar tests en `supabase/tests/database/`.
4. `npm run test:db` → `npm run db:push` → `npm run db:types`.

## Restaurar el proyecto desde cero (spec §46)

1. Crear un proyecto nuevo y seguir la Opción A (link + `db push`): el esquema completo sale de
   `supabase/migrations/`.
2. Importar los datos desde la exportación JSON/CSV de la app (FASE 11) o desde un backup de
   Supabase (_Database → Backups_).
