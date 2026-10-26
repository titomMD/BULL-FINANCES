import { Outlet } from 'react-router'
import { usePocketsEnabled } from '../../hooks/usePockets'
import { NotFound } from '../../app/RouteScreens'
import { LedgerSkeleton } from '../../components/ui/States'

/** Bolsillos y «Mamá me debe» solo existen para las cuentas que lo tienen activado. */
export function PocketsGate() {
  const { enabled, loading } = usePocketsEnabled()
  if (loading) return <LedgerSkeleton days={1} />
  return enabled ? <Outlet /> : <NotFound />
}
