import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useHousehold } from '../../app/household-context'
import { useDebtAccounts, useDebtStatements } from '../../hooks/useDebts'
import { invalidateData } from '../../hooks/useResource'
import { defaultPayMonth } from '../../lib/calculations/planMonth'
import { todayBogota } from '../../lib/dates'
import { toUserMessage } from '../../lib/errors'
import { formatMoneyInput, parseMoneyInput } from '../../lib/money'
import { formatUsd, parseUsdInput } from '../../lib/usd'
import { PdfPasswordError, readPdfLines } from '../../lib/pdfLines'
import { parseBancolombiaStatement } from '../../lib/statementPdf'
import { parseStatementPaste, type ImportedStatement } from '../../lib/statementImport'
import {
  createStatement,
  deleteStatement,
  removeFile,
  updateStatement,
  uploadFile,
} from '../../services/debts'
import { setPaidAmount } from '../../services/plan'
import type { DebtAccount, DebtStatement, StatementLine } from '../../types/domain'
import { FilePicker } from '../../components/debts/FilePicker'
import { FormFooter } from '../../components/forms/FormParts'
import { MoneyInput } from '../../components/forms/MoneyInput'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { Page, PageHeader } from '../../components/ui/PageHeader'
import { EmptyState, LedgerSkeleton } from '../../components/ui/States'
import { useToast } from '../../components/ui/toast-context'

const money = (value: number | null) => (value === null ? '' : formatMoneyInput(String(value)))
const linesToText = (lines: StatementLine[]) =>
  lines
    .map(
      (l) =>
        `${l.date} ; ${l.detail} ; ${l.amount < 0 ? '-' : ''}${formatMoneyInput(String(Math.abs(l.amount)))}`,
    )
    .join('\n')

function StatementForm({
  account,
  statement,
}: {
  account: DebtAccount
  statement?: DebtStatement
}) {
  const accountId = account.id
  const { household, userId } = useHousehold()
  const navigate = useNavigate()
  const toast = useToast()
  const back = `/tarjetas/${accountId}`
  const today = todayBogota()

  const [statementDate, setStatementDate] = useState(statement?.statementDate ?? today)
  const [dueDate, setDueDate] = useState(statement?.dueDate ?? '')
  const [payMonth, setPayMonth] = useState(statement?.payMonth ?? today.slice(0, 7))
  const [payMonthTouched, setPayMonthTouched] = useState(Boolean(statement))
  const [totalDue, setTotalDue] = useState(money(statement?.totalDue ?? null))
  const [minimumDue, setMinimumDue] = useState(money(statement?.minimumDue ?? null))
  const [previousBalance, setPreviousBalance] = useState(money(statement?.previousBalance ?? null))
  const [purchases, setPurchases] = useState(money(statement?.purchases ?? null))
  const [interest, setInterest] = useState(money(statement?.interest ?? null))
  const usdText = (cents: number | null) => (cents ? formatUsd(cents).replace('US$ ', '') : '')
  const [usdTotal, setUsdTotal] = useState(usdText(statement?.usdTotalDue ?? null))
  const [usdMinimum, setUsdMinimum] = useState(usdText(statement?.usdMinimumDue ?? null))
  const [feeAmount, setFeeAmount] = useState(money(statement?.feeAmount ?? null))
  const [ratePercent, setRatePercent] = useState(
    statement?.monthlyRatePpm ? String(statement.monthlyRatePpm / 10000).replace('.', ',') : '',
  )
  const [notes, setNotes] = useState(statement?.notes ?? '')
  const [linesText, setLinesText] = useState(statement ? linesToText(statement.lines) : '')
  const [pasted, setPasted] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const syncPayMonth = (statementDay: string, dueDay: string) => {
    if (!payMonthTouched && /^\d{4}-\d{2}-\d{2}$/.test(statementDay))
      setPayMonth(defaultPayMonth(statementDay, /^\d{4}-\d{2}-\d{2}$/.test(dueDay) ? dueDay : null))
  }

  const [pdf, setPdf] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')
  const [askPassword, setAskPassword] = useState<'no' | 'needed' | 'wrong'>('no')
  const [reading, setReading] = useState(false)

  const readPdf = async (target: File, password?: string) => {
    setReading(true)
    try {
      const lines = await readPdfLines(target, password)
      const parsed = parseBancolombiaStatement(lines)
      setAskPassword('no')
      if (!parsed) {
        toast.show(
          'No pudimos leer este PDF. Adjúntalo, llena a mano o pega los datos más abajo.',
          'error',
        )
        setFile(target)
        return
      }
      if (parsed.last4 && account.last4 && parsed.last4 !== account.last4)
        toast.show(
          `Ojo: este extracto es de la tarjeta terminada en ${parsed.last4}, no de ${account.last4}.`,
          'error',
        )
      applyImported(parsed)
      setFile(target)
      setPdfPassword('')
      toast.show('Leímos tu extracto: revisa los datos y guarda')
    } catch (error) {
      if (error instanceof PdfPasswordError) {
        setAskPassword(error.wrong ? 'wrong' : 'needed')
      } else {
        toast.show('No pudimos abrir ese PDF. ¿Está dañado?', 'error')
      }
    } finally {
      setReading(false)
    }
  }

  const applyPaste = () => {
    const parsed = parseStatementPaste(pasted)
    if (!parsed) return toast.show('No entendimos ese texto. Revisa el formato.', 'error')
    applyImported(parsed)
    setPasted('')
    toast.show('Datos copiados al formulario: revisa y guarda')
  }

  const applyImported = (parsed: ImportedStatement) => {
    const nextStatement = parsed.statementDate ?? statementDate
    const nextDue = parsed.dueDate ?? dueDate
    if (parsed.statementDate) setStatementDate(parsed.statementDate)
    if (parsed.dueDate) setDueDate(parsed.dueDate)
    if (parsed.payMonth) {
      setPayMonth(parsed.payMonth)
      setPayMonthTouched(true)
    } else syncPayMonth(nextStatement, nextDue)
    if (parsed.totalDue !== undefined) setTotalDue(money(parsed.totalDue))
    if (parsed.minimumDue !== undefined) setMinimumDue(money(parsed.minimumDue))
    if (parsed.previousBalance !== undefined) setPreviousBalance(money(parsed.previousBalance))
    if (parsed.purchases !== undefined) setPurchases(money(parsed.purchases))
    if (parsed.interest !== undefined) setInterest(money(parsed.interest))
    if (parsed.usdTotalDue !== undefined) setUsdTotal(usdText(parsed.usdTotalDue))
    if (parsed.usdMinimumDue !== undefined) setUsdMinimum(usdText(parsed.usdMinimumDue))
    if (parsed.feeAmount !== undefined) setFeeAmount(money(parsed.feeAmount))
    if (parsed.monthlyRatePpm !== undefined)
      setRatePercent(String(parsed.monthlyRatePpm / 10000).replace('.', ','))
    if (parsed.notes) setNotes(parsed.notes)
    if (parsed.lines) setLinesText(linesToText(parsed.lines))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const total = parseMoneyInput(totalDue)
    if (total === null) return toast.show('Escribe el total a pagar del extracto.', 'error')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDate))
      return toast.show('Pon la fecha de corte.', 'error')
    const optional = (raw: string) => (raw.trim() === '' ? null : parseMoneyInput(raw))
    setSaving(true)
    try {
      let filePath = statement?.filePath ?? null
      let fileName = statement?.fileName ?? null
      if (file) {
        const previous = filePath
        filePath = await uploadFile(userId, file)
        fileName = file.name.slice(0, 200)
        if (previous) await removeFile(previous).catch(() => {})
      }
      const rate = Number(ratePercent.replace(',', '.'))
      const fee = optional(feeAmount)
      const input = {
        statementDate,
        dueDate: dueDate || null,
        payMonth,
        totalDue: total,
        minimumDue: optional(minimumDue) ?? 0,
        previousBalance: optional(previousBalance),
        interest: optional(interest),
        purchases: optional(purchases),
        usdTotalDue: usdTotal.trim() ? (parseUsdInput(usdTotal) ?? 0) : 0,
        usdMinimumDue: usdMinimum.trim() ? (parseUsdInput(usdMinimum) ?? 0) : 0,
        feeAmount: fee,
        monthlyRatePpm: rate > 0 && rate < 10 ? Math.round(rate * 10000) : null,
        notes,
        lines: parseStatementPaste(linesText)?.lines ?? [],
        filePath,
        fileName,
      }
      if (statement) await updateStatement(statement.id, input)
      else await createStatement(household.id, accountId, input)
      // La cuota de manejo se descuenta de la línea del plan (Membresías) y queda pagada ese mes,
      // aunque el valor del extracto no coincida con el del plan.
      if (account.feePlanItemId && fee && fee > 0)
        await setPaidAmount(household.id, account.feePlanItemId, payMonth, fee)
      invalidateData()
      toast.show(statement ? 'Cambios guardados' : 'Extracto guardado')
      navigate(back, { replace: true })
    } catch (error) {
      toast.show(toUserMessage(error, 'No pudimos guardarlo. Inténtalo de nuevo.'), 'error')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3">
        <h2 className="font-semibold">Subir el PDF del extracto</h2>
        <p className="text-sm text-fg-muted">
          La app lee el PDF aquí mismo, en tu navegador, y llena los datos. El archivo no se envía a
          nadie hasta que guardes.
        </p>
        <FilePicker
          label="PDF del extracto"
          file={pdf}
          onChange={(picked) => {
            setPdf(picked)
            setAskPassword('no')
            setPdfPassword('')
            if (picked) void readPdf(picked)
          }}
          onError={(message) => toast.show(message, 'error')}
        />
        {reading && <p className="text-sm text-fg-muted">Leyendo el extracto…</p>}
        {askPassword !== 'no' && pdf && (
          <div className="flex flex-col gap-2">
            <Field
              label="Clave del PDF"
              hint="Los extractos del banco suelen venir con clave (por ejemplo, tu cédula)."
              error={
                askPassword === 'wrong' ? 'Esa clave no abrió el PDF. Prueba otra vez.' : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type="password"
                  autoComplete="off"
                  value={pdfPassword}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(e) => setPdfPassword(e.target.value)}
                />
              )}
            </Field>
            <Button
              className="self-start"
              loading={reading}
              onClick={() => void readPdf(pdf, pdfPassword)}
            >
              Abrir PDF
            </Button>
          </div>
        )}
      </section>

      <details className="rounded-2xl bg-surface px-4 py-3">
        <summary className="min-h-11 cursor-pointer font-semibold">
          O pegar los datos a mano (opcional)
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-fg-muted">
            Pídele a Claude que lea tu PDF o foto y te devuelva los datos en formato JSON, pégalos
            aquí y se llena todo. También puedes pegar solo los movimientos, uno por línea:{' '}
            <span className="font-mono">02/10/2026 ; Rappi ; 35.000</span>.
          </p>
          <TextArea
            aria-label="Texto del extracto"
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <Button variant="secondary" className="self-start" onClick={applyPaste}>
            Llenar el formulario
          </Button>
        </div>
      </details>

      <fieldset disabled={saving} className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de corte">
            {({ id }) => (
              <TextInput
                id={id}
                type="date"
                value={statementDate}
                onChange={(e) => {
                  setStatementDate(e.target.value)
                  syncPayMonth(e.target.value, dueDate)
                }}
              />
            )}
          </Field>
          <Field label="Fecha límite de pago (opcional)">
            {({ id }) => (
              <TextInput
                id={id}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  syncPayMonth(statementDate, e.target.value)
                }}
              />
            )}
          </Field>
        </div>
        <Field
          label="Mes del plan en que lo pagas"
          hint="Ese mes se resta de lo que apartas para tarjetas y deudas."
        >
          {({ id }) => (
            <TextInput
              id={id}
              type="month"
              value={payMonth}
              onChange={(e) => {
                setPayMonth(e.target.value)
                setPayMonthTouched(true)
              }}
            />
          )}
        </Field>
        <Field label="Total a pagar">
          {({ id }) => <MoneyInput id={id} size="lg" value={totalDue} onChange={setTotalDue} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pago mínimo (opcional)">
            {({ id }) => <MoneyInput id={id} value={minimumDue} onChange={setMinimumDue} />}
          </Field>
          <Field
            label="Cuota de manejo (opcional)"
            hint={
              account.feePlanItemId
                ? 'Se descuenta de tu plan y queda marcada como pagada ese mes.'
                : 'Enlaza la línea de tu plan en «Editar tarjeta» para descontarla.'
            }
          >
            {({ id }) => <MoneyInput id={id} value={feeAmount} onChange={setFeeAmount} />}
          </Field>
          <Field label="Tasa mensual % (opcional)" hint="Para calcular intereses día a día.">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="2,1593"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )}
          </Field>
          <Field label="Total en dólares (opcional)" hint="Lo que se paga aparte, en dólares.">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="65,00"
                value={usdTotal}
                onChange={(e) => setUsdTotal(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )}
          </Field>
          <Field label="Mínimo en dólares (opcional)">
            {({ id }) => (
              <TextInput
                id={id}
                inputMode="decimal"
                placeholder="3,00"
                value={usdMinimum}
                onChange={(e) => setUsdMinimum(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )}
          </Field>
          <Field label="Saldo anterior (opcional)">
            {({ id }) => (
              <MoneyInput id={id} value={previousBalance} onChange={setPreviousBalance} />
            )}
          </Field>
          <Field label="Compras del periodo (opcional)">
            {({ id }) => <MoneyInput id={id} value={purchases} onChange={setPurchases} />}
          </Field>
          <Field label="Intereses (opcional)">
            {({ id }) => <MoneyInput id={id} value={interest} onChange={setInterest} />}
          </Field>
        </div>
        <Field
          label="Movimientos (opcional)"
          hint="Uno por línea: fecha ; detalle ; valor. Son solo para consultar."
        >
          {({ id }) => (
            <TextArea
              id={id}
              rows={6}
              className="font-mono text-sm"
              value={linesText}
              onChange={(e) => setLinesText(e.target.value)}
            />
          )}
        </Field>
        <FilePicker
          label="PDF o foto del extracto (opcional)"
          file={file}
          existingName={statement?.fileName}
          onChange={setFile}
          onError={(message) => toast.show(message, 'error')}
        />
        <Field label="Notas (opcional)">
          {({ id }) => (
            <TextArea
              id={id}
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
      </fieldset>

      <FormFooter>
        <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
          {saving ? 'Guardando' : statement ? 'Guardar cambios' : 'Guardar extracto'}
        </Button>
      </FormFooter>

      {statement && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>
            Borrar extracto
          </Button>
          <ConfirmDialog
            open={confirming}
            title="¿Borrar este extracto?"
            confirmLabel="Borrar"
            loading={deleting}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              setDeleting(true)
              try {
                await deleteStatement(statement.id)
                if (statement.filePath) await removeFile(statement.filePath).catch(() => {})
                invalidateData()
                toast.show('Extracto borrado')
                navigate(back, { replace: true })
              } catch (error) {
                toast.show(toUserMessage(error), 'error')
                setDeleting(false)
                setConfirming(false)
              }
            }}
          >
            Se borran sus datos y el archivo adjunto. No se puede deshacer.
          </ConfirmDialog>
        </section>
      )}
    </form>
  )
}

/** Nuevo extracto (`/tarjetas/:id/extractos/nuevo`) o edición (`.../extractos/:statementId`). */
export function StatementFormPage() {
  const { id, statementId } = useParams()
  const accounts = useDebtAccounts()
  const statements = useDebtStatements()
  const account = accounts.data?.find((entry) => entry.id === id)
  const statement = statementId
    ? statements.data?.find((entry) => entry.id === statementId)
    : undefined
  const loading = accounts.loading || (statementId ? statements.loading : false)
  return (
    <Page>
      <PageHeader
        title={statementId ? 'Editar extracto' : 'Nuevo extracto'}
        description={account?.name}
        back={`/tarjetas/${id ?? ''}`}
      />
      {loading ? (
        <LedgerSkeleton days={1} />
      ) : !account || (statementId && !statement) ? (
        <EmptyState title="No encontramos eso">Puede que el enlace esté mal.</EmptyState>
      ) : (
        <StatementForm key={statement?.id ?? 'new'} account={account} statement={statement} />
      )}
    </Page>
  )
}
