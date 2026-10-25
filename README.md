# BULLMILTON

> **Origen.** Este proyecto parte de [BULLMILTON](https://github.com/camiloherrera-dev/BULLMILTON),
> de camiloherrera-dev, y se está adaptando a finanzas personales. El repo original no incluye
> licencia: antes de publicar esta versión, confirma por escrito con su autor qué se puede hacer
> (lo ideal es que añada una licencia, p. ej. MIT). Despliegue en Netlify: [`netlify.toml`](./netlify.toml).

Libreta financiera compartida para dos personas: registra gastos, ingresos y transferencias y
calcula automáticamente quién le debe cuánto a quién.

Especificación: [`SHAREDFIN_ESPECIFICACION_COMPLETA_CLAUDE_COLORES.md`](./SHAREDFIN_ESPECIFICACION_COMPLETA_CLAUDE_COLORES.md)
(el documento usa el nombre provisional "SharedFin").

## Stack

React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · React Router · React Hook Form + Zod · Recharts · Phosphor Icons · Supabase (Postgres + Auth + RLS) · Vercel

## Desarrollo local

Requiere Node.js ≥ 22.12.

```bash
npm install
cp .env.example .env.local   # URL + publishable key de Supabase
npm run dev                  # http://localhost:5173
npm test                     # tests unitarios (motor de balance, reportes, exportación)
npm run test:db              # migraciones + tests pgTAP de RLS (sin Docker)
npm run build                # typecheck + build + detector de secretos
npm run lint                 # ESLint
npm run format:check         # Prettier
```

## Qué hace

- **Inicio**: libro diario del hogar; el saldo entre los dos arriba y cada día con su saldo al cierre.
- **Registrar**: gasto (50/50 o porcentajes, quién pagó), ingreso (propio o compartido, de cualquiera de los dos) y transferencia (abono).
- **Movimientos**: historial con búsqueda y filtros por periodo, tipo, categoría y persona.
- **Recurrentes**: plantillas mensuales/trimestrales que aparecen en Inicio cuando vencen.
- **Reportes**: totales, aportes vs. lo que correspondía, ingresos, categorías y evolución mensual.
- **Mi plan** (`/plan`): ingresos, gastos fijos y ahorro de cada mes; lo que sobra es «Dinero mío». Privado.
- **Ajustes**: perfil, contraseña, hogar e invitación, categorías y exportación Excel/CSV/JSON.
- **Entrar con Google**: ver [`docs/GOOGLE_LOGIN.md`](./docs/GOOGLE_LOGIN.md).
- Los movimientos no se borran: se anulan y quedan en el historial.

## Supabase

- Puesta en marcha (nube sin Docker, o local con Docker): [`docs/SUPABASE.md`](./docs/SUPABASE.md)
- Modelo de datos, RLS, convención de saldo y claves de error: [`docs/DATABASE.md`](./docs/DATABASE.md)
- Despliegue en Vercel: [`docs/DEPLOY.md`](./docs/DEPLOY.md)
- Revisión de seguridad y robustez (FASE 14): [`docs/HARDENING.md`](./docs/HARDENING.md)

```bash
cp .env.example .env.local   # URL + publishable key (nunca la secret key)
npm run test:db              # migraciones + tests de RLS sin Docker
npm run db:push              # aplica las migraciones al proyecto enlazado
npm run check:secrets        # verifica que no hay claves privilegiadas en el frontend
```

## Estructura

```text
src/
├── components/   ui, forms, expenses, dashboard, charts
├── pages/        una carpeta por pantalla
├── hooks/
├── lib/
│   ├── supabase/      client.ts — cliente Supabase (solo publishable key)
│   ├── calculations/  motor de balance — TS puro, sin React, con tests
│   └── validation/    esquemas Zod
├── services/     acceso a datos
├── styles/       tokens.css — única fuente de los colores
├── types/  utils/  routes/
└── App.tsx
supabase/         config.toml, migrations/, seed.sql, tests/database/ (pgTAP)
scripts/          check-secrets.mjs, test-db/ (pgTAP sin Docker)
docs/             SUPABASE.md, DATABASE.md
```

## Colores

Los colores de la spec §40.1 viven solo en `src/styles/tokens.css` (`@theme` de Tailwind v4) y
se usan como utilidades: `bg-canvas`, `bg-surface`, `bg-surface-2`, `text-fg`, `text-fg-muted`,
`bg-primary`, `text-on-primary`, `bg-primary-soft`, `text-positive`, `bg-positive-bg`,
`text-negative`. La paleta por defecto de Tailwind está desactivada y ESLint bloquea HEX sueltos
en `src/`.
