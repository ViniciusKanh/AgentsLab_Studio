import type { PlatformEvent } from '@/types/platform'
import type { AgentRuntimeState } from '@/types/domain'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { worldBus } from '@/world/events/bus'
import { accessToken } from '@/stores/authStore'
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
let lastId = 0

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

/**
 * Conecta ao SSE do backend. EventSource não envia cabeçalhos, então o access token vai na URL
 * (aceito pelo backend somente nesta rota). Ao renovar o token, reconecte com force=true.
 */
export async function connectRealtime(force = false) {
  const base = apiBase()
  const token = await accessToken()
  const target = `${base}|${token ?? ''}`
  if (typeof EventSource === 'undefined' || (source && connectedTo === target && !force)) return
  disconnectRealtime()
  connectedTo = target
  const qs = new URLSearchParams()
  if (token) qs.set('access_token', token)
  if (lastId) qs.set('after', String(lastId)) // reconexão manual: recupera eventos perdidos
  source = new EventSource(`${base}/api/v1/events${qs.size ? `?${qs}` : ''}`)
  source.onmessage = (msg) => {
    try {
      const ev = JSON.parse(msg.data) as PlatformEvent
      if (ev.id <= lastId) return
      lastId = ev.id
      dispatchPlatformEvent(ev)
    } catch (err) {
      console.error('[AgentsLab] evento inválido', err)
    }
  }
}

export function disconnectRealtime(resetCursor = false) {
  source?.close()
  source = null
  connectedTo = ''
  if (resetCursor) lastId = 0
}
