import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Bell, Bot, HelpCircle, Settings } from 'lucide-react'
import { LogoEmblem } from '../brand/Logo'
import { Avatar, DemoTag, ProgressBar, cx } from '../ui/primitives'
import { useLabStore } from '@/stores/labStore'
import { useLevel } from '@/stores/gameStore'
import { useUiStore } from '@/stores/uiStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { appConfig } from '@/services/config'
import { fmtInt, timeAgo } from '@/lib/format'
import { getWorldMap } from '@/world/maps'

const SECTION: Record<string, string> = {
  agentes: 'Agentes', workflows: 'Workflows', modelos: 'Modelos', configuracoes: 'Configurações', painel: 'Painel de métricas',
  ambientes: 'Ambientes', conhecimento: 'Conhecimento', execucoes: 'Execuções', gamificacao: 'Missões & Conquistas', projetos: 'Projetos', experimentos: 'Experimentos',
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
  const { level, xp, next } = useLevel()

  const seg = loc.pathname.split('/')[1]
  const place = seg === 'escritorio' ? getWorldMap('office').name : seg === 'laboratorio' ? getWorldMap('research').name : seg === '' ? getWorldMap(lastEnv).name : SECTION[seg] ?? 'AgentsLab'
  const active = agents.filter((a) => a.status === 'active').length
  const running = useMemo(() => Object.values(runtime).filter((r) => ['planning', 'working', 'collaborating', 'reviewing'].includes(r.state)).length, [runtime])
  const alerts = logs.filter((l) => l.level !== 'info').slice(-6).reverse()

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-lab-line/60 bg-[#0a1023]/95 px-3" data-testid="topbar">
      <Link to="/" className="flex items-center gap-2" aria-label="Início">
        <LogoEmblem size={26} />
        <span className="text-[13px] font-extrabold tracking-wide text-lab-text">AgentsLab<span className="text-neon-green">_Studio</span></span>
      </Link>
      <span className="h-5 w-px bg-lab-line" />
      <span className="truncate text-[12.5px] font-bold text-neon-cyan" data-testid="topbar-place">{place}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-[5px] bg-white/5 px-2.5 py-1 text-[11.5px] md:flex" title="Agentes ativos">
          <Bot size={14} className="text-neon-green" /> <b>{active}</b> <span className="text-lab-muted">ativos</span>
        </span>
        <span className="hidden items-center gap-1.5 rounded-[5px] bg-white/5 px-2.5 py-1 text-[11.5px] md:flex" title="Execuções em andamento">
          <Activity size={14} className="text-neon-cyan" /> <b>{running}</b> <span className="text-lab-muted">em execução</span>
        </span>
        {appConfig.mode === 'demo' && <DemoTag label="MODO DEMO" />}
        <div className="relative">
          <button className="grid h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notificações">
            <Bell size={17} />
            {alerts.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-neon-pink" />}
          </button>
          {notificationsOpen && (
            <div className="px-panel c-cyan absolute right-0 top-10 w-80 p-3">
              <p className="mb-2 flex items-center gap-2 text-[12px] font-extrabold">Notificações <DemoTag /></p>
              {alerts.length === 0 ? <p className="text-[11px] text-lab-muted">Nenhum alerta recente.</p> : (
                <ul className="space-y-1.5">{alerts.map((a) => <li key={a.id} className={cx('text-[11px]', a.level === 'error' ? 'text-neon-pink' : 'text-neon-gold')}><span className="text-lab-muted">{timeAgo(a.ts)} · </span>{a.message}</li>)}</ul>
              )}
              <Link to="/execucoes" onClick={() => setNotificationsOpen(false)} className="mt-2 block text-right text-[11px] font-bold text-neon-cyan">Ver execuções →</Link>
            </div>
          )}
        </div>
        <Link to="/configuracoes" className="grid h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10" aria-label="Configurações"><Settings size={17} /></Link>
        <button className="grid h-8 w-8 place-items-center rounded-[6px] text-lab-text hover:bg-white/10" onClick={() => setHelpOpen(true)} aria-label="Ajuda"><HelpCircle size={17} /></button>
        <div className="relative">
          <button className="flex items-center gap-2 rounded-[6px] py-1 pl-1 pr-2 hover:bg-white/10" onClick={() => setProfileOpen(!profileOpen)} aria-label="Perfil">
            <Avatar characterId="vinicius" size={28} ring="#9d62ff" />
            <span className="hidden text-left leading-tight lg:block"><b className="block text-[11.5px]">Vinicius Santos</b><span className="text-[10px] text-lab-muted">Arquiteto de Agentes · Nv. {level}</span></span>
          </button>
          {profileOpen && (
            <div className="px-panel c-purple absolute right-0 top-11 w-64 p-3" onMouseLeave={() => setProfileOpen(false)}>
              <p className="text-[12px] font-extrabold">Nível {level} do laboratório</p>
              <p className="mb-1 text-[10.5px] text-lab-muted">{fmtInt(xp)} / {fmtInt(next)} XP</p>
              <ProgressBar value={xp / Math.max(1, next)} height={7} />
              <div className="mt-3 grid gap-1 text-[11.5px]">
                <Link to="/gamificacao" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Missões & conquistas</Link>
                <Link to="/painel" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Painel de métricas</Link>
                <Link to="/modelos?tab=chaves" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 hover:bg-white/5">Chaves de API</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
