import { useBackendStore } from '@/services/backend'
import { setRuntimeMode } from '@/services/config'
import { connectRealtime, disconnectRealtime } from '@/services/realtime'
import { platform } from '@/services/platform'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'

let started = false
let timer: ReturnType<typeof setInterval> | null = null
let currentUser: string | null = null

const canUseBackend = () => !useAuthStore.getState().enabled || !!useAuthStore.getState().session

/**
 * Conecta ao backend (com o token do usuário quando há login).
 * Online → agentes reais + eventos SSE. Offline → agentes de exemplo apenas para visualização.
 */
export async function connectBackend() {
  if (!canUseBackend()) return false
  const online = await useBackendStore.getState().check()
  useSimulationStore.getState().reset()
  await useLabStore.getState().load().catch(() => undefined)
  if (online) {
    const sim = useSimulationStore.getState()
    sim.ensure(useLabStore.getState().agents.map((a) => a.id))
    await connectRealtime(true)
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

/** Limpa tudo que pertence ao usuário que saiu (nada fica visível para o próximo). */
function clearUserData() {
  disconnectRealtime(true)
  setRuntimeMode('demo')
  useSimulationStore.getState().reset()
  useChatStore.setState({ byAgent: {}, pending: {} })
  useLabStore.setState({ agents: [], workflows: [], providers: [], credentials: [], organizations: [], loaded: false })
}

export async function bootstrap() {
  if (started) return
  started = true
  const auth = useAuthStore.getState()
  if (auth.enabled) {
    await auth.init()
    currentUser = useAuthStore.getState().user?.id ?? null
    supabase?.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null
      if (event === 'TOKEN_REFRESHED') return void connectRealtime(true)
      if (uid === currentUser) return
      currentUser = uid
      // fora do callback do SDK (evita bloqueio interno do supabase-js)
      setTimeout(() => {
        clearUserData()
        if (uid) void connectBackend()
      }, 0)
    })
  }
  await connectBackend()
  timer ??= setInterval(() => {
    if (useBackendStore.getState().status === 'offline' && canUseBackend()) void connectBackend()
  }, 10000)
}
