import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Mission } from '@/types/domain'
import { appConfig } from '@/services/config'
import { demoSimulator } from '@/simulation/demoSimulator'
import { useSimulationStore } from './simulationStore'
import { useUiStore } from './uiStore'

/**
 * Missões atribuídas pelo usuário. No modo demo são executadas pelo DemoSimulator
 * (eventos marcados como demo). No modo real serão enviadas ao backend (Fase 4).
 */
interface MissionState {
  missions: Mission[]
  create: (input: { title: string; description: string; agentIds: string[]; envId: string }) => Mission | null
  remove: (id: string) => void
}

const uid = () => `mis-${Math.random().toString(36).slice(2, 8)}`

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      missions: [],
      create(input) {
        if (appConfig.mode === 'real') {
          useUiStore.getState().toast('Execução real de missões requer o backend (Fase 4).', 'warn')
          return null
        }
        const taskIds = input.agentIds.map((a) => demoSimulator.runMission(a, input.title)).filter((x): x is string => !!x)
        if (!taskIds.length) {
          useUiStore.getState().toast('Nenhum agente disponível (pausado ou arquivado).', 'warn')
          return null
        }
        const m: Mission = { id: uid(), ...input, status: 'em_execucao', taskIds, createdAt: new Date().toISOString(), origin: 'demo' }
        set({ missions: [m, ...get().missions].slice(0, 50) })
        useUiStore.getState().toast(`Missão “${m.title}” atribuída (simulação demo)`, 'success')
        return m
      },
      remove(id) {
        set({ missions: get().missions.filter((m) => m.id !== id) })
      },
    }),
    { name: 'agentslab:missions:v1', storage: createJSONStorage(() => localStorage) },
  ),
)

// Atualiza o status das missões a partir dos eventos de conclusão.
let lastLen = 0
useSimulationStore.subscribe((s) => {
  if (s.sessionRuns.length === lastLen) return
  lastLen = s.sessionRuns.length
  const finished = new Map(s.sessionRuns.map((r) => [r.id, r.status]))
  const ms = useMissionStore.getState().missions
  let changed = false
  const next = ms.map((m) => {
    if (m.status !== 'em_execucao') return m
    const st = m.taskIds.map((t) => finished.get(t))
    if (st.some((x) => x === undefined)) return m
    changed = true
    return { ...m, status: st.every((x) => x === 'ok') ? 'concluida' : 'falhou', finishedAt: new Date().toISOString() } as Mission
  })
  if (changed) useMissionStore.setState({ missions: next })
})
