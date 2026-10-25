---
version: 1
slug: "src-pages-dashboard"
primary_target: "src/pages/Dashboard"
related_targets: ["src/components"]
---

# Inicio (dashboard) y shell de la app

Modo: Operate. Usuarios: dos hermanos que viven juntos; celular para registrar, computador para revisar.
Tarea: saber al instante el saldo disponible de cada uno y registrar un movimiento en segundos.
Restricciones: paleta y tema oscuro fijados por la spec §40.1 (tokens en src/styles/tokens.css); voz cercana en tuteo; el color nunca es el único indicador.

## Direction contract

THESIS: Inicio responde primero el saldo disponible de cada uno (su parte de los ingresos menos su parte de los gastos ± transferencias, acumulado; sin deudas; decisión del usuario 2026-10-12), y debajo el libro diario: movimientos agrupados por día, cada día cerrado con tu saldo y cada fila con lo que restó o sumó a cada uno. Rechaza el dashboard de tarjetas sueltas (saldo + widgets + lista genérica).

OWN-WORLD: Fondo Deep Navy; filas de libro sobre Dark Slate con reglas finas; cifras tabulares alineadas a la derecha en una columna de saldo; amarillo para acciones, el día de hoy y datos que requieren atención (barras de magnitud, como el boceto de la spec §40.1; nunca como fondo decorativo); verde/rojo con signo (+ / −) y texto para el efecto en el saldo.

STORY: Abro la app, leo "Tu saldo disponible $2.450.570" y el de mi hermano, veo si a alguno se le acabó, recorro los últimos movimientos con mi parte de cada uno, y registro uno nuevo con un toque.

FIRST VIEWPORT: Arriba, el saldo a escala grande (frase + cifra) que al hacer scroll se compacta en una barra fija; debajo, encabezados de día (fecha a la izquierda, "saldo X" a la derecha) con sus movimientos (descripción, quién/división, efecto con signo); acciones + Gasto / + Ingreso / + Transferencia fijas en la zona del pulgar sobre la barra de navegación inferior. En escritorio: libro a la izquierda, pendientes y resumen del mes a la derecha. En móvil los pendientes van sobre el libro (prioridad de pulgar) y el resumen después.

FORM: "Libro diario", candidata 3 de 7 de mi lista; seed key ad03ba28.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
