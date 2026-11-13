import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Bell, Bot, HelpCircle, LogOut, Menu, Settings, Wifi, WifiOff } from 'lucide-react'
import { LogoEmblem } from '../brand/Logo'
import { Avatar, cx } from '../ui/primitives'
import { useLabStore } from '@/stores/labStore'
import { useBackendStore } from '@/services/backend'
import { displayName, isOwner, useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { timeAgo } from '@/lib/format'
import { getWorldMap } from '@/world/maps'

const SECTION: Record<string, string> = {
  agentes: 'Agentes', fluxos: 'Tarefas e Fluxos', provedores: 'Provedores e Custos', configuracoes: 'Configurações', organizacoes: 'Organizações',
  ambientes: 'Ambientes', documentos: 'Documentos e Conhecimento', execucoes: 'Execuções', projetos: 'Projetos',
}

/** Barra superior compacta: só o essencial. */
export function TopBar() {
  const loc = useLocation()
  const agents = useLabStore((s) => s.agents)
  const runtime = useSimulationStore((s) => s.runtime)
  const logs = useSimulationStore((s) => s.logs)
  const lastEnv = useWorldStore((s) => s.lastEnv)
  const { notificationsOpen, setNotificationsOpen, setHelpOpen } = useUiStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const backend = useBackendStore((s) => s.status)
  const { enabled: authOn, user, signOut } = useAuthStore()
  const name = authOn ? displayName(user) : 'Usuário local'
  const setMobileNav = useWorldStore((s) => s.setMobileNav)

  const seg = loc.pathname.split('/')[1]
  const place = seg === 'escritorio' ? getWorldMap('office').name : seg === 'laboratorio' ? getWorldMap('research').name : seg === '' ? `Visão Geral · ${getWorldMap(lastEnv).name}` : SECTION[seg] ?? 'AgentsLab'
  const active = agents.filter((a) => a.status === 'active').length
  const running = useMemo(() => Object.values(runtime).filter((r) => ['planning', 'working', 'collaborating', 'reviewing'].includes(r.state)).length, [runtime])
  const alerts = logs.filter((l) => l.level !== 'info').slice(-6).reverse()

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-lab-line/60 bg-[#0a1023]/95 px-2 sm:gap-3 sm:px-3" data-testid="topbar">
      <button className="grid h-9 w-9 place-items-center rounded-[6px] text-lab-text hover:bg-white/10 md:hidden" onClick={() => setMobileNav(true)} aria-label="Abrir menu" data-testid="mobile-menu"><Menu size={20} /></button>
      <Link to="/" className="flex items-center gap-2" aria-label="Início">
        <LogoEmblem size={26} />
        <span className="hidden text-[13px] font-extrabold tracking-wide text-lab-text sm:inline">AgentsLab<span className="text-neon-green">_Studio</span></span>
      </Link>
      <span className="hidden h-5 w-px bg-lab-line sm:block" />
      <span className="truncate text-[12.5px] font-bold text-neon-cyan" data-testid="topbar-place">{place}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-[5px] bg-white/5 px-2.5 py-1 text-[11.5px] md:flex" title="Agentes ativos">
          <Bot size={14} className="text-neon-green" /> <b>{active}</b> <span className="text-lab-muted">ativos</span>
        </span>
        <span className="hidden items-center gap-1.5 rounded-[5px] bg-white/5 px-2.5 py-1 text-[11.5px] md:flex" title="Execuções em andamento">
          <Activity size={14} className="text-neon-cyan" /> <b>{running}</b> <span className="text-lab-muted">em execução</span>
        </span>
        <Link to="/configuracoes" data-testid="backend-status" title={backend === 'online' ? 'Backend local conectado' : 'Backend desconectado — exibindo agentes de exemplo'}
          className={cx('flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-extrabold', backend === 'online' ? 'bg-neon-green/15 text-neon-green' : backend === 'checking' ? 'bg-white/5 text-lab-muted' : 'bg-neon-gold/15 text-neon-gold')}>
          {backend === 'online' ? <Wifi size={13} /> : <WifiOff size={13} />}<span className="hidden sm:inline">{backend === 'online' ? 'Conectado' : backend === 'checking' ? 'Conectando…' : 'Offline · exemplos'}</span>
        </Link>
        <div className="relative">
          <button className="grid h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notificações">
            <Bell size={17} />
            {alerts.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-neon-pink" />}
          </button>
          {notificationsOpen && (
            <div className="px-panel c-cyan absolute right-0 top-10 w-80 p-3">
              <p className="mb-2 text-[12px] font-extrabold">Alertas</p>
              {alerts.length === 0 ? <p className="text-[11px] text-lab-muted">Nenhum alerta recente.</p> : (
                <ul className="space-y-1.5">{alerts.map((a) => <li key={a.id} className={cx('text-[11px]', a.level === 'error' ? 'text-neon-pink' : 'text-neon-gold')}><span className="text-lab-muted">{timeAgo(a.ts)} · </span>{a.message}</li>)}</ul>
              )}
              <Link to="/execucoes" onClick={() => setNotificationsOpen(false)} className="mt-2 block text-right text-[11px] font-bold text-neon-cyan">Ver execuções →</Link>
            </div>
          )}
        </div>
        <Link to="/configuracoes" className="hidden h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10 sm:grid" aria-label="Configurações"><Settings size={17} /></Link>
        <button className="hidden h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10 sm:grid" onClick={() => setHelpOpen(true)} aria-label="Ajuda"><HelpCircle size={17} /></button>
        <div className="relative">
          <button className="flex items-center gap-2 rounded-[6px] py-1 pl-1 pr-2 hover:bg-white/10" onClick={() => setProfileOpen(!profileOpen)} aria-label="Perfil">
            <Avatar characterId="vinicius" size={28} ring="#9d62ff" />
            <span className="hidden text-left leading-tight lg:block"><b className="block max-w-[160px] truncate text-[11.5px]" data-testid="user-name">{name}</b><span className="text-[10px] text-lab-muted">{authOn && isOwner(user) ? 'Conta principal' : 'Gestor'}</span></span>
          </button>
          {profileOpen && <button className="fixed inset-0 z-0 cursor-default" aria-label="Fechar menu do perfil" onClick={() => setProfileOpen(false)} />}
          {profileOpen && (
            <div className="px-panel c-purple absolute right-0 top-11 z-10 w-64 p-3">
              <p className="mb-2 truncate text-[12px] font-extrabold">{name}{authOn && user?.email && <span className="block text-[10.5px] font-normal text-lab-muted">{user.email}</span>}</p>
              <div className="grid gap-1 text-[11.5px]">
                <Link to="/projetos" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Meus projetos</Link>
                <Link to="/provedores?tab=chaves" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Chaves de API</Link>
                <Link to="/configuracoes" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Conta e conexão</Link>
                {authOn && <button onClick={() => { setProfileOpen(false); void signOut() }} className="flex items-center gap-1.5 rounded px-2 py-1 text-left text-neon-pink hover:bg-white/5" data-testid="logout"><LogOut size={13} /> Sair</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
