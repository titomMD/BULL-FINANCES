import type { ComponentType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  BookOpenIcon,
  ChartPieIcon,
  GearSixIcon,
  ListBulletsIcon,
  WalletIcon,
  type IconProps,
} from '@phosphor-icons/react'
import { QuickActions } from '../components/QuickActions'
import { useHousehold } from './household-context'
import { Brand } from '../components/Brand'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<IconProps>
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: BookOpenIcon, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: ListBulletsIcon },
  { to: '/presupuestos', label: 'Presupuestos', icon: WalletIcon },
  { to: '/reportes', label: 'Reportes', icon: ChartPieIcon },
  { to: '/ajustes', label: 'Ajustes', icon: GearSixIcon },
]

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150 ${
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className="size-5" weight={isActive ? 'fill' : 'regular'} />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors duration-150 ${
          isActive ? 'text-fg' : 'text-fg-muted hover:text-fg'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            aria-hidden="true"
            className={`size-6 ${isActive ? 'text-primary' : ''}`}
            weight={isActive ? 'fill' : 'regular'}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

/** Estructura de la app: barra lateral en escritorio; acciones + pestañas abajo en móvil. */
export function AppShell() {
  const { household, me } = useHousehold()
  const { pathname } = useLocation()
  // En móvil, la barra inferior solo vive en las pestañas principales; formularios y detalles
  // tienen su botón de volver y su botón de guardar en la zona del pulgar.
  const onTab = navItems.some((item) => item.to === pathname)
  const showMobileActions = onTab

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] print:block">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-4 py-6 lg:flex print:hidden">
        <div className="px-2">
          <Brand />
          <p className="mt-1 truncate text-sm text-fg-muted">{household.name}</p>
        </div>
        <QuickActions layout="stack" />
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <p className="mt-auto truncate px-2 text-sm text-fg-muted">{me.displayName}</p>
      </aside>

      <main
        id="contenido"
        className={`min-w-0 ${showMobileActions ? 'pb-[calc(9rem+env(safe-area-inset-bottom))]' : ''} lg:pb-0`}
      >
        <Outlet />
      </main>

      <div
        hidden={!onTab}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden print:hidden"
      >
        {showMobileActions && (
          <div className="px-3 pt-2.5">
            <QuickActions layout="row" />
          </div>
        )}
        <nav aria-label="Principal" className="flex px-1">
          {navItems.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
        </nav>
      </div>
    </div>
  )
}
