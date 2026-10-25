import { useEffect, useMemo, useRef } from 'react'
import { useHousehold } from '../app/household-context'
import { monthProgress } from '../lib/calculations/planMonth'
import { monthOf } from '../lib/calculations/plan'
import { todayBogota } from '../lib/dates'
import { syncPlanIncome } from '../services/personal'
import { useDebtPayments, useDebtStatements } from './useDebts'
import { useDollar } from './useDollar'
import { invalidateData } from './useResource'
import { usePersonalMoney } from './usePersonalMoney'
import { usePlan, usePlanChecks, usePlanEntries } from './usePlan'

/**
 * Mantiene al día el ingreso «Dinero mío (plan del mes)» en tu dinero personal: cada vez que se
 * abre el plan o el dinero personal, el ingreso del mes actual queda igual a lo que el plan deja
 * libre (después de descontar lo que te pasaste de tanqueadas o pagos de tarjeta).
 */
export function usePlanSync() {
  const { household } = useHousehold()
  const plan = usePlan()
  const checks = usePlanChecks()
  const entries = usePlanEntries()
  const statements = useDebtStatements()
  const payments = useDebtPayments()
  const { rate } = useDollar()
  const personal = usePersonalMoney()
  const lastKey = useRef('')

  const month = monthOf(todayBogota())
  const ready = Boolean(
    plan.data && checks.data && entries.data && statements.data && payments.data && personal.data,
  )

  const target = useMemo(() => {
    if (!ready) return null
    const progress = monthProgress(
      plan.data!,
      checks.data!,
      entries.data!,
      statements.data!,
      month,
      payments.data!,
      rate?.cents ?? null,
    )
    const existing = personal.data!.find(
      (movement) => movement.planMonth === month && movement.status === 'active',
    )
    return {
      amount: plan.data!.length === 0 ? 0 : progress.money,
      existing: existing ? { id: existing.id, amount: existing.amount } : undefined,
    }
  }, [
    ready,
    plan.data,
    checks.data,
    entries.data,
    statements.data,
    payments.data,
    rate?.cents,
    personal.data,
    month,
  ])

  useEffect(() => {
    if (!target) return
    const key = `${month}:${target.amount}:${target.existing?.id ?? '-'}:${target.existing?.amount ?? 0}`
    if (lastKey.current === key) return
    lastKey.current = key
    syncPlanIncome(household.id, month, target.amount, target.existing, todayBogota())
      .then((changed) => {
        if (changed) invalidateData()
      })
      .catch(() => {
        // Sin conexión o similar: se reintenta la próxima vez que se abra la pantalla.
        lastKey.current = ''
      })
  }, [target, household.id, month])
}
