# BULLMILTON — reglas permanentes del proyecto

## Fuente de verdad

- La especificación es `SHAREDFIN_ESPECIFICACION_COMPLETA_CLAUDE_COLORES.md`. El documento llama
  al producto "SharedFin"; el nombre real es **BULLMILTON** (código, UI, package.json, docs).
  Todo lo demás del documento sigue vigente.
- Respeta las reglas de la sección 70: incremental, verificar antes de cambiar arquitectura,
  seguridad primero, no sobreingeniería, lógica financiera separada, database-first para reglas
  críticas, tests para dinero, cambios explicables.
- Si la spec choca con la documentación actual de Supabase / Vite / Tailwind / Vercel, señala el
  conflicto y propón la solución actual más sencilla (Regla 2). No cambies la arquitectura en
  silencio.

## Forma de trabajar

- **Una fase a la vez** (sección 49+). Al terminar cada fase: dar comandos para probarla,
  detenerse y esperar validación explícita antes de empezar la siguiente.
- Para cada tarea indicar: qué se hará, qué archivos cambian, por qué, cómo probarlo y el
  resultado esperado.
- Commits pequeños con prefijos `feat:` / `fix:` / `test:` / `ui:` / `chore:` (sección 48).

## Seguridad (P0)

- RLS habilitado en **todas** las tablas expuestas. Acceso siempre derivado de
  `auth.uid()` → `household_members` → `household_id`.
- Auth simplificada (decidido 2026-10-12): login/logout con email + contraseña, sesión
  persistente, rutas protegidas y recuperación de contraseña por email (`/recuperar` →
  `/restablecer`). Registro solo con código de invitación (`/registro`), exigido por el hook
  `public.hook_before_user_created` de Supabase Auth.
- Ninguna service key / secret key / password de Postgres en el frontend ni en variables
  `VITE_*`. En el cliente solo va la publishable (anon) key.
- Tests de RLS con pgTAP en `supabase/tests/database/`. Rápido sin Docker: `npm run test:db`;
  referencia: `supabase test db` (Docker o CI). Si RLS falla, no se construyen más features hasta
  arreglarlo.
- Cambios de esquema = migración nueva (`npx supabase migration new <nombre>`); nunca editar una
  migración ya aplicada en la nube. Cada migración termina con
  `revoke execute on all functions in schema public, private from public, anon;` y GRANTs
  explícitos (por columna cuando aplique) solo a `authenticated`.
- Funciones SECURITY DEFINER solo cuando RLS no alcanza, siempre con `set search_path = ''`.
- Modelo, convención de saldo y claves de error: `docs/DATABASE.md`. Puesta en marcha:
  `docs/SUPABASE.md`.
- Operaciones con varios cambios relacionados (gasto + splits) van en una función/RPC atómica.
- Nunca mostrar errores técnicos al usuario; mensajes humanos en la UI, detalle en logs.

## Dinero y fechas

- Dinero siempre en enteros (`bigint` en Postgres, `number` entero en TS; COP sin decimales).
  **Nunca float.** Siempre guardar `currency`. Porcentajes en puntos básicos (`share_bp`, 10000 = 100 %).
- Convención de saldo (corrige la spec §11):
  `saldo = pagado − su_parte + transferencias_enviadas − transferencias_recibidas`;
  > 0 le deben, < 0 debe.
- **Lo que ve el usuario es el saldo disponible, no deudas** (decidido 2026-10-12,
  `src/lib/calculations/available.ts`): `su parte de ingresos − su parte de gastos + recibidas −
enviadas`, acumulado entre meses. Quién pagó un gasto no importa. Solo si el saldo de alguien es
  negativo se dice que está usando el del otro. Un gasto con tarjeta no baja el saldo: queda
  "por pagar de tarjeta" hasta un `card_payments` (2026-10-13). Los presupuestos son privados de
  cada persona y cuentan su parte de los gastos (`budgets.ts`). El motor de deudas (`balance.ts`) sigue con sus
  tests pero la UI ya no lo muestra.
- "Lo que queda" del mes (2026-10-18, `remaining.ts` sobre `summarizePeriod`): su parte de los
  ingresos − su parte de los gastos (con tarjeta, al cargarse) − enviadas + recibidas; no arrastra
  meses. Restante del hogar = suma de los individuales. Las transferencias nunca son gasto.
  Series de Reportes en `charts.ts` y alertas de gasto en `alerts.ts` (con tests); preferencias
  (`report_chart`, `spend_alerts`, `spend_alert_threshold`) en `profiles` con `check` y pgTAP.
  Extracto (Reportes → Extracto, `statement.ts` + `lib/statementText.ts`): cada gasto cuenta una
  vez en su categoría principal; PDF con la impresión del navegador (`@media print` en tokens.css),
  sin librerías.
- Dinero personal (2026-10-20, `personal.ts`, tabla `personal_movements`, pantalla `/personal`):
  ingresos y gastos que cada persona lleva aparte; privado por RLS y fuera de todo cálculo del hogar
  (saldo disponible, lo que queda, reportes). Disponible personal = ingresos − gastos, acumulado.
- El motor de balance (`src/lib/calculations/`) es TypeScript puro, sin React, determinista y con
  tests unitarios. Toda modificación al motor incluye o actualiza tests. Nada de cálculos
  financieros dentro de JSX.
- Zona horaria **America/Bogota** explícita para fechas financieras (no depender del navegador).
  Las fechas financieras se guardan como `date`, no como timestamp.

## Diseño (la especificación manda sobre las skills)

- La paleta de la sección 40.1 es el tema por defecto ("Bullmilton"). El usuario añadió
  (2026-10-12) temas y tipografías elegibles en Ajustes → Apariencia; todos viven en el mismo
  archivo de tokens con `[data-theme]` / `[data-font]` y deben pasar WCAG AA. Tokens en **un solo lugar**:
  `src/styles/tokens.css` (variables CSS + `@theme` de Tailwind v4). **Nunca HEX sueltos** en
  componentes; usar las utilidades generadas (`bg-surface`, `text-primary`, ...).
- Si Impeccable o design-taste-frontend sugieren otra paleta, fuente o estilo que contradiga la
  spec, gana la spec: señalar el conflicto al usuario en vez de cambiarla.
- Mobile-first, botones grandes (objetivo táctil ≥ 44px), acciones rápidas
  (+ Gasto / + Ingreso / + Transferencia) siempre a mano. Contraste accesible (WCAG AA mínimo).
  El color nunca es el único indicador de estado: acompañar con texto, signo o icono.
- Uso de skills:
  - Antes de la primera pantalla real (FASE 2): `/impeccable init` → `PRODUCT.md`; luego crear
    `DESIGN.md` con los tokens de la sección 40.1.
  - Al construir UI: aplicar design-taste-frontend (diales 3 / 3 / 6) y la guía de Impeccable.
  - Al cerrar cada fase con UI (2, 3, 4, 8, 10, 12): `/impeccable audit` y `/impeccable critique`
    sobre las pantallas nuevas; corregir lo relevante con `/impeccable polish` o
    `/impeccable adapt`, y resumir hallazgos.
  - FASE 12: revisión completa con audit + critique + harden.
- No añadir dependencias de UI ni de animación sin justificarlo (sección 34). Stack permitido
  de base: react, react-dom, react-router, tailwindcss, @supabase/supabase-js, recharts, zod,
  react-hook-form. Añadidas con justificación: @hookform/resolvers (puente Zod ↔ RHF),
  @phosphor-icons/react (iconos: la spec pide icono por tipo/categoría y las skills prohíben
  emoji o SVG a mano), vitest (tests del motor financiero), PGlite + pgtap (tests de BD sin Docker),
  @fontsource-variable/{geist,manrope,ibm-plex-sans,atkinson-hyperlegible-next} (tipografías
  elegibles en Apariencia, autoalojadas porque la CSP solo permite fuentes propias).
- Estructura del Inicio: "Libro diario" (ver `.impeccable/surfaces/`). Producto: `PRODUCT.md`.
  Sistema visual: `DESIGN.md`.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run build` — typecheck + build de producción + `check:secrets`
- `npm test` — tests unitarios (Vitest)
- `npm run test:db` — migraciones + seed + tests pgTAP en PGlite (sin Docker)
- `npm run db:push` / `npm run db:types` — aplicar migraciones al proyecto enlazado / generar tipos
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
