import type { ReactNode } from 'react'

// Piezas comunes de las gráficas de Reportes. Colores solo desde tokens (var(--color-*)), así se
// ven bien en cualquier tema y modo. Nunca solo color: leyenda con nombres, tooltip con texto y
// vista de tabla.

export type LegendMark = 'bar' | 'line' | 'dashed'

export interface LegendItem {
  label: string
  /** Color CSS (var(--color-*)). */
  color: string
  mark?: LegendMark
}

/** Leyenda con el nombre de cada serie junto a su marca (barra, línea o línea punteada). */
export function ChartLegend({ items, label }: { items: LegendItem[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted"
    >
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.mark === 'line' || item.mark === 'dashed' ? (
            <span
              aria-hidden="true"
              className="h-0 w-4 border-t-2"
              style={{
                borderColor: item.color,
                borderStyle: item.mark === 'dashed' ? 'dashed' : 'solid',
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm"
              style={{ background: item.color }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export interface TooltipRow {
  label: string
  value: string
  color?: string
  strong?: boolean
}

/** Caja del tooltip: título y filas con montos completos. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="max-w-64 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm shadow-[0_8px_24px_-8px_var(--shadow-tint)]">
      <p className="font-semibold first-letter:uppercase">{title}</p>
      <dl className="mt-1 flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="inline-flex items-center gap-1.5 text-fg-muted">
              {row.color && (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-sm"
                  style={{ background: row.color }}
                />
              )}
              {row.label}
            </dt>
            <dd className={`tabular ${row.strong ? 'font-semibold' : ''}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Contenedor de la gráfica: alto fijo y descripción en texto para lectores de pantalla. */
export function ChartBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={label}>
      {children}
    </div>
  )
}

export interface TableColumn<Row> {
  header: string
  cell: (row: Row) => ReactNode
  align?: 'left' | 'right'
}

/** Vista de tabla de una gráfica (misma información, sin depender de ver colores). */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string
  columns: TableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-fg-muted">
            {columns.map((column, index) => (
              <th
                key={column.header}
                scope="col"
                className={`py-2 font-medium whitespace-nowrap ${index > 0 ? 'pl-3' : ''} ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th
                    key={column.header}
                    scope="row"
                    className="py-2 text-left font-medium whitespace-nowrap first-letter:uppercase"
                  >
                    {column.cell(row)}
                  </th>
                ) : (
                  <td
                    key={column.header}
                    className={`py-2 pl-3 tabular whitespace-nowrap ${column.align === 'left' ? 'text-left' : 'text-right'}`}
                  >
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
