import { useMemo, useState } from 'react'
import { useHousehold } from '../../app/household-context'
import { invalidateData } from '../../hooks/useResource'
import { parseBitacora } from '../../lib/bitacora'
import { toUserMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { importReceivableEntries } from '../../services/pockets'
import type { ReceivableEntry } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { useToast } from '../../components/ui/toast-context'

/** Pega tu bitácora y conviértela en cobros y pagos de la libreta, comprobando que los Total cuadren. */
export function BitacoraImport({ current }: { current: ReceivableEntry[] }) {
  const { household } = useHousehold()
  const toast = useToast()
  const [text, setText] = useState('')
  const [start, setStart] = useState('2025-09-01')
  const [reconcile, setReconcile] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const result = useMemo(
    () => (text.trim() ? parseBitacora(text, start, reconcile) : null),
    [text, start, reconcile],
  )

  const run = async () => {
    if (!result) return
    setBusy(true)
    try {
      await importReceivableEntries(
        household.id,
        result.entries,
        current.map((entry) => entry.id),
      )
      invalidateData()
      setText('')
      setConfirming(false)
      toast.show(`Se importaron ${result.entries.length} movimientos`)
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos importar la bitácora.'), 'error')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="rounded-2xl bg-surface px-4 py-3 sm:px-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Importar mi bitácora</summary>
      <div className="mt-2 flex flex-col gap-3">
        <p className="text-sm text-fg-muted">
          Pega el texto tal como lo llevas («Almuerzos 5 de octubre: 120.000», «Mamá me paga
          -2.000.000», «Total: …»). Las líneas «Total» no se suman: sirven para comprobar que todo
          cuadre. Si pegaste la bitácora dos veces, se usa la última copia.
        </p>
        <Field label="¿Cuándo empieza la bitácora?" hint="Con esto se deduce el año de cada fecha.">
          {({ id }) => (
            <TextInput
              id={id}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          )}
        </Field>
        <Field label="Bitácora">
          {({ id }) => (
            <TextArea id={id} rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          )}
        </Field>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={reconcile}
            onChange={(e) => setReconcile(e.target.checked)}
            className="mt-1 size-5 accent-(--color-primary)"
          />
          <span className="text-sm">
            Si un «Total» no coincide con la suma de sus líneas, agregar un ajuste por la diferencia
            para terminar en el mismo número que tu bitácora.
          </span>
        </label>
        {result && (
          <div data-money className="flex flex-col gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <p>
              Se leyeron <strong>{result.entries.length}</strong> movimientos. La libreta quedaría
              en <strong className="tabular">{formatMoney(result.balance)}</strong>
              {result.writtenTotal !== null && (
                <>
                  {' '}
                  (tu último Total dice{' '}
                  <strong className="tabular">{formatMoney(result.writtenTotal)}</strong>
                  {result.balance === result.writtenTotal ? ': coincide' : ': no coincide'})
                </>
              )}
              .
            </p>
            {result.opening !== 0 && (
              <p>
                Antes de la primera línea ya se debían{' '}
                <span className="tabular">{formatMoney(result.opening)}</span> (se deduce del primer
                Total).
              </p>
            )}
            {result.mismatches.length > 0 && (
              <ul className="list-disc pl-5">
                {result.mismatches.map((item) => (
                  <li key={item.line}>
                    Línea {item.line}: la bitácora dice Total{' '}
                    <span className="tabular">{formatMoney(item.written)}</span> y las líneas suman{' '}
                    <span className="tabular">{formatMoney(item.computed)}</span> (diferencia{' '}
                    <span className="tabular">
                      {formatMoney(Math.abs(item.written - item.computed))}
                    </span>
                    ).
                  </li>
                ))}
              </ul>
            )}
            {result.skipped.length > 0 && (
              <p>
                No se pudieron leer {result.skipped.length} líneas, por ejemplo: «
                {result.skipped[0].text}».
              </p>
            )}
          </div>
        )}
        <Button
          disabled={!result || result.entries.length === 0}
          loading={busy}
          className="self-start"
          onClick={() => (current.length > 0 ? setConfirming(true) : void run())}
        >
          Importar
        </Button>
        <ConfirmDialog
          open={confirming}
          title="¿Reemplazar la libreta actual?"
          confirmLabel="Reemplazar"
          loading={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={run}
        >
          Ya tienes {current.length} movimientos en la libreta. Se reemplazan por los de la bitácora
          (primero se guarda lo nuevo y después se borra lo anterior).
        </ConfirmDialog>
      </div>
    </details>
  )
}
