import { Outlet, useLocation, useMatches } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Toaster } from '../ui/Toaster'
import { HelpModal } from './HelpModal'
import { useUiStore } from '@/stores/uiStore'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '../ui/primitives'
import { useBackendStore } from '@/services/backend'

/** Versão mínima da API esperada por este frontend (apps/api/app/routers/health.py). */
const REQUIRED_API = [0, 4, 0]

function outdated(v: string | null) {
  if (!v) return false
  const p = v.split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) { if ((p[i] ?? 0) !== REQUIRED_API[i]) return (p[i] ?? 0) < REQUIRED_API[i] }
  return false
}

function OutdatedBackend() {
  const { status, version } = useBackendStore()
  if (status !== 'online' || !outdated(version)) return null
  return (
    <p className="border-b border-neon-gold/60 bg-neon-gold/15 px-4 py-2 text-[13px] text-neon-gold" role="alert" data-testid="backend-outdated">
      O backend em execução é a versão {version}, mas o app espera {REQUIRED_API.join('.')}. Seus dados estão preservados — pare o uvicorn (Ctrl+C) e inicie de novo para carregar o código atualizado.
    </p>
  )
}

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
      <OutdatedBackend />
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
