import { useMemo } from 'react'
import { Briefcase, Crosshair } from 'lucide-react'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useMissionStore } from '@/stores/missionStore'
import { STATE_META } from '@/simulation/states'
import { worldBus } from '@/world/events/bus'
import { Avatar, Chip, DemoTag } from '@/components/ui/primitives'

/** Modo gerenciamento: lista de agentes da sala e missões, sem sair do ambiente. */
export function ManagementPanel({ envId, onMission }: { envId: string; onMission: (ids: string[]) => void }) {
  const agents = useLabStore((s) => s.agents)
  const runtime = useSimulationStore((s) => s.runtime)
  const select = useSimulationStore((s) => s.select)
  const running = useSimulationStore((s) => s.running)
  const setRunning = useSimulationStore((s) => s.setRunning)
  const missions = useMissionStore((s) => s.missions)
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
                  <span className="min-w-0"><b className="block truncate text-[11.5px]">{a.name}</b><span className="text-[10px]" style={{ color: m.color }}>{a.status === 'paused' ? 'Pausado' : m.label}</span></span>
                </button>
                <button className="text-lab-muted hover:text-neon-cyan" onClick={() => { select(a.id); worldBus.emit('camera:focus', { agentId: a.id }) }} aria-label={`Centralizar ${a.name}`}><Crosshair size={14} /></button>
                <button className="text-lab-muted hover:text-neon-green" onClick={() => onMission([a.id])} aria-label={`Missão para ${a.name}`}><Briefcase size={14} /></button>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="max-h-[42%] overflow-y-auto rounded-[8px] border border-lab-line/70 bg-[#070b17]/92 p-3 text-[11.5px]">
        <p className="mb-1.5 flex items-center gap-2 font-extrabold">Missões <DemoTag /></p>
        {missions.length === 0 && <p className="text-lab-muted">Nenhuma missão ainda. Use “Nova missão”.</p>}
        {missions.slice(0, 6).map((m) => (
          <p key={m.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-1"><span className="truncate">{m.title}</span><Chip color={m.status === 'concluida' ? '#00f5a0' : m.status === 'falhou' ? '#ff537a' : '#39d6ff'}>{m.status.replace('_', ' ')}</Chip></p>
        ))}
        <label className="mt-2 flex items-center justify-between text-[11px] text-lab-muted">
          Missões automáticas (demo)
          <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} className="accent-[#00f5a0]" />
        </label>
      </section>
    </div>
  )
}
