import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Gamificação baseada em AÇÕES VERIFICÁVEIS do sistema.
 * - XP: pontos de experiência do laboratório (não monetários)
 * - Créditos: moeda fictícia de jogo (sem valor real)
 * - Tokens de provedores: NUNCA são misturados com XP/créditos (ver labStore/providers)
 */
export type GameAction = 'agentCreated' | 'workflowSaved' | 'workflowRun' | 'environmentVisited' | 'taskObserved'

export interface Counters {
  agentsCreated: number
  ragAgentsCreated: number
  workflowsSaved: number
  workflowRuns: number
  tasksObserved: number
  environmentsVisited: string[]
}

export interface Mission {
  id: string
  title: string
  description: string
  target: number
  progress: (c: Counters) => number
  rewardXp: number
  rewardCredits: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  check: (c: Counters, level: number) => boolean
  xp: number
}

export const MISSIONS: Mission[] = [
  { id: 'm-first-agent', title: 'Criar seu primeiro agente', description: 'Use o Agent Studio para criar e salvar um agente.', target: 1, progress: (c) => c.agentsCreated, rewardXp: 200, rewardCredits: 50 },
  { id: 'm-rag-agent', title: 'Criar um agente com RAG', description: 'Ative a base de conhecimento (RAG) na etapa 4.', target: 1, progress: (c) => c.ragAgentsCreated, rewardXp: 250, rewardCredits: 60 },
  { id: 'm-workflow', title: 'Montar e salvar um workflow', description: 'Conecte nós no Workflow Studio e salve.', target: 1, progress: (c) => c.workflowsSaved, rewardXp: 150, rewardCredits: 40 },
  { id: 'm-run', title: 'Executar uma simulação de fluxo', description: 'Rode a simulação demonstrativa de um workflow.', target: 1, progress: (c) => c.workflowRuns, rewardXp: 100, rewardCredits: 30 },
  { id: 'm-explorer', title: 'Explorar os 3 ambientes', description: 'Visite Escritório, Laboratório e Central.', target: 3, progress: (c) => c.environmentsVisited.length, rewardXp: 150, rewardCredits: 40 },
  { id: 'm-observer', title: 'Acompanhar 25 tarefas', description: 'Observe tarefas concluídas no laboratório.', target: 25, progress: (c) => c.tasksObserved, rewardXp: 300, rewardCredits: 80 },
]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a-first', title: 'Primeiro Agente', description: 'Criou um agente no Agent Studio', icon: 'bot', check: (c) => c.agentsCreated >= 1, xp: 0 },
  { id: 'a-team', title: 'Equipe Formada', description: 'Criou 5 agentes', icon: 'trophy', check: (c) => c.agentsCreated >= 5, xp: 0 },
  { id: 'a-flow', title: 'Arquiteto de Fluxos', description: 'Salvou um workflow', icon: 'chart', check: (c) => c.workflowsSaved >= 1, xp: 0 },
  { id: 'a-explorer', title: 'Explorador', description: 'Visitou todos os ambientes', icon: 'target', check: (c) => c.environmentsVisited.length >= 3, xp: 0 },
  { id: 'a-observer', title: 'Observador', description: '100 tarefas acompanhadas', icon: 'flask', check: (c) => c.tasksObserved >= 100, xp: 0 },
  { id: 'a-level5', title: 'Laboratório Nível 5', description: 'Alcançou o nível 5', icon: 'star', check: (_c, lvl) => lvl >= 5, xp: 0 },
]

const XP_PER_ACTION: Record<GameAction, number> = {
  agentCreated: 120, workflowSaved: 80, workflowRun: 60, environmentVisited: 40, taskObserved: 5,
}

/** XP acumulado necessário para atingir o nível n (n >= 1). */
export const xpForLevel = (n: number) => Math.round(250 * Math.pow(n - 1, 1.6))
export function levelFromXp(xp: number) {
  let n = 1
  while (xp >= xpForLevel(n + 1)) n++
  return n
}

export interface XpEvent { id: number; label: string; xp: number; ts: string }

interface GameState {
  xp: number
  credits: number
  counters: Counters
  claimed: string[]
  history: XpEvent[]
  record: (action: GameAction, meta?: { rag?: boolean; envId?: string }) => void
  claimMission: (id: string) => boolean
  reset: () => void
}

const initialCounters: Counters = { agentsCreated: 0, ragAgentsCreated: 0, workflowsSaved: 0, workflowRuns: 0, tasksObserved: 0, environmentsVisited: [] }

const LABEL: Record<GameAction, string> = {
  agentCreated: 'Agente criado', workflowSaved: 'Workflow salvo', workflowRun: 'Simulação de workflow', environmentVisited: 'Ambiente visitado', taskObserved: 'Tarefa acompanhada (demo)',
}

let hid = 1
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      xp: 0,
      credits: 100,
      counters: initialCounters,
      claimed: [],
      history: [],
      record(action, meta) {
        const c = { ...get().counters, environmentsVisited: [...get().counters.environmentsVisited] }
        let xp = XP_PER_ACTION[action]
        switch (action) {
          case 'agentCreated':
            c.agentsCreated++
            if (meta?.rag) c.ragAgentsCreated++
            break
          case 'workflowSaved': c.workflowsSaved++; break
          case 'workflowRun': c.workflowRuns++; break
          case 'taskObserved': c.tasksObserved++; break
          case 'environmentVisited':
            if (!meta?.envId || c.environmentsVisited.includes(meta.envId)) xp = 0
            else c.environmentsVisited.push(meta.envId)
            break
        }
        const history = xp > 0 && action !== 'taskObserved'
          ? [{ id: hid++, label: LABEL[action], xp, ts: new Date().toISOString() }, ...get().history].slice(0, 30)
          : get().history
        set({ counters: c, xp: get().xp + xp, history })
      },
      claimMission(id) {
        const m = MISSIONS.find((x) => x.id === id)
        if (!m || get().claimed.includes(id) || m.progress(get().counters) < m.target) return false
        set({
          claimed: [...get().claimed, id],
          xp: get().xp + m.rewardXp,
          credits: get().credits + m.rewardCredits,
          history: [{ id: hid++, label: `Missão: ${m.title}`, xp: m.rewardXp, ts: new Date().toISOString() }, ...get().history].slice(0, 30),
        })
        return true
      },
      reset() {
        set({ xp: 0, credits: 100, counters: initialCounters, claimed: [], history: [] })
      },
    }),
    { name: 'agentslab:game:v1', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ xp: s.xp, credits: s.credits, counters: s.counters, claimed: s.claimed, history: s.history }) },
  ),
)

export function useLevel() {
  const xp = useGameStore((s) => s.xp)
  const level = levelFromXp(xp)
  const cur = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { xp, level, cur, next, pct: (xp - cur) / Math.max(1, next - cur) }
}
