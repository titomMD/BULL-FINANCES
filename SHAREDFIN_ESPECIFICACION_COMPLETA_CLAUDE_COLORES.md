# SharedFin --- Especificación Completa del Proyecto

> Documento maestro para desarrollar SharedFin con Claude / Claude Code.
>
> Este documento define el objetivo, alcance, arquitectura, modelo de
> datos, reglas de negocio, seguridad, UX, fases de desarrollo y
> criterios de aceptación del proyecto.
>
> **Principio:** construir primero una aplicación pequeña, segura y
> realmente utilizable; después añadir funciones avanzadas.

------------------------------------------------------------------------

# 1. Descripción general

## 1.1 ¿Qué es SharedFin?

**SharedFin** es una aplicación web de gestión financiera compartida
pensada inicialmente para dos personas que comparten gastos e ingresos.

El problema que busca resolver es sencillo:

Dos personas pagan diferentes gastos durante el mes. Algunos gastos son
compartidos al 50/50 y otros pueden dividirse en proporciones
diferentes. Además, pueden existir ingresos individuales y
transferencias entre las personas para saldar deudas.

La aplicación debe responder automáticamente:

-   cuánto ha gastado cada persona;
-   cuánto ha pagado cada persona;
-   cuánto debería asumir cada persona;
-   quién le debe dinero a quién;
-   cuánto falta por liquidar;
-   cuánto se ha gastado durante un periodo;
-   en qué categorías se concentra el gasto;
-   cuánto aporta cada persona;
-   qué gastos recurrentes están pendientes.

La aplicación debe sentirse como una **libreta financiera compartida
inteligente**, no como un software contable empresarial.

------------------------------------------------------------------------

# 2. Objetivo principal

Crear una aplicación web que permita a dos personas gestionar sus
finanzas compartidas de manera rápida desde el celular.

El flujo principal debe ser:

``` text
Abrir aplicación
      ↓
Ver saldo actual
      ↓
Registrar gasto / ingreso / transferencia
      ↓
Aplicar división
      ↓
Actualizar saldo automáticamente
      ↓
Consultar historial / estadísticas
```

La operación más frecuente debe poder realizarse en pocos pasos.

------------------------------------------------------------------------

# 3. Usuarios

La primera versión está optimizada para dos personas.

Ejemplo:

``` text
Household: "Casa"
    ├── Usuario A
    └── Usuario B
```

Sin embargo, la base de datos debe utilizar el concepto de
**household/grupo** para no limitar estructuralmente el sistema a
exactamente dos usuarios.

Esto permitirá posteriormente soportar:

-   parejas;
-   hermanos;
-   compañeros de apartamento;
-   grupos pequeños;
-   más de dos participantes.

La interfaz del MVP puede mantenerse enfocada en dos personas.

------------------------------------------------------------------------

# 4. Funcionalidades

## 4.1 Autenticación

Cada usuario debe tener su propia cuenta.

Funciones:

-   registro;
-   login;
-   logout;
-   recuperación de contraseña;
-   persistencia de sesión;
-   protección de rutas;
-   identificación del usuario actual.

La aplicación debe utilizar un proveedor de autenticación existente en
lugar de implementar contraseñas manualmente.

------------------------------------------------------------------------

# 5. Households

Un household representa el espacio financiero compartido.

Ejemplo:

``` text
"Casa Camilo"
```

Un usuario puede pertenecer a un household.

El MVP debe permitir:

1.  Crear un household.
2.  Invitar al segundo usuario.
3.  Aceptar una invitación.
4.  Ver quién pertenece al household.
5.  Abandonar el household si posteriormente se necesita.

La invitación puede implementarse inicialmente mediante un código o
enlace de invitación.

No crear un sistema complejo de roles para el MVP.

------------------------------------------------------------------------

# 6. Ingresos

Cada usuario puede registrar ingresos individuales.

Ejemplos:

``` text
Mesada
Trabajo
Freelance
Beca
Otro
```

Campos:

-   descripción/fuente;
-   monto;
-   fecha;
-   usuario;
-   categoría opcional;
-   nota opcional.

Los ingresos pertenecen al usuario que los recibe.

Los ingresos **no generan automáticamente una deuda entre los
participantes**.

Sirven principalmente para reportes y análisis financiero.

------------------------------------------------------------------------

# 7. Gastos

Un gasto representa dinero utilizado para una compra o pago.

Campos:

-   descripción;
-   monto;
-   fecha;
-   categoría;
-   usuario que pagó;
-   household;
-   división;
-   nota opcional;
-   timestamps.

Ejemplo:

``` text
Arriendo
$1.000.000
Pagó: A
División: 50/50
```

------------------------------------------------------------------------

# 8. División de gastos

La división es una de las funciones centrales del proyecto.

## 8.1 División igualitaria

``` text
A = 50%
B = 50%
```

Ejemplo:

``` text
Gasto = $100.000

A = $50.000
B = $50.000
```

------------------------------------------------------------------------

## 8.2 División personalizada

El usuario puede especificar porcentajes.

Ejemplo:

``` text
A = 70%
B = 30%
```

Para:

``` text
$100.000
```

la aplicación calcula:

``` text
A = $70.000
B = $30.000
```

La suma debe ser exactamente:

``` text
100%
```

------------------------------------------------------------------------

## 8.3 División por cantidad

Como mejora futura, considerar una división basada directamente en
cantidades:

``` text
A = $40.000
B = $60.000
```

Para el MVP puede omitirse si la división porcentual cubre el caso de
uso.

------------------------------------------------------------------------

# 9. Cálculo de deuda

Esta es la lógica financiera más importante.

Para cada gasto:

``` text
monto pagado
+
quién pagó
+
cuánto corresponde a cada participante
```

determina el balance.

Ejemplo:

``` text
Gasto: $1.000.000
Pagó: A
División: 50/50
```

Resultado:

``` text
A pagó       $1.000.000
A debía        $500.000
B debía        $500.000

B debe $500.000 a A
```

Después:

``` text
Transferencia B → A = $300.000
```

Resultado:

``` text
B debe $200.000 a A
```

------------------------------------------------------------------------

# 10. Motor de balance

La lógica financiera debe estar aislada de React.

Crear un módulo independiente similar a:

``` text
calculateBalance()
```

Entrada conceptual:

``` text
expenses
expense_splits
transfers
```

Salida:

``` text
{
    debtor,
    creditor,
    amount
}
```

El cálculo debe ser determinista y tener tests unitarios.

Nunca duplicar esta lógica dentro de múltiples componentes.

------------------------------------------------------------------------

# 11. Regla financiera recomendada

Para cada usuario:

``` text
balance = total_pagado - total_que_debía
```

Después se incorporan las transferencias.

Una forma conceptual de calcular el saldo global es:

``` text
saldo_de_A =
    gastos_pagados_por_A
    - gastos_que_corresponden_a_A
    + transferencias_recibidas_por_A
    - transferencias_enviadas_por_A
```

Y de forma equivalente para B.

Interpretación:

``` text
saldo > 0
→ esa persona debe recibir dinero

saldo < 0
→ esa persona debe dinero
```

La implementación final debe utilizar una única convención matemática
documentada.

------------------------------------------------------------------------

# 12. Dinero y precisión

**Nunca utilizar `float` para representar dinero.**

Para COP utilizar enteros en la unidad mínima:

``` text
100000 COP → 100000
```

Para otras monedas se puede almacenar la unidad mínima correspondiente.

La base de datos debe utilizar:

``` text
integer / bigint
```

para los valores monetarios cuando sea adecuado.

Los porcentajes pueden almacenarse con precisión decimal controlada.

También almacenar:

``` text
currency
```

aunque el MVP inicialmente utilice:

``` text
COP
```

Esto evita diseñar todo el sistema alrededor de una única moneda.

------------------------------------------------------------------------

# 13. Categorías

Categorías iniciales:

-   Comida
-   Vivienda
-   Servicios
-   Transporte
-   Entretenimiento
-   Salud
-   Educación
-   Suscripciones
-   Compras
-   Otros

Las categorías deben pertenecer al household o existir como categorías
base.

Posteriormente los usuarios podrán crear categorías personalizadas.

------------------------------------------------------------------------

# 14. Gastos periódicos

Permitir crear plantillas para gastos recurrentes.

Ejemplos:

``` text
Arriendo
Internet
Electricidad
Agua
Gas
Netflix
Spotify
```

Una plantilla contiene:

-   nombre;
-   monto estimado;
-   frecuencia;
-   próxima fecha;
-   categoría;
-   división predeterminada;
-   usuario que normalmente paga;
-   estado activo/inactivo.

Frecuencias iniciales:

-   mensual;
-   trimestral.

------------------------------------------------------------------------

# 15. Generación de gastos recurrentes

El MVP no necesita un servidor ejecutándose permanentemente.

Al abrir la aplicación:

``` text
Consultar plantillas activas
        ↓
Comprobar next_due_date
        ↓
¿Hay gastos vencidos?
        ↓
Sí
        ↓
Mostrar pendientes
        ↓
Usuario confirma
        ↓
Crear gastos
        ↓
Actualizar próxima fecha
```

Esto es suficiente para la primera versión.

Más adelante se puede utilizar una función programada para automatizar
completamente el proceso.

------------------------------------------------------------------------

# 16. Transferencias

Registrar dinero enviado entre participantes.

Campos:

-   usuario origen;
-   usuario destino;
-   monto;
-   fecha;
-   nota opcional.

Ejemplo:

``` text
B → A
$300.000
```

Las transferencias afectan el saldo, pero **no deben considerarse como
nuevos gastos**.

------------------------------------------------------------------------

# 17. Dashboard

El dashboard es la pantalla principal.

Debe mostrar:

## Saldo principal

Ejemplo:

``` text
B debe a A

$200.000
```

Si está equilibrado:

``` text
Todo saldado
$0
```

------------------------------------------------------------------------

## Resumen del periodo

Mostrar:

``` text
Ingresos
Gastos
Transferencias
```

por usuario.

------------------------------------------------------------------------

## Últimos movimientos

Mostrar los últimos gastos, ingresos y transferencias.

------------------------------------------------------------------------

## Acciones rápidas

Botones grandes:

``` text
+ Gasto
+ Ingreso
+ Transferencia
```

Estas acciones deben ser especialmente cómodas en móvil.

------------------------------------------------------------------------

# 18. Historial

Vista cronológica de movimientos.

Cada movimiento debe mostrar:

-   icono/tipo;
-   descripción;
-   monto;
-   fecha;
-   usuario;
-   categoría;
-   información de división cuando corresponda.

Filtros:

-   fecha;
-   tipo;
-   categoría;
-   usuario.

------------------------------------------------------------------------

# 19. Reportes

Permitir seleccionar:

``` text
Esta semana
Este mes
Mes anterior
Últimos 3 meses
Rango personalizado
```

Mostrar:

### Gastos totales

``` text
A: $X
B: $Y
Total: $Z
```

### Ingresos

``` text
A: $X
B: $Y
```

### Categorías

Ejemplo:

``` text
Comida       35%
Vivienda     30%
Transporte   15%
Otros        20%
```

### Evolución

Gráfico mensual de gastos.

------------------------------------------------------------------------

# 20. Contribución

Mostrar cuánto dinero ha pagado cada persona en gastos compartidos.

Ejemplo:

``` text
A aportó:  $1.500.000
B aportó:    $900.000
```

Esto no debe confundirse con cuánto le corresponde pagar a cada uno.

------------------------------------------------------------------------

# 21. Exportación y respaldo

Debe existir una opción para exportar información.

Formatos:

-   CSV;
-   JSON.

Exportar como mínimo:

-   gastos;
-   ingresos;
-   transferencias;
-   categorías;
-   gastos recurrentes.

Esto sirve como respaldo independiente de la plataforma.

------------------------------------------------------------------------

# 22. Auditoría y eliminación

No borrar inmediatamente movimientos financieros importantes cuando sea
posible.

Para gastos e ingresos puede ser preferible:

``` text
active / voided
```

o un mecanismo de soft-delete.

Debe existir información básica de:

-   quién creó el registro;
-   cuándo se creó;
-   cuándo se modificó;
-   quién lo modificó.

Esto ayuda a evitar inconsistencias y facilita depuración.

------------------------------------------------------------------------

# 23. Stack tecnológico recomendado

## Decisión arquitectónica

La propuesta original utilizaba:

``` text
GitHub Pages
+
Neon
+
Neon Data API
+
JWT
+
PostgreSQL RLS
```

Es viable, pero para este proyecto existe una alternativa más sencilla.

### Stack recomendado para SharedFin

``` text
React
+
Vite
+
TypeScript
+
Tailwind CSS
+
Supabase
+
Vercel
```

------------------------------------------------------------------------

# 24. ¿Por qué cambiar Neon por Supabase?

Supabase sigue utilizando PostgreSQL y permite utilizar RLS, pero
integra directamente:

-   PostgreSQL;
-   autenticación;
-   Data API;
-   SDK para frontend;
-   almacenamiento;
-   herramientas de desarrollo;
-   migraciones;
-   testing de RLS.

Esto reduce considerablemente la cantidad de piezas que debemos conectar
manualmente.

Supabase Auth utiliza JWT y está integrado con PostgreSQL/RLS, por lo
que no necesitamos construir nuestro propio sistema de autenticación ni
configurar un proveedor adicional solamente para emitir JWT.

La documentación oficial de Supabase recomienda precisamente combinar
Supabase Auth con RLS para proteger los datos desde el navegador.
citeturn0search0turn0search2

La propuesta original de Neon también es técnicamente válida: Neon Data
API permite consultar PostgreSQL por HTTPS utilizando JWT + RLS.
citeturn0search3

**Para SharedFin, sin embargo, Supabase reduce complejidad.**

------------------------------------------------------------------------

# 25. ¿Por qué Vercel en lugar de GitHub Pages?

GitHub Pages funciona perfectamente para un frontend estático, pero
Vercel simplifica:

-   despliegue;
-   previews;
-   variables de entorno;
-   routing;
-   integración Git;
-   futuras funciones serverless.

La aplicación sigue siendo esencialmente un frontend React, pero no
tenemos que trabajar alrededor de las limitaciones de GitHub Pages.

Si el objetivo fuera únicamente mantener una página estática
extremadamente simple, GitHub Pages seguiría siendo válido.

Para una aplicación interactiva, Vercel es la opción recomendada.

------------------------------------------------------------------------

# 26. Arquitectura final

``` text
                    ┌─────────────────────┐
                    │      Usuario        │
                    │  móvil / escritorio │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     React + Vite    │
                    │     TypeScript      │
                    └──────────┬──────────┘
                               │
                        Supabase SDK
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
        ┌───────────────┐             ┌───────────────┐
        │ Supabase Auth │             │ Supabase API  │
        │ JWT / Session │             │ REST / RPC    │
        └───────────────┘             └───────┬───────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ PostgreSQL       │
                                    │ RLS + Functions  │
                                    └──────────────────┘
```

Deploy:

``` text
GitHub
   ↓
Vercel
   ↓
React application
```

------------------------------------------------------------------------

# 27. Seguridad

La seguridad es un requisito P0.

## Nunca

-   colocar service keys en el frontend;
-   colocar passwords de PostgreSQL en el frontend;
-   confiar solamente en validaciones de React;
-   desactivar RLS para "hacerlo funcionar";
-   permitir acceso a datos de otro household;
-   utilizar claves privilegiadas desde el navegador.

Las claves secretas de Supabase que permiten saltarse RLS deben
permanecer únicamente del lado servidor. La documentación oficial indica
explícitamente que las claves con privilegios administrativos no deben
exponerse en el navegador. citeturn0search0

------------------------------------------------------------------------

# 28. RLS

Todas las tablas expuestas al cliente deben tener políticas adecuadas.

La regla conceptual será:

``` text
Usuario autenticado
       ↓
auth.uid()
       ↓
household_members
       ↓
household_id permitido
       ↓
acceso a registros de ese household
```

Ejemplo conceptual:

``` text
Usuario A pertenece a Household 1

Usuario A:
✓ puede leer Household 1
✓ puede crear gastos en Household 1
✓ puede modificar sus registros permitidos
✗ no puede leer Household 2
✗ no puede modificar Household 2
```

No asumir que ocultar elementos de la UI constituye seguridad.

------------------------------------------------------------------------

# 29. Pruebas de seguridad

Crear tests para comprobar:

-   usuario no autenticado → acceso denegado;
-   usuario A → puede acceder a household A;
-   usuario B → puede acceder al mismo household compartido;
-   usuario externo → no puede acceder;
-   usuario A → no puede reasignar registros a otro household;
-   usuario A → no puede modificar registros de un household ajeno;
-   service key → nunca aparece en código frontend.

Las políticas deben probarse explícitamente.

Supabase dispone de mecanismos de testing de RLS mediante pgTAP/Supabase
CLI, por lo que estos tests deben formar parte del proyecto y no ser
solamente pruebas manuales. citeturn0search0

------------------------------------------------------------------------

# 30. Base de datos

## users / profiles

Supabase Auth administra las cuentas.

Crear una tabla `profiles` para información de aplicación:

``` text
id
display_name
created_at
updated_at
```

------------------------------------------------------------------------

## households

``` text
id
name
created_by
created_at
updated_at
```

------------------------------------------------------------------------

## household_members

``` text
id
household_id
user_id
joined_at
role
```

Roles mínimos:

``` text
owner
member
```

La existencia del rol no implica construir un sistema complejo de
permisos en el MVP.

------------------------------------------------------------------------

## invitations

``` text
id
household_id
created_by
code/token
expires_at
used_at
created_at
```

Permite incorporar al segundo usuario sin editar directamente la base de
datos.

------------------------------------------------------------------------

## categories

``` text
id
household_id
name
icon
created_at
```

------------------------------------------------------------------------

## expenses

``` text
id
household_id
description
amount
currency
date
category_id
paid_by
notes
status
created_by
created_at
updated_at
```

------------------------------------------------------------------------

## expense_splits

``` text
id
expense_id
user_id
percentage
amount
```

Restricciones:

``` text
sum(percentage) = 100
```

La aplicación debe validar esto y la base de datos debe impedir estados
inconsistentes cuando sea posible.

------------------------------------------------------------------------

## incomes

``` text
id
household_id
user_id
source
amount
currency
date
notes
created_at
updated_at
```

------------------------------------------------------------------------

## transfers

``` text
id
household_id
from_user
to_user
amount
currency
date
notes
created_at
```

------------------------------------------------------------------------

## recurring_expenses

``` text
id
household_id
name
amount
currency
frequency
next_due_date
category_id
paid_by
split_type
active
created_by
created_at
updated_at
```

------------------------------------------------------------------------

# 31. Integridad de datos

La base de datos debe encargarse de tantas reglas como sea razonable.

Ejemplos:

``` text
amount > 0
percentage >= 0
percentage <= 100
from_user != to_user
expense pertenece al household
split pertenece al mismo expense
usuario pertenece al household
```

No confiar exclusivamente en TypeScript para estas restricciones.

------------------------------------------------------------------------

# 32. Operaciones atómicas

Cuando una operación implique varios cambios relacionados, evitar dejar
datos parcialmente actualizados.

Ejemplo:

Crear gasto:

``` text
expense
+
expense_splits
```

Idealmente ambas operaciones deben realizarse de forma atómica mediante
una función/RPC o mecanismo equivalente.

No queremos:

``` text
expense creado
splits fallaron
```

porque produciría datos financieros inconsistentes.

------------------------------------------------------------------------

# 33. Estructura del frontend

``` text
src/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── expenses/
│   ├── dashboard/
│   └── charts/
│
├── pages/
│   ├── Login/
│   ├── Dashboard/
│   ├── Expenses/
│   ├── Incomes/
│   ├── Transfers/
│   ├── Recurring/
│   ├── Reports/
│   └── Settings/
│
├── hooks/
│
├── lib/
│   ├── supabase/
│   ├── calculations/
│   └── validation/
│
├── services/
│
├── types/
│
├── utils/
│
├── routes/
│
└── App.tsx
```

La estructura puede modificarse si Claude encuentra una alternativa más
limpia.

------------------------------------------------------------------------

# 34. Librerías

Mantener el número de dependencias bajo.

Stack inicial recomendado:

``` text
react
typescript
vite
react-router
tailwindcss
@supabase/supabase-js
recharts
zod
react-hook-form
```

Agregar una librería únicamente cuando resuelva un problema real.

------------------------------------------------------------------------

# 35. Validación de formularios

Usar:

``` text
React Hook Form
+
Zod
```

para validar formularios.

Ejemplos:

``` text
monto > 0
fecha válida
categoría válida
porcentajes = 100
transferencia origen != destino
```

La validación del frontend mejora UX, pero la base de datos/RLS sigue
siendo la autoridad de seguridad.

------------------------------------------------------------------------

# 36. UX móvil

La aplicación debe diseñarse **mobile-first**.

Operaciones frecuentes:

``` text
+ Gasto
+ Ingreso
+ Transferencia
```

deben estar disponibles fácilmente.

Evitar:

-   tablas enormes;
-   formularios con demasiados campos;
-   navegación profunda;
-   botones pequeños;
-   gráficos ilegibles en móvil.

------------------------------------------------------------------------

# 37. PWA

Considerar PWA después de tener el MVP funcional.

Objetivo:

``` text
Agregar SharedFin a la pantalla de inicio
```

Esto puede mejorar la experiencia móvil sin crear una aplicación nativa.

No convertir PWA en requisito de la primera fase.

------------------------------------------------------------------------

# 38. Offline

No implementar sincronización offline completa inicialmente.

Como mejora futura:

``` text
crear gasto sin conexión
        ↓
guardar localmente
        ↓
sincronizar cuando vuelva internet
```

Es un problema de complejidad considerable y no es necesario para
validar el producto.

------------------------------------------------------------------------

# 39. Notificaciones

Futuro:

-   gasto recurrente pendiente;
-   saldo pendiente;
-   invitación a household.

No implementar push notifications en el MVP.

------------------------------------------------------------------------

# 40. Diseño visual

El diseño debe ser:

- limpio;
- moderno;
- simple;
- orientado a datos;
- cómodo en móvil;
- con jerarquía visual clara.

No buscar replicar una aplicación bancaria compleja.

El usuario debe poder entender inmediatamente:

``` text
¿Cuánto debo?
¿Cuánto me deben?
¿Cuánto gastamos?
¿En qué gastamos?
```

## 40.1 Paleta de colores

SharedFin utilizará una identidad visual basada en **fondos oscuros, amarillo como color de acción y verde como indicador financiero positivo**. La combinación debe sentirse moderna, limpia y tecnológica, evitando que el amarillo o el verde dominen toda la interfaz.

### Paleta principal

| Uso | Nombre | HEX | Aplicación |
|---|---|---|---|
| Fondo principal | Deep Navy | `#0B0F14` | Fondo general de la aplicación |
| Superficie | Dark Slate | `#151B22` | Cards, paneles y navegación |
| Superficie secundaria | Slate | `#202832` | Inputs, elementos secundarios y hover |
| Texto principal | Soft White | `#F3F4F6` | Títulos y contenido principal |
| Texto secundario | Muted Gray | `#9CA3AF` | Descripciones y metadatos |
| Primario | Finance Yellow | `#F4C542` | Botones principales, acciones y elementos destacados |
| Amarillo suave | Soft Yellow | `#FFE58A` | Hover, badges y fondos destacados sutiles |
| Positivo | Finance Green | `#35C978` | Saldos positivos, ingresos y estados favorables |
| Verde oscuro | Deep Green | `#123D2A` | Fondo de badges/alertas positivas |
| Negativo | Expense Red | `#F05252` | Errores, gastos relevantes o saldos negativos |

### Resultado visual esperado

La interfaz debe aproximarse a esta combinación: 

``` text
┌──────────────────────────────────────────────┐
│  SHARED       Fondo: #0B0F14                │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Balance compartido                    │  │
│  │  $350.000                              │  │
│  │  + $120.000 a tu favor     #35C978    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Gastos este mes                       │  │
│  │  $1.240.000                            │  │
│  │  ████████████████░░░░   #F4C542       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│       [ + Registrar gasto ]                 │
│             #F4C542                         │
│                                              │
│  Comida          $240.000    #F4C542       │
│  Servicios       $180.000    #35C978       │
│  Transporte      $120.000    #9CA3AF       │
└──────────────────────────────────────────────┘
```

### Reglas de uso de color

- **Amarillo (`#F4C542`)** = acción principal, botones, elementos interactivos y datos que requieran atención.
- **Verde (`#35C978`)** = ingresos, dinero a favor, estados completados y resultados positivos.
- **Rojo (`#F05252`)** = errores o situaciones financieras negativas; utilizarlo con moderación.
- **Fondos oscuros** = deben ocupar la mayor parte de la interfaz para reducir fatiga visual y dar protagonismo a los datos.
- No utilizar amarillo y verde simultáneamente como colores dominantes en un mismo componente.
- Mantener suficiente contraste entre texto y fondo.
- El color no debe ser el único indicador de estado; acompañarlo con texto, iconos o etiquetas cuando sea necesario.

### Ejemplo de jerarquía

``` text
FONDO                #0B0F14
  ↓
CARD                 #151B22
  ↓
TEXTO PRINCIPAL      #F3F4F6
  ↓
ACCIÓN PRINCIPAL     #F4C542
  ↓
RESULTADO POSITIVO   #35C978
  ↓
ERROR/NEGATIVO       #F05252
```

La paleta debe implementarse como **tokens/variables de diseño** para que pueda modificarse desde un único lugar. No colocar los valores HEX directamente por toda la aplicación.

# 41. Manejo de errores

Nunca mostrar errores técnicos directamente al usuario.

En lugar de:

``` text
PostgREST 42501
```

mostrar:

``` text
No pudimos guardar el gasto.
Comprueba tu conexión e inténtalo nuevamente.
```

Los detalles técnicos deben quedar en logs/development tools.

------------------------------------------------------------------------

# 42. Estados de carga

Cada operación debe manejar:

``` text
loading
success
error
empty
```

Ejemplo:

``` text
Guardando...
Gasto guardado ✓
```

Evitar botones que permitan enviar dos veces la misma operación.

------------------------------------------------------------------------

# 43. Fechas y zona horaria

El proyecto estará inicialmente orientado a Colombia.

Utilizar explícitamente:

``` text
America/Bogota
```

para la interpretación de fechas cuando corresponda.

No depender ciegamente de la zona horaria del navegador.

Las fechas financieras deben representar el día financiero correcto
aunque el usuario abra la aplicación desde otro huso horario.

------------------------------------------------------------------------

# 44. Internacionalización

El MVP puede estar únicamente en español.

Sin embargo:

-   no hardcodear textos dentro de lógica compleja;
-   estructurar el frontend de manera que añadir inglés posteriormente
    sea posible.

------------------------------------------------------------------------

# 45. Rendimiento

El proyecto es pequeño, así que no hay que sobreoptimizar.

Prioridades:

1.  consultas correctas;
2.  índices;
3.  RLS eficiente;
4.  no descargar datos innecesarios;
5.  paginar historial si crece.

Índices importantes probablemente incluirán:

``` text
household_id
date
user_id
category_id
```

------------------------------------------------------------------------

# 46. Backup

Además del export manual:

-   mantener migraciones SQL en Git;
-   mantener seed de desarrollo;
-   documentar cómo restaurar el proyecto;
-   exportar datos periódicamente si el sistema se utiliza realmente.

La aplicación no debe depender únicamente de una copia manual dentro del
navegador.

------------------------------------------------------------------------

# 47. Desarrollo local

El objetivo es poder ejecutar:

``` bash
npm install
npm run dev
```

y tener la aplicación funcionando.

Si se utiliza Supabase CLI, documentar claramente:

``` bash
supabase start
supabase db reset
supabase test db
```

cuando corresponda.

------------------------------------------------------------------------

# 48. Git

Utilizar commits pequeños.

Ejemplos:

``` text
feat: initialize sharedfin project
feat: configure supabase authentication
feat: create household schema
feat: implement household invitation
feat: add expense creation
feat: implement expense splitting
feat: add balance engine
test: add balance calculation cases
test: add household rls tests
fix: prevent duplicate transfers
ui: improve mobile dashboard
```

------------------------------------------------------------------------

# 49. Fases de desarrollo

## FASE 0 --- Preparación

Crear:

-   repositorio;
-   React;
-   Vite;
-   TypeScript;
-   Tailwind;
-   ESLint;
-   Prettier;
-   estructura inicial.

### Criterio

La aplicación arranca localmente.

------------------------------------------------------------------------

# 50. FASE 1 --- Supabase

Configurar:

-   proyecto;
-   PostgreSQL;
-   Auth;
-   tablas;
-   relaciones;
-   índices;
-   RLS;
-   migraciones.

### Criterio

La base de datos existe y las políticas de seguridad están probadas.

------------------------------------------------------------------------

# 51. FASE 2 --- Autenticación

Implementar:

-   registro;
-   login;
-   logout;
-   recuperación de contraseña;
-   protección de rutas;
-   sesión persistente.

### Criterio

Dos usuarios pueden autenticarse.

------------------------------------------------------------------------

# 52. FASE 3 --- Household

Implementar:

-   crear household;
-   invitar;
-   aceptar invitación;
-   mostrar miembros;
-   protección RLS.

### Criterio

Dos usuarios pueden pertenecer al mismo espacio financiero y ningún
usuario externo puede acceder.

------------------------------------------------------------------------

# 53. FASE 4 --- Gastos

Implementar:

-   categorías;
-   creación;
-   edición;
-   cancelación;
-   división 50/50;
-   división personalizada;
-   quién pagó.

### Criterio

Un gasto puede registrarse completamente y sus splits son correctos.

------------------------------------------------------------------------

# 54. FASE 5 --- Ingresos

Implementar:

-   formulario;
-   historial;
-   edición;
-   cancelación;
-   estadísticas.

------------------------------------------------------------------------

# 55. FASE 6 --- Transferencias

Implementar:

-   transferencia A → B;
-   transferencia B → A;
-   historial;
-   validaciones.

------------------------------------------------------------------------

# 56. FASE 7 --- Motor de balance

Crear y probar:

``` text
calculateBalance()
```

Casos mínimos:

### Caso 1

``` text
A paga 100
50/50
→ B debe 50
```

### Caso 2

``` text
A paga 100
50/50
B paga 50
→ B debe 0
```

### Caso 3

``` text
A paga 100
70/30
→ B debe 30
```

### Caso 4

``` text
A paga 100
50/50
B transfiere 25
→ B debe 25
```

### Caso 5

``` text
A paga 100
B paga 100
50/50
→ saldo 0
```

------------------------------------------------------------------------

# 57. FASE 8 --- Dashboard

Implementar:

-   saldo;
-   resumen;
-   últimos movimientos;
-   acciones rápidas;
-   contribución.

------------------------------------------------------------------------

# 58. FASE 9 --- Gastos recurrentes

Implementar:

-   plantillas;
-   frecuencia;
-   próxima fecha;
-   confirmación de generación;
-   actualización de fechas.

------------------------------------------------------------------------

# 59. FASE 10 --- Reportes

Implementar:

-   filtros;
-   estadísticas;
-   categorías;
-   contribución;
-   evolución mensual.

------------------------------------------------------------------------

# 60. FASE 11 --- Exportación

Implementar:

-   CSV;
-   JSON;
-   descarga desde la aplicación.

------------------------------------------------------------------------

# 61. FASE 12 --- UX y responsive

Probar:

-   móvil;
-   tablet;
-   escritorio.

Prioridad:

``` text
móvil > tablet > escritorio
```

------------------------------------------------------------------------

# 62. FASE 13 --- Deploy

Deploy recomendado:

``` text
GitHub → Vercel
```

Configurar:

-   production;
-   preview deployments;
-   variables de entorno;
-   dominio si posteriormente se desea;
-   redirects de SPA.

------------------------------------------------------------------------

# 63. FASE 14 --- Hardening

Antes de considerar el MVP terminado:

-   revisar RLS;
-   revisar grants;
-   revisar secrets;
-   revisar validaciones;
-   revisar duplicados;
-   revisar errores;
-   revisar permisos;
-   probar usuario externo;
-   probar expiración de sesión;
-   probar exportación;
-   probar recuperación de contraseña.

------------------------------------------------------------------------

# 64. P0 --- imprescindible

-   autenticación;
-   household;
-   RLS;
-   gastos;
-   splits;
-   ingresos;
-   transferencias;
-   balance;
-   historial;
-   dashboard;
-   responsive;
-   deploy.

------------------------------------------------------------------------

# 65. P1 --- importante

-   gastos recurrentes;
-   reportes;
-   gráficos;
-   filtros;
-   exportación;
-   categorías personalizadas;
-   invitaciones mejoradas;
-   auditoría.

------------------------------------------------------------------------

# 66. P2 --- futuro

-   PWA;
-   offline;
-   notificaciones;
-   múltiples monedas;
-   más de dos usuarios;
-   presupuestos;
-   recibos;
-   OCR;
-   importación bancaria;
-   integraciones;
-   aplicación móvil nativa;
-   IA para análisis financiero.

------------------------------------------------------------------------

# 67. Lo que NO se debe construir inicialmente

No implementar:

-   integración bancaria;
-   pagos reales;
-   IA;
-   OCR;
-   aplicación nativa;
-   sistema empresarial;
-   contabilidad formal;
-   sincronización offline compleja;
-   microservicios;
-   backend separado si Supabase cubre el requisito;
-   arquitectura excesivamente compleja.

El proyecto debe permanecer pequeño.

------------------------------------------------------------------------

# 68. Criterios de aceptación del MVP

El MVP se considera terminado cuando:

1.  Dos usuarios pueden crear cuentas.
2.  Pueden entrar al mismo household.
3.  Un usuario no puede acceder a otro household.
4.  Se pueden registrar gastos.
5.  Se puede indicar quién pagó.
6.  Se puede dividir 50/50.
7.  Se puede dividir por porcentaje.
8.  Se pueden registrar ingresos.
9.  Se pueden registrar transferencias.
10. El saldo se calcula automáticamente.
11. Las transferencias modifican el saldo.
12. El historial funciona.
13. El dashboard funciona.
14. Los reportes básicos funcionan.
15. Los gastos recurrentes funcionan.
16. Se puede exportar información.
17. La aplicación funciona correctamente en móvil.
18. La aplicación está desplegada.
19. Las políticas RLS tienen tests.
20. No existen secretos administrativos en el frontend.

------------------------------------------------------------------------

# 69. Regla fundamental de arquitectura

No construir:

``` text
frontend gigante
+
backend gigante
+
microservicios
+
API propia
+
sistema de auth propio
```

para una aplicación que inicialmente será utilizada por dos personas.

La arquitectura debe ser:

``` text
React
+
Supabase
+
PostgreSQL/RLS
+
Vercel
```

y solamente introducir un backend propio cuando exista una necesidad
real.

------------------------------------------------------------------------

# 70. Reglas para Claude

Claude debe tratar este archivo como la especificación principal.

## Regla 1 --- incremental

No implementar cinco fases simultáneamente.

Trabajar una fase a la vez.

------------------------------------------------------------------------

## Regla 2 --- verificar antes de cambiar arquitectura

Si una decisión parece problemática:

1.  identificar el problema;
2.  explicar la alternativa;
3.  elegir la solución más sencilla;
4.  documentar el cambio.

------------------------------------------------------------------------

## Regla 3 --- seguridad primero

Si RLS está mal:

``` text
NO continuar construyendo funcionalidades.
```

Primero solucionar la seguridad.

------------------------------------------------------------------------

## Regla 4 --- no sobreingeniería

Si una solución sencilla funciona:

``` text
usar la solución sencilla.
```

------------------------------------------------------------------------

## Regla 5 --- lógica financiera separada

No colocar cálculos financieros directamente dentro de JSX.

------------------------------------------------------------------------

## Regla 6 --- database-first para reglas críticas

Las restricciones importantes deben estar también en PostgreSQL.

------------------------------------------------------------------------

## Regla 7 --- tests para dinero

Toda modificación al motor financiero debe incluir o actualizar tests.

------------------------------------------------------------------------

## Regla 8 --- cambios explicables

Para cada tarea indicar:

``` text
Qué se hará
Qué archivos se modifican
Por qué
Cómo probarlo
Resultado esperado
```

------------------------------------------------------------------------

# 71. Prompt inicial para Claude

Utilizar este documento como especificación principal.

> Quiero desarrollar SharedFin siguiendo esta especificación.
>
> SharedFin es una aplicación web de finanzas compartidas inicialmente
> diseñada para dos personas.
>
> El stack recomendado es:
>
> -   React
> -   Vite
> -   TypeScript
> -   Tailwind CSS
> -   Supabase
> -   PostgreSQL
> -   Supabase Auth
> -   RLS
> -   Vercel
>
> Antes de escribir código:
>
> 1.  analiza toda la arquitectura;
> 2.  identifica problemas técnicos reales;
> 3.  identifica posibles simplificaciones;
> 4.  no añadas tecnologías innecesarias;
> 5.  confirma que la estrategia de seguridad es correcta.
>
> Después comienza exclusivamente por FASE 0.
>
> No implementes todavía autenticación, gastos ni dashboard.
>
> Cuando FASE 0 esté terminada, explícame cómo probarla y espera a que
> sea validada antes de continuar.
>
> Para cada fase:
>
> -   trabaja incrementalmente;
> -   muestra los archivos modificados;
> -   explica brevemente las decisiones importantes;
> -   proporciona comandos para probar;
> -   crea tests cuando corresponda;
> -   no continúes automáticamente a fases posteriores.
>
> La seguridad de PostgreSQL/RLS es prioritaria.
>
> Nunca pongas claves administrativas o secrets en el frontend.
>
> No implementes un backend propio salvo que exista una necesidad
> concreta que Supabase no pueda resolver adecuadamente.
>
> Si una decisión de esta especificación entra en conflicto con la
> documentación actual de las tecnologías utilizadas, señala el
> conflicto y propón la solución actual más sencilla.

------------------------------------------------------------------------

# 72. Resultado esperado

Al terminar el proyecto tendremos:

``` text
                 SHARED FIN
                     │
          ┌──────────┴──────────┐
          │                     │
       Usuario A            Usuario B
          │                     │
          └──────────┬──────────┘
                     │
                 Household
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Gastos       Ingresos    Transferencias
       │
     Splits
       │
       ▼
  Balance Engine
       │
       ▼
 ¿Quién debe a quién?
       │
       ├── Dashboard
       ├── Historial
       ├── Reportes
       └── Exportación
```

La aplicación debe terminar siendo pequeña, rápida, segura y fácil de
mantener.

------------------------------------------------------------------------

# 73. Filosofía final

SharedFin no pretende competir inicialmente con aplicaciones financieras
comerciales.

Su objetivo es resolver muy bien un problema específico:

> **"Dos personas comparten gastos. Quiero registrar lo que ocurre y
> saber automáticamente quién debe cuánto."**

Todo lo demás debe estar subordinado a ese objetivo.

La arquitectura debe permitir crecer, pero el MVP debe permanecer
sencillo.

**Primero: seguridad y datos.**

**Segundo: lógica financiera correcta.**

**Tercero: experiencia móvil.**

**Cuarto: reportes y automatización.**

**Después: funcionalidades avanzadas.**
