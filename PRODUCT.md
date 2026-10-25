# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos hermanos que viven juntos en Colombia y comparten los gastos del hogar: arriendo, servicios,
mercado y suscripciones. Cada uno paga cosas distintas durante el mes, a veces al 50/50 y a veces
en otra proporción, y de vez en cuando se transfieren dinero para saldar. Usan la app tanto en el
celular (registrar un gasto justo al pagar) como en el computador (revisar historial y reportes).

## Product Purpose

BULLMILTON es una libreta financiera compartida: registra gastos, ingresos y transferencias, y
responde al instante el saldo disponible de cada uno: a cada persona se le suma su parte de los
ingresos y se le resta su parte de los gastos, sin deudas entre ellos. El éxito es que ninguno de los dos tenga que hacer cuentas a mano: abrir la
app, ver cuánto le queda, registrar en pocos toques.

## Positioning

No es una app bancaria ni de contabilidad: es una herramienta privada para un hogar de dos
personas. Las preguntas que debe contestar de inmediato son: ¿cuánto me queda este mes?, ¿cuánto le
queda a mi hermano?, ¿cuánto gastamos y en qué?, ¿a alguien se le acabó el saldo?

## Operating Context

- Registro rápido al momento de pagar, desde el celular, a menudo con una mano.
- Revisión más calmada en el computador: historial con filtros, reportes por periodo y categoría.
- Gastos recurrentes del hogar (arriendo, internet, servicios, streaming) que se confirman cada mes.
- Moneda: pesos colombianos (COP), sin decimales. Zona horaria: America/Bogota.
- Dos cuentas; solo se registra quien tiene un código de invitación del hogar.

## Capabilities and Constraints

- Funciones: login, household compartido con invitación por código, gastos con división 50/50 o
  porcentual, ingresos individuales o compartidos (no generan deuda), transferencias entre los dos, motor de
  saldo, dashboard, historial con filtros, gastos recurrentes, reportes y exportación CSV/JSON.
- Los movimientos no se borran: se anulan.
- Especificación completa: `SHAREDFIN_ESPECIFICACION_COMPLETA_CLAUDE_COLORES.md` (el documento usa
  el nombre provisional "SharedFin").
- Stack: React + Vite + TypeScript + Tailwind v4 + Supabase (Postgres/RLS/Auth) + Vercel.
- Idioma: solo español en el MVP, estructurado para añadir inglés después.

## Brand Commitments

- Nombre: **BULLMILTON**.
- Paleta obligatoria de la spec §40.1 (fondo oscuro, amarillo como acción, verde como positivo,
  rojo con moderación), implementada como tokens en `src/styles/tokens.css`.
- Voz: cercana, en tuteo, frases cortas y directas ("Tu saldo disponible $85.000", "Tu saldo −$15.000").

## Evidence on Hand

- No hay logo, ilustraciones, fotografía ni testimonios. No inventarlos.
- Datos de ejemplo de desarrollo en `supabase/seed.sql` (Ana y Beto).

## Product Principles

1. El saldo disponible de cada uno es la respuesta principal (decisión del usuario, 2026-10-12):
   su parte de los ingresos − su parte de los gastos ± transferencias, acumulado entre meses. Quién
   pagó no importa y no hay deudas; solo si a alguien se le acaba el saldo, está usando el del otro.
2. Registrar un movimiento debe tomar segundos; las acciones + Gasto / + Ingreso / + Transferencia
   siempre a mano.
3. Claridad antes que densidad: números grandes y legibles, nada de tablas enormes en móvil.
4. Confianza en los números: cifras exactas, sin redondeos sorpresa, cada movimiento muestra
   quién lo pagó y cómo se dividió.
5. Pequeña y privada: sin funciones que no sirvan a este hogar de dos personas.

## Accessibility & Inclusion

- Contraste WCAG AA como mínimo sobre los fondos oscuros.
- El color nunca es el único indicador de estado (texto, signo o icono además del color).
- Objetivos táctiles grandes (≥ 44 px) y uso con una mano en móvil.
