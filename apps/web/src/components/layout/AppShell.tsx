import { Outlet, useLocation, useMatches } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Toaster } from '../ui/Toaster'
import { HelpModal } from './HelpModal'
import { useUiStore } from '@/stores/uiStore'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '../ui/primitives'

/**
 * Casca da aplicação. Rotas com handle { immersive: true } (mundo virtual)
 * ocupam toda a área sem padding; no modo observador a casca some.
 */
export function AppShell() {
  const loc = useLocation()
  const matches = useMatches()
  const immersive = matches.some((m) => (m.handle as { immersive?: boolean } | undefined)?.immersive)
  const observer = useWorldStore((s) => s.observer) && immersive
  const setNotificationsOpen = useUiStore((s) => s.setNotificationsOpen)
  useEffect(() => { setNotificationsOpen(false) }, [loc.pathname, setNotificationsOpen])
  return (
    <div className="lab-backdrop flex h-full min-h-0 flex-col">
      {!observer && <TopBar />}
      <div className="flex min-h-0 flex-1">
        {!observer && <Sidebar />}
        <main className={cx('min-h-0 min-w-0 flex-1', immersive ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden p-2 sm:p-3')}>
          <Outlet />
        </main>
      </div>
      <Toaster />
      <HelpModal />
    </div>
  )
}
