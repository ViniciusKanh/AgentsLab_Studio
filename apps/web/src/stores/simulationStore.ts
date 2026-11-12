import { create } from 'zustand'
import type { AgentRuntime, AgentRuntimeState, ExecutionRun, LogEntry, SimulationEvent } from '@/types/domain'

/**
 * Estado de execução CENTRALIZADO. A sala Phaser e os painéis React leem daqui.
 * Só muda via `ingest(evento)` — no modo real os eventos vêm do backend (SSE),
 * no modo demo vêm do DemoSimulator. Os personagens nunca definem o próprio estado.
 */
interface SimState {
  /** autopiloto de missões demonstrativas (não afeta missões atribuídas pelo usuário) */
  running: boolean
  runtime: Record<string, AgentRuntime>
  sessionRuns: ExecutionRun[]
  logs: LogEntry[]
  selectedAgentId: string | null
  manualPaused: Record<string, boolean>
  ingest: (e: SimulationEvent) => void
  select: (id: string | null) => void
  setRunning: (v: boolean) => void
  togglePause: (agentId: string) => void
  ensure: (agentIds: string[]) => void
}

const blank = (agentId: string, state: AgentRuntimeState = 'idle'): AgentRuntime => ({
  agentId, state, taskId: null, taskTitle: null, progress: 0, partnerId: null, since: new Date().toISOString(), tokensSession: 0,
})

export const useSimulationStore = create<SimState>((set, get) => ({
  running: true,
  runtime: {},
  sessionRuns: [],
  logs: [],
  selectedAgentId: null,
  manualPaused: {},
  ensure(agentIds) {
    const rt = { ...get().runtime }
    let changed = false
    for (const id of agentIds) {
      if (!rt[id]) { rt[id] = blank(id); changed = true }
    }
    if (changed) set({ runtime: rt })
  },
  ingest(e) {
    const rt = { ...get().runtime }
    switch (e.type) {
      case 'agent.state': {
        const prev = rt[e.agentId] ?? blank(e.agentId)
        rt[e.agentId] = {
          ...prev, state: e.state, since: e.ts,
          taskId: e.taskId ?? (e.state === 'idle' ? null : prev.taskId),
          taskTitle: e.taskTitle ?? (e.state === 'idle' ? null : prev.taskTitle),
          partnerId: e.state === 'collaborating' ? e.partnerId ?? null : null,
          progress: e.state === 'planning' ? 0 : e.state === 'idle' ? 0 : prev.progress,
        }
        set({ runtime: rt })
        break
      }
      case 'task.progress': {
        const prev = rt[e.agentId] ?? blank(e.agentId)
        rt[e.agentId] = { ...prev, progress: e.progress, tokensSession: prev.tokensSession + e.tokens }
        set({ runtime: rt })
        break
      }
      case 'task.finished': {
        const prev = rt[e.agentId] ?? blank(e.agentId)
        rt[e.agentId] = { ...prev, progress: e.status === 'done' ? 1 : prev.progress }
        const run: ExecutionRun = {
          id: e.taskId, agentId: e.agentId, title: prev.taskTitle ?? 'Tarefa', project: 'Simulação', status: e.status === 'done' ? 'ok' : 'error',
          startedAt: new Date(new Date(e.ts).getTime() - e.durationMs).toISOString(), durationMs: e.durationMs, tokens: e.tokens, costUsd: e.costUsd,
          provider: 'gemini', model: '—', origin: e.origin,
        }
        set({ runtime: rt, sessionRuns: [run, ...get().sessionRuns].slice(0, 60) })
        break
      }
      case 'log':
        set({ logs: [...get().logs, e.entry].slice(-120) })
        break
    }
  },
  select: (id) => set({ selectedAgentId: id }),
  setRunning: (v) => set({ running: v }),
  togglePause(agentId) {
    const mp = { ...get().manualPaused, [agentId]: !get().manualPaused[agentId] }
    set({ manualPaused: mp })
  },
}))
