# Modelo de datos y reglas de seguridad

Referencia del esquema creado en FASE 1. La fuente de verdad son las migraciones de
`supabase/migrations/`; este documento explica el porqué.

## Convenciones

| Tema               | Decisión                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dinero             | `bigint` en la unidad mínima (COP sin decimales). Tope 10^14 por registro, muy por debajo del entero seguro de JS. Nunca float.      |
| Porcentajes        | `share_bp` entero en **puntos básicos**: 10000 = 100 %, 3333 = 33,33 %.                                                              |
| Moneda             | Columna `currency` en cada movimiento (por defecto la del household, `COP`).                                                         |
| Fechas financieras | Tipo `date`. "Hoy" = `private.today_bogota()` (America/Bogota), no la hora del navegador ni del servidor.                            |
| Borrado            | Gastos, ingresos y transferencias **no se borran**: `status = 'voided'` + `voided_at`/`voided_by`. Un registro anulado es inmutable. |
| Auditoría          | `created_by/created_at/updated_by/updated_at` los fija un trigger desde `auth.uid()`; el cliente no puede escribirlos.               |
| Errores            | Las funciones lanzan una clave estable en el mensaje (tabla abajo); el frontend la traduce.                                          |

## Convención de saldo (corrige la fórmula de la spec §11)

La spec §11 suma las transferencias recibidas, y eso invierte su efecto. La convención única
del proyecto es:

```text
saldo(persona) = Σ gastos que pagó
               − Σ su parte de los gastos (expense_splits.amount)
               + Σ transferencias que envió
               − Σ transferencias que recibió

saldo > 0  → le deben dinero
saldo < 0  → debe dinero
Σ saldos de todos los miembros = 0
```

Ejemplo de la spec §9: A paga 1.000.000 (50/50) → A = +500.000, B = −500.000.
B transfiere 300.000 a A → A = +200.000, B = −200.000 → "B debe 200.000 a A". ✓

Solo cuentan los registros con `status = 'active'`. Los ingresos no afectan el saldo (§6), ni siquiera
los compartidos: su reparto (`income_splits`) solo sirve para los reportes de cada persona.
El cálculo vive en `src/lib/calculations/` (FASE 7), no en SQL ni en componentes.

**Dato de control con el seed local:** Ana pagó 1.335.000 y le corresponden 768.950; Beto pagó
164.900 y le corresponden 730.950; Beto transfirió 300.000. Resultado: **Beto debe 266.050 a Ana**.

## Reparto de un gasto entre personas

- La división se guarda **por persona** en `expense_splits` con `share_bp` y `amount`.
- `amount` se calcula en la base de datos con `private.allocate_split_amounts()`:
  `floor(monto × bp / 10000)` para cada persona. Los pesos que sobran (siempre menos que el
  número de personas) se reparten de uno en uno por mayor resto y, si hay empate, por `user_id`.
  Es determinista y la suma es exacta. Ejemplo: 100.001 al 50/50 → 50.001 + 50.000.
- Un **constraint trigger diferido** comprueba al hacer commit que la suma de `share_bp` es
  10000, que la suma de `amount` es el monto del gasto y que cada `amount` coincide con el
  reparto. Ningún camino de escritura puede dejar datos inconsistentes.
- Para escribir se usan las RPC atómicas `create_expense` / `update_expense` / `void_expense`.

## Tablas

| Tabla                              | Para qué                                                                                                                                                                                                                                                                                                                                                                                                      | Escritura desde el cliente                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                         | Nombre visible y apariencia de cada cuenta (tema, modo, acento, fuente, densidad, texto, esquinas, movimiento, modo privado), sus preferencias (`report_chart`: vista de Reportes; `spend_alerts` y `spend_alert_threshold` 50/60/70/80/90: alertas de gasto; todas con `check`) y su color de persona, único entre los miembros activos del hogar (trigger `guard_person_color`, error `person_color_taken`) | `update` del propio perfil, por columna                                                                                   |
| `households`                       | Espacio compartido                                                                                                                                                                                                                                                                                                                                                                                            | `update (name)`; crear solo con `create_household()`                                                                      |
| `household_members`                | Pertenencia; `left_at` en lugar de borrar                                                                                                                                                                                                                                                                                                                                                                     | Solo vía RPC                                                                                                              |
| `invitations`                      | Códigos de un solo uso, 7 días                                                                                                                                                                                                                                                                                                                                                                                | Crear vía RPC; revocar (`delete`) las no usadas                                                                           |
| `categories`                       | Categorías por household, `kind` = `expense` / `income`                                                                                                                                                                                                                                                                                                                                                       | CRUD; borrar falla si está en uso (se archiva)                                                                            |
| `expenses`                         | Gastos                                                                                                                                                                                                                                                                                                                                                                                                        | Vía RPC (insert directo exige splits en la misma transacción)                                                             |
| `expense_splits`                   | Parte de cada persona en un gasto                                                                                                                                                                                                                                                                                                                                                                             | Vía RPC                                                                                                                   |
| `expense_categories`               | Categorías adicionales de un gasto (la principal sigue en `expenses.category_id`); un gasto cuenta completo en cada una en los reportes. `expenses.paid_with_card` y `recurring_expenses.paid_with_card` marcan el pago con tarjeta                                                                                                                                                                           | `select`, `insert`, `delete` vía `create_expense` / `update_expense` (`p_extra_category_ids`, máx. 5; `p_paid_with_card`) |
| `card_payments`                    | Lo que una persona abona de su parte de la tarjeta: baja su saldo disponible y lo que tiene por pagar (un gasto con `paid_with_card` no baja el saldo hasta entonces). Mismo esquema que `transfers`                                                                                                                                                                                                          | `select`; `insert`/`update` por columna (anular con `status`)                                                             |
| `budgets`                          | Presupuesto personal y **privado** (RLS: `user_id = auth.uid()`): por categoría, tope total o libre; por mes o por semana                                                                                                                                                                                                                                                                                     | `select`, `delete`; `insert`/`update` por columna                                                                         |
| `budget_expenses`                  | Gastos que una persona cuenta en sus presupuestos libres (privado)                                                                                                                                                                                                                                                                                                                                            | `select`, `insert`, `delete`; `set_expense_budgets(p_expense_id, p_budget_ids)`                                           |
| `personal_movements`               | Dinero personal y **privado** (RLS: `user_id = auth.uid()`): ingresos y gastos que una persona lleva aparte. No entra en el saldo disponible, en lo que queda ni en los reportes del hogar (2026-10-20)                                                                                                                                                                                                       | `select`; `insert`/`update` por columna (anular con `status`)                                                             |
| `incomes` (+ `income_splits`)      | Ingresos; `user_id` = quién lo recibió, splits = de quién es                                                                                                                                                                                                                                                                                                                                                  | Vía RPC `create_income`/`update_income`/`void_income`, cualquier miembro                                                  |
| `transfers`                        | Dinero entre miembros (`from_user ≠ to_user`)                                                                                                                                                                                                                                                                                                                                                                 | Insert/update por cualquier miembro                                                                                       |
| `recurring_expenses` (+ `_splits`) | Plantillas de gastos periódicos (mensual/trimestral)                                                                                                                                                                                                                                                                                                                                                          | RPC en FASE 9                                                                                                             |

## Gastos recurrentes (migración 04)

- `anchor_day` guarda el día del mes de la plantilla: una del 31 cae el 30 de abril y vuelve al 31
  en mayo (`private.next_occurrence`).
- Al abrir la app, Inicio muestra las plantillas activas con `next_due_date <= hoy` (Bogotá).
- `generate_recurring_expense(id, monto?, fecha?)` crea el gasto con la división de la plantilla y
  adelanta la próxima fecha, todo en una transacción y con `FOR UPDATE`. El índice único
  `(recurring_expense_id, recurring_due_date)` impide generar dos veces la misma ocurrencia.
- `skip_recurring_expense(id)` adelanta la fecha sin crear gasto. Borrar una plantilla conserva
  los gastos ya generados (`ON DELETE SET NULL (recurring_expense_id)`).

## Seguridad

- **RLS en todas las tablas.** Regla única: `household_id in (select private.current_household_ids())`,
  es decir, households donde `auth.uid()` es miembro **activo**. Postgres evalúa la subconsulta
  una sola vez por consulta.
- **`anon` no tiene ningún privilegio** sobre tablas ni funciones (lo verifica el test `01_security`).
- **GRANTs por columna:** el cliente no puede escribir `household_id` en un update, ni
  `created_by`, `status` al crear, `currency` del household, etc.
- **FKs compuestas** `(x, household_id)`: una categoría, un pagador o un split nunca pueden ser
  de otro household. Además hay triggers que exigen que las personas sean miembros **activos**
  y que la categoría sea del tipo correcto.
- **RPC SECURITY DEFINER** solo donde RLS no alcanza (crear household, invitar, aceptar,
  abandonar), todas con `search_path = ''` y comprobación explícita de identidad.
- Las RPC de gastos son **SECURITY INVOKER**: RLS se aplica igual que en una escritura directa.
- El esquema `private` no está expuesto en la Data API.

## Claves de error

| Clave                                      | SQLSTATE | Mensaje sugerido para la UI                                 |
| ------------------------------------------ | -------- | ----------------------------------------------------------- |
| `not_authenticated`                        | 42501    | Tu sesión expiró. Vuelve a iniciar sesión.                  |
| `forbidden`                                | 42501    | No tienes acceso a este espacio.                            |
| `already_in_household`                     | P0001    | Ya perteneces a un hogar. Sal de él antes de unirte a otro. |
| `invalid_invitation`                       | P0001    | El código no es válido o ya venció. Pide uno nuevo.         |
| `split_must_total_100`                     | 23514    | Los porcentajes deben sumar 100 %.                          |
| `invalid_split` / `invalid_expense_splits` | 23514    | Revisa cómo se divide el gasto.                             |
| `user_not_active_member`                   | 23514    | Esa persona ya no pertenece al hogar.                       |
| `invalid_category`                         | 23514    | Elige una categoría válida.                                 |
| `record_voided`                            | P0001    | Este movimiento fue anulado y ya no se puede modificar.     |
| `household_immutable`                      | 42501    | No se puede mover un movimiento a otro hogar.               |
| `not_found`                                | P0002    | No encontramos ese movimiento.                              |
| `person_color_taken`                       | 23505    | Ese color ya lo usa alguien del hogar. Elige otro.          |
| `too_many_categories`                      | 23514    | Un gasto puede tener máximo 6 categorías.                   |
| `invalid_budget`                           | 23514    | Ese presupuesto ya no está disponible.                      |
| (RLS / permisos)                           | 42501    | No pudimos guardar el cambio. Inténtalo nuevamente.         |

## Decisiones respecto a la spec (Regla 2)

| Spec                                              | Implementación                                                                                                                                                             | Motivo                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| §11 fórmula de saldo                              | Signo de transferencias corregido                                                                                                                                          | La fórmula original invierte el efecto de los pagos                          |
| §30 `expense_splits.percentage`                   | `share_bp integer` (puntos básicos)                                                                                                                                        | Precisión exacta sin decimales; §12 permite "precisión controlada"           |
| §30 `incomes`/`transfers` sin estado ni auditoría | Añadidos `status`, `voided_*`, `created_by`, `updated_by`                                                                                                                  | Lo exige §22                                                                 |
| §30 `recurring_expenses.split_type`               | + tabla `recurring_expense_splits`                                                                                                                                         | Guardar porcentajes personalizados de la plantilla                           |
| §13 categorías base                               | Copiadas a cada household al crearlo                                                                                                                                       | Políticas RLS más simples (sin `household_id NULL`)                          |
| §5 abandonar household                            | `left_at` en lugar de borrar                                                                                                                                               | El historial sigue apuntando a esa persona                                   |
| —                                                 | `expenses.recurring_expense_id` + índice único por fecha                                                                                                                   | Impide generar dos veces el mismo gasto recurrente (FASE 9)                  |
| §6 ingresos                                       | Pueden ser compartidos (`income_splits`) y cualquier miembro registra los de cualquiera (migración 05)                                                                     | Pedido del usuario (2026-10-12). Siguen sin generar deuda: solo reportes     |
| §4.1 registro y recuperación de contraseña        | Registro solo con código de invitación (`/registro` + hook `hook_before_user_created`) y recuperación por email (`/recuperar` → `/restablecer`), ambos desde el 2026-10-12 | Sin código no se crea ninguna cuenta: nadie ajeno al hogar puede registrarse |
