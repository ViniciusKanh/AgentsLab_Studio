import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Crosshair } from 'lucide-react'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { platform, PROJECT_STATUS } from '@/services/platform'
import { appConfig } from '@/services/config'
import { onPlatformEvent } from '@/services/realtime'
import type { Project } from '@/types/platform'
import { activityLabel, STATE_META } from '@/simulation/states'
import { worldBus } from '@/world/events/bus'
import { Avatar, Chip } from '@/components/ui/primitives'

/** Modo gerenciamento: agentes da sala e projetos reais, sem sair do ambiente. */
export function ManagementPanel({ envId, onAssign }: { envId: string; onAssign: (id: string) => void }) {
  const agents = useLabStore((s) => s.agents)
  const runtime = useSimulationStore((s) => s.runtime)
  const select = useSimulationStore((s) => s.select)
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    if (appConfig.mode !== 'real') return
    const load = () => platform.projects().then(setProjects).catch(() => undefined)
    void load()
    return onPlatformEvent((e) => { if (e.type === 'project.updated') void load() })
  }, [])
  const here = useMemo(() => agents.filter((a) => a.environmentId === envId && a.status !== 'archived'), [agents, envId])
  return (
    <div className="absolute bottom-3 left-3 top-14 flex w-[270px] flex-col gap-2" data-testid="management-panel">
      <section className="flex min-h-0 flex-1 flex-col rounded-[8px] border border-lab-line/70 bg-[#070b17]/92">
        <header className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-[12px] font-extrabold">Agentes na sala <span className="text-lab-muted">({here.length})</span></header>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {here.map((a) => {
            const m = STATE_META[runtime[a.id]?.state ?? 'idle']
            return (
              <li key={a.id} className="flex items-center gap-2 rounded-[5px] p-1.5 hover:bg-white/5">
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => select(a.id)}>
                  <Avatar characterId={a.appearance.characterId} size={28} ring={m.color} />
                  <span className="min-w-0"><b className="block truncate text-[11.5px]">{a.name}</b><span className="text-[10px]" style={{ color: m.color }}>{a.status === 'paused' ? 'Pausado' : activityLabel(runtime[a.id]?.state ?? 'idle', runtime[a.id]?.taskKind)}</span></span>
                </button>
                <button className="text-lab-muted hover:text-neon-cyan" onClick={() => { select(a.id); worldBus.emit('camera:focus', { agentId: a.id }) }} aria-label={`Centralizar ${a.name}`}><Crosshair size={14} /></button>
                <button className="text-lab-muted hover:text-neon-green disabled:opacity-30" onClick={() => onAssign(a.id)} disabled={appConfig.mode !== 'real'} aria-label={`Atribuir tarefa a ${a.name}`} title="Atribuir tarefa"><Briefcase size={14} /></button>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="max-h-[42%] overflow-y-auto rounded-[8px] border border-lab-line/70 bg-[#070b17]/92 p-3 text-[11.5px]">
        <p className="mb-1.5 font-extrabold">Projetos</p>
        {appConfig.mode !== 'real' && <p className="text-lab-muted">Conecte o backend para ver projetos.</p>}
        {appConfig.mode === 'real' && projects.length === 0 && <p className="text-lab-muted">Nenhum projeto ainda.</p>}
        {projects.slice(0, 6).map((p) => (
          <Link key={p.id} to={`/projetos/${p.id}`} className="flex items-center justify-between gap-2 border-b border-white/5 py-1 hover:text-neon-cyan">
            <span className="truncate">{p.title}</span><Chip color={PROJECT_STATUS[p.status]?.color}>{PROJECT_STATUS[p.status]?.label}</Chip>
          </Link>
        ))}
      </section>
    </div>
  )
}
