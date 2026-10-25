# Revisión de seguridad y robustez (FASE 14)

Checklist de la spec §63 con el estado verificado al 2026-10-12.

| Punto                      | Estado | Evidencia                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS                        | ✅     | RLS en todas las tablas de `public`, cada una con políticas (`01_security`). Aislamiento entre households probado en `02` a `08` (194 tests pgTAP; `07` cubre el registro solo con invitación, `08` las categorías múltiples y la tarjeta, `09` los pagos de tarjeta y la privacidad de los presupuestos, y `10` la gráfica de Reportes y las alertas). |
| Grants                     | ✅     | `anon` sin ningún privilegio sobre tablas ni funciones (`01_security`). GRANTs por columna: el cliente no puede escribir `household_id` en un update, ni `created_by` ni `currency` del household. Verificado también en la nube: una petición anónima a `expenses` recibe `42501`.                                                                     |
| Secrets                    | ✅     | Solo la publishable key en el frontend. `npm run build` ejecuta `check:secrets`, que revisa `src/`, `dist/` y los `.env`. `.env*` está en `.gitignore`.                                                                                                                                                                                                 |
| Validaciones               | ✅     | Zod en los formularios y restricciones en Postgres: montos > 0 y ≤ 10^14, porcentajes que suman 100 %, `from ≠ to`, categoría del tipo correcto, miembros activos. Los splits se comprueban con un constraint trigger diferido.                                                                                                                         |
| Duplicados                 | ✅     | Botones deshabilitados mientras se guarda (`isSubmitting`, `fieldset disabled`). Recurrentes: `FOR UPDATE` e índice único por ocurrencia. Invitaciones: `FOR UPDATE` y un solo uso.                                                                                                                                                                     |
| Errores                    | ✅     | Las claves de error de la BD se traducen a mensajes humanos (`src/i18n/es.ts`) y el detalle técnico solo va a la consola en desarrollo. Hay estado de error con "Reintentar" al cargar el hogar.                                                                                                                                                        |
| Permisos                   | ✅     | Ingresos: cualquier miembro del household los crea y edita (decisión del usuario); nadie de fuera. Movimientos anulados en solo lectura (trigger). Sin DELETE en movimientos financieros.                                                                                                                                                               |
| Usuario externo            | ✅     | Tests pgTAP: un usuario de otro household no ve, no edita, no anula y no puede usar categorías ajenas.                                                                                                                                                                                                                                                  |
| Expiración de sesión       | ✅     | supabase-js renueva el token. Si la renovación falla emite `SIGNED_OUT` y `RequireAuth` lleva a `/entrar`. Un JWT vencido se muestra como "Tu sesión expiró".                                                                                                                                                                                           |
| Exportación                | ✅     | Tests unitarios de CSV y JSON, con escape de `;`, comillas y saltos de línea, y neutralización de fórmulas (`=`, `+`, `-`, `@`) para evitar inyección en hojas de cálculo.                                                                                                                                                                              |
| Recuperación de contraseña | ➖     | Fuera de alcance por decisión (auth simplificada). Cambio de contraseña con sesión iniciada en Ajustes; reset desde el dashboard de Supabase.                                                                                                                                                                                                           |

## Cabeceras HTTP (Vercel)

`vercel.json` define una CSP que solo permite scripts propios y conexiones a `*.supabase.co`, además
de `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Comprobé que la app
completa (Inicio, Reportes con gráficos, formularios, Ajustes) funciona con esa CSP sin violaciones.

## Robustez de la interfaz

- Textos largos truncados en filas y categorías. El saldo grande usa un tamaño fluido y corta la
  línea con montos enormes.
- Campos con `maxLength` y validación en servidor.
- Inputs de 16 px (iOS no hace zoom), objetivos táctiles de al menos 44 px y enlace "Saltar al contenido".
- `prefers-reduced-motion`: se quitan desplazamientos y pulsos, y el spinner de carga se mantiene.
- Fechas siempre en America/Bogota y números en formato `es-CO` (`1.000.000`).
- El estado nunca depende solo del color: signo `+`/`−` y texto ("a tu favor", "en tu contra", "Anulado").

## Pendiente del lado del usuario

- ⚠️ **Desactivar "Allow new users to sign up"** en Supabase (Authentication → Sign In / Providers).
  El 2026-10-12 seguía activado en la nube.
- Activar "Leaked password protection" si el plan lo permite.
- Tras el primer deploy, revisar las cabeceras en <https://securityheaders.com>.

## Riesgos aceptados

- Sin clave de idempotencia en la red: si una petición se reintenta tras un corte, podría duplicarse
  un movimiento. Se mitiga deshabilitando el botón y, si pasa, se anula el duplicado.
- Sin tiempo real: lo que registra el otro aparece al volver a la pestaña (recarga automática al
  enfocar, como máximo cada 20 s) o al recargar.
