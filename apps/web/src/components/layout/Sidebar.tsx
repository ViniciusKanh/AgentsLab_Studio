import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { NAV_MAIN, type NavItem } from './navigation'
import { cx } from '../ui/primitives'
import { useWorldStore } from '@/stores/worldStore'

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      end={item.end}
      title={collapsed ? item.label + (item.planned ? ' (planejado)' : '') : undefined}
      className={({ isActive }) =>
        cx(
          'group flex items-center gap-3 rounded-[6px] px-2.5 py-2 text-[12.5px] font-bold transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-neon-green text-[#04120c] shadow-[0_0_12px_-3px_#00f5a0]' : 'text-lab-text/85 hover:bg-white/5 hover:text-white',
        )
      }
    >
      <Icon size={18} strokeWidth={2.1} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.planned && <span className="ml-auto text-[8px] font-extrabold tracking-wider text-neon-purple opacity-80">PLAN</span>}
    </NavLink>
  )
}

/** Sidebar recolhível (desktop) e gaveta lateral (celular). */
export function Sidebar() {
  const collapsed = useWorldStore((s) => s.sidebarCollapsed)
  const setCollapsed = useWorldStore((s) => s.setSidebarCollapsed)
  const mobileNav = useWorldStore((s) => s.mobileNav)
  const setMobileNav = useWorldStore((s) => s.setMobileNav)
  return (
    <>
      <nav aria-label="Navegação principal" data-testid="sidebar" className={cx('hidden shrink-0 flex-col border-r border-lab-line/60 bg-[#0a1023] transition-[width] duration-200 md:flex', collapsed ? 'w-[58px]' : 'w-[196px]')}>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {NAV_MAIN.map((n) => <Item key={n.to} item={n} collapsed={collapsed} />)}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center gap-2 rounded-[6px] py-2 text-[11px] font-bold text-lab-muted hover:bg-white/5 hover:text-white" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} data-testid="sidebar-toggle">
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Recolher</>}
        </button>
      </nav>
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[260px] max-w-[82vw] flex-col border-r border-lab-line/60 bg-[#0a1023] p-2" data-testid="mobile-sidebar">
            <button className="mb-2 flex items-center gap-2 self-end rounded px-2 py-1 text-[12px] text-lab-muted hover:text-white" onClick={() => setMobileNav(false)}><X size={16} /> Fechar</button>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {NAV_MAIN.map((n) => <Item key={n.to} item={n} collapsed={false} onNavigate={() => setMobileNav(false)} />)}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
