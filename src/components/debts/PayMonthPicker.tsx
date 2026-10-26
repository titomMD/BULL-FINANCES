import { useState } from 'react'
import { invalidateData } from '../../hooks/useResource'
import { formatMonthName } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { updateStatementPayMonth } from '../../services/debts'
import { TextInput } from '../ui/Field'
import { useToast } from '../ui/toast-context'

/** Con el presupuesto de qué mes se paga este extracto (cambia dónde cuenta en tu plan). */
export function PayMonthPicker({
  statementId,
  payMonth,
}: {
  statementId: string
  payMonth: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-fg-muted">Se paga con el presupuesto de</span>
      <TextInput
        type="month"
        value={payMonth}
        disabled={busy}
        aria-label={`Mes del presupuesto (ahora ${formatMonthName(`${payMonth}-01`)})`}
        className="!h-11 w-auto min-w-40"
        onChange={async (event) => {
          const next = event.target.value
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next) || next === payMonth) return
          setBusy(true)
          try {
            await updateStatementPayMonth(statementId, next)
            invalidateData()
            toast.show('Listo: el extracto cuenta en ese mes')
          } catch (error) {
            toast.show(toUserMessage(error, 'No pudimos cambiar el mes.'), 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}
