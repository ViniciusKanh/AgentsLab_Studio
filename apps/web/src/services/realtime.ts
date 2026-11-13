import type { PlatformEvent } from '@/types/platform'
import type { AgentRuntimeState } from '@/types/domain'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { worldBus } from '@/world/events/bus'
import { apiBase } from './backend'

/**
 * Eventos em tempo real do backend (SSE em GET /api/v1/events).
 * O EventSource reconecta sozinho e reenvia Last-Event-ID; o backend devolve o que foi perdido.
 * Os estados visuais dos agentes são DERIVADOS destes eventos — nunca inventados no frontend.
 */
type Listener = (e: PlatformEvent) => void
const listeners = new Set<Listener>()
let source: EventSource | null = null
let connectedTo = ''

export function onPlatformEvent(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function dispatchPlatformEvent(e: PlatformEvent) {
  const p = e.payload as Record<string, unknown>
  const sim = useSimulationStore.getState()
  const ts = e.ts
  switch (e.type) {
    case 'agent.state':
      sim.ingest({ type: 'agent.state', agentId: String(p.agentId), state: p.state as AgentRuntimeState, taskId: (p.taskId as string) ?? undefined,
        taskTitle: (p.taskTitle as string) ?? undefined, partnerId: (p.partnerId as string) ?? undefined, ts, origin: 'real' })
      break
    case 'task.progress':
      sim.ingest({ type: 'task.progress', agentId: String(p.agentId), taskId: String(p.taskId), progress: Number(p.progress ?? 0), tokens: Number(p.tokens ?? 0), ts, origin: 'real' })
      sim.setStep(String(p.agentId), String(p.step ?? ''), Number(p.stepsDone ?? 0), Number(p.stepsTotal ?? 0))
      break
    case 'task.finished':
      sim.ingest({ type: 'task.finished', agentId: String(p.agentId), taskId: String(p.taskId), status: p.status === 'done' ? 'done' : 'failed', tokens: 0, costUsd: 0,
        durationMs: 0, result: String(p.title ?? ''), ts, origin: 'real' })
      break
    case 'agent.message': {
      const m = p as { fromAgentId: string | null; toAgentId: string | null; type: string; content: string; fromKind: string }
      worldBus.emit('agent:message', { fromAgentId: m.fromAgentId, toAgentId: m.toAgentId, type: m.type, content: m.content })
      sim.ingest({ type: 'log', ts, origin: 'real', entry: { id: `ev-${e.id}`, ts, level: m.type === 'alerta' ? 'warn' : 'info', agentId: m.fromAgentId,
        message: `[${m.type}] ${m.content.replace(/\s+/g, ' ').slice(0, 160)}`, origin: 'real' } })
      if (m.fromKind === 'user') useWorldStore.getState().pushFeed({ id: `ev-${e.id}`, ts, text: `Gestor: ${m.content.slice(0, 100)}`, kind: 'operacional-real' })
      break
    }
    case 'execution': {
      const x = p as { agentId: string; status: string; model: string; purpose: string; error: string }
      if (x.status === 'error') sim.ingest({ type: 'log', ts, origin: 'real', entry: { id: `ev-${e.id}`, ts, level: 'error', agentId: x.agentId, message: `Falha no modelo ${x.model} (${x.purpose}): ${x.error.slice(0, 160)}`, origin: 'real' } })
      break
    }
  }
  listeners.forEach((fn) => fn(e))
}

export function connectRealtime() {
  const base = apiBase()
  if (typeof EventSource === 'undefined' || (source && connectedTo === base)) return
  disconnectRealtime()
  connectedTo = base
  source = new EventSource(`${base}/api/v1/events`)
  source.onmessage = (msg) => {
    try {
      dispatchPlatformEvent(JSON.parse(msg.data) as PlatformEvent)
    } catch (err) {
      console.error('[AgentsLab] evento inválido', err)
    }
  }
}

export function disconnectRealtime() {
  source?.close()
  source = null
  connectedTo = ''
}
