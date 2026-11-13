import { useBackendStore } from '@/services/backend'
import { connectRealtime, disconnectRealtime } from '@/services/realtime'
import { platform } from '@/services/platform'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'

let started = false
let timer: ReturnType<typeof setInterval> | null = null

/**
 * Conecta ao backend local. Online → agentes reais + eventos SSE.
 * Offline → agentes de exemplo apenas para visualização (nada é executado);
 * nova tentativa automática a cada 10 s.
 */
export async function connectBackend() {
  const online = await useBackendStore.getState().check()
  useSimulationStore.getState().reset()
  await useLabStore.getState().load().catch(() => undefined)
  if (online) {
    const sim = useSimulationStore.getState()
    sim.ensure(useLabStore.getState().agents.map((a) => a.id))
    connectRealtime()
    // estados atuais (ex.: após recarregar a página durante uma execução)
    const ov = await platform.overview().catch(() => null)
    for (const t of ov?.runningTasks ?? []) {
      if (!t.agentId) continue
      sim.ingest({ type: 'agent.state', agentId: t.agentId, state: 'working', taskId: t.id, taskTitle: t.title, ts: new Date().toISOString(), origin: 'real' })
      sim.setStep(t.agentId, t.step, t.stepsDone, t.stepsTotal)
    }
  } else {
    disconnectRealtime()
  }
  return online
}

export async function bootstrap() {
  if (started) return
  started = true
  await connectBackend()
  timer ??= setInterval(() => {
    if (useBackendStore.getState().status === 'offline') void connectBackend()
  }, 10000)
}
