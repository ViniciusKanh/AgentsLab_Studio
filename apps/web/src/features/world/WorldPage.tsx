import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FolderPlus, EyeOff, LayoutPanelLeft, Maximize, Minus, Pause, Play, Plus, Tag, UserPlus, X, FastForward } from 'lucide-react'
import { WorldCanvas } from '@/world/render/WorldCanvas'
import { worldBus } from '@/world/events/bus'
import { envPath, getWorldMap } from '@/world/maps'
import { useWorldStore } from '@/stores/worldStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useLabStore } from '@/stores/labStore'
import { cx } from '@/components/ui/primitives'
import { AgentContextPanel } from './AgentContextPanel'
import { EventFeed } from './EventFeed'
import { ManagementPanel } from './ManagementPanel'
import { AssignTaskModal } from './AssignTaskModal'
import { OverviewHud } from './OverviewHud'
import { ObjectCard } from './ObjectCard'

const ENVS = ['office', 'research'] as const

/**
 * Tela principal "Environment First": o cenário ocupa a maior parte da área;
 * painéis são contextuais, recolhíveis e nunca escondem o ambiente permanentemente.
 */
export default function WorldPage({ envId: fixedEnv }: { envId?: string }) {
  const lastEnv = useWorldStore((s) => s.lastEnv)
  const envId = fixedEnv ?? lastEnv
  const nav = useNavigate()
  const { ambientSpeed, setAmbientSpeed, labels, setLabels, observer, setObserver, management, setManagement, setLastEnv } = useWorldStore()
  const selectedId = useSimulationStore((s) => s.selectedAgentId)
  const select = useSimulationStore((s) => s.select)
  const agents = useLabStore((s) => s.agents)
  const selected = agents.find((a) => a.id === selectedId && (a.environmentId === envId || (envId === 'office' && !['office', 'research'].includes(a.environmentId)))) ?? null
  const [assignFor, setAssignFor] = useState<string | null>(null)

  useEffect(() => {
    setLastEnv(envId)
  }, [envId, setLastEnv])

  // Esc sai do modo observador / fecha seleção
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (observer) setObserver(false)
      else select(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [observer, setObserver, select])

  const btn = 'grid h-8 w-8 place-items-center rounded-[6px] text-lab-text transition-colors hover:bg-white/10'
  const on = 'bg-neon-green/20 text-neon-green'

  return (
    <div className="flex h-full min-h-0" data-testid="world-page">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <WorldCanvas key={envId} envId={envId} />

          {/* barra de ferramentas flutuante */}
          {!observer ? (
            <div className="world-toolbar absolute left-3 top-3 flex flex-wrap items-center gap-1" data-testid="world-toolbar">
              <div className="flex rounded-[7px] bg-[#070b17]/85 p-0.5" role="tablist" aria-label="Ambiente">
                {ENVS.map((e) => (
                  <button key={e} role="tab" aria-selected={envId === e} onClick={() => nav(envPath(e))} className={cx('rounded-[6px] px-3 py-1.5 text-[11.5px] font-bold', envId === e ? 'bg-neon-green text-[#04120c]' : 'text-lab-muted hover:text-white')}>
                    {getWorldMap(e).name.replace(' de Pesquisa', '')}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 rounded-[7px] bg-[#070b17]/85 p-0.5">
                <button className={cx(btn, ambientSpeed === 0 && on)} onClick={() => setAmbientSpeed(0)} aria-label="Pausar simulação ambiental" title="Pausar simulação ambiental"><Pause size={15} /></button>
                <button className={cx(btn, ambientSpeed === 1 && on)} onClick={() => setAmbientSpeed(1)} aria-label="Velocidade normal" title="Velocidade normal"><Play size={15} /></button>
                <button className={cx(btn, ambientSpeed === 3 && on)} onClick={() => setAmbientSpeed(3)} aria-label="Velocidade acelerada" title="Acelerada (somente ambiente — não altera tarefas)"><FastForward size={15} /></button>
              </div>
              <div className="flex items-center gap-0.5 rounded-[7px] bg-[#070b17]/85 p-0.5">
                <button className={btn} onClick={() => worldBus.emit('camera:zoom', { factor: 1 / 1.25 })} aria-label="Diminuir zoom"><Minus size={15} /></button>
                <button className={btn} onClick={() => worldBus.emit('camera:fit', undefined)} aria-label="Enquadrar ambiente" title="Enquadrar"><Maximize size={14} /></button>
                <button className={btn} onClick={() => worldBus.emit('camera:zoom', { factor: 1.25 })} aria-label="Aumentar zoom"><Plus size={15} /></button>
              </div>
              <div className="flex items-center gap-0.5 rounded-[7px] bg-[#070b17]/85 p-0.5">
                <button className={cx(btn, labels && on)} onClick={() => setLabels(!labels)} aria-pressed={labels} aria-label="Rótulos" title="Rótulos dos agentes"><Tag size={15} /></button>
                <button className={cx(btn, management && on)} onClick={() => setManagement(!management)} aria-pressed={management} aria-label="Modo gerenciamento" title="Modo gerenciamento"><LayoutPanelLeft size={15} /></button>
                <button className={btn} onClick={() => { setObserver(true); select(null) }} aria-label="Modo observador" title="Modo observador (Esc para sair)"><Eye size={15} /></button>
              </div>
            </div>
          ) : (
            <button className="absolute right-3 top-3 flex items-center gap-1.5 rounded-[7px] bg-[#070b17]/80 px-3 py-1.5 text-[11.5px] font-bold text-lab-muted hover:text-white" onClick={() => setObserver(false)} data-testid="exit-observer">
              <EyeOff size={14} /> Sair do modo observador (Esc)
            </button>
          )}

          {!observer && (
            <div className="absolute right-3 top-3 flex gap-1.5">
              <button className="px-btn sm ghost bg-[#070b17]/85" onClick={() => nav(`/agentes/novo?ambiente=${envId}`)}><UserPlus size={13} /> Novo agente</button>
              <button className="px-btn sm solid" onClick={() => nav('/projetos?novo=1')} data-testid="new-project"><FolderPlus size={13} /> Novo projeto</button>
            </div>
          )}

          {management && !observer && <ManagementPanel envId={envId} onAssign={(id) => setAssignFor(id)} />}
          {!observer && !management && <OverviewHud />}
          {!observer && <ObjectCard />}
        </div>
        {!observer && <EventFeed />}
      </div>
      {selected && !observer && (
        <AgentContextPanel agent={selected} onClose={() => select(null)} onAssign={() => setAssignFor(selected.id)} />
      )}
      {assignFor && <AssignTaskModal agentId={assignFor} onClose={() => setAssignFor(null)} />}
      {observer && <button className="sr-only" onClick={() => setObserver(false)}><X /> sair</button>}
    </div>
  )
}
