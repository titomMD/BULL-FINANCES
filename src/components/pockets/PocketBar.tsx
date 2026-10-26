/** Barra de avance de un bolsillo. El porcentaje siempre va escrito (el color no es el único aviso). */
export function PocketBar({ progressBp, label }: { progressBp: number; label: string }) {
  const percent = Math.round(progressBp / 100)
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right tabular text-xs font-semibold text-fg-muted">
        {percent} %
      </span>
    </div>
  )
}
