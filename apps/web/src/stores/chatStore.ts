import { create } from 'zustand'
import type { Agent, ChatMessage } from '@/types/domain'
import { appConfig } from '@/services/config'
import { useSimulationStore } from './simulationStore'
import { STATE_META } from '@/simulation/states'

/**
 * Conversa com um agente. No modo demo as respostas são MODELOS LOCAIS
 * (sem LLM) e vêm marcadas como demonstrativas. No modo real: POST /agents/{id}/chat (Fase 3).
 */
interface ChatState {
  byAgent: Record<string, ChatMessage[]>
  send: (agent: Agent, text: string) => void
}

const id = () => `msg-${Math.random().toString(36).slice(2, 9)}`

function demoReply(agent: Agent, text: string): string {
  const rt = useSimulationStore.getState().runtime[agent.id]
  const st = STATE_META[rt?.state ?? 'idle'].label.toLowerCase()
  const t = text.toLowerCase()
  if (/status|fazendo|tarefa|andamento/.test(t)) {
    return rt?.taskTitle ? `Estou ${st} em “${rt.taskTitle}” (${Math.round((rt.progress ?? 0) * 100)}%).` : `No momento estou ${st}, sem tarefa atribuída.`
  }
  if (/resultado|entrega|relat/.test(t)) return 'Ainda não tenho resultados reais: no modo demonstrativo eu não executo modelos de IA.'
  if (/quem|papel|faz\b|função/.test(t)) return `Sou ${agent.name}, ${agent.role} (${agent.department}). Objetivo: ${agent.objective}`
  return `Entendido! Quando o backend estiver conectado vou responder usando ${agent.intelligence.model}. Por enquanto esta é uma resposta de demonstração.`
}

export const useChatStore = create<ChatState>((set, get) => ({
  byAgent: {},
  send(agent, text) {
    const now = new Date().toISOString()
    const msgs = [...(get().byAgent[agent.id] ?? []), { id: id(), agentId: agent.id, role: 'user', text, ts: now, origin: appConfig.mode } as ChatMessage]
    set({ byAgent: { ...get().byAgent, [agent.id]: msgs } })
    if (appConfig.mode === 'real') {
      const sys: ChatMessage = { id: id(), agentId: agent.id, role: 'system', text: 'Chat real ainda não disponível no backend (Fase 3).', ts: now, origin: 'real' }
      set({ byAgent: { ...get().byAgent, [agent.id]: [...msgs, sys] } })
      return
    }
    setTimeout(() => {
      const reply: ChatMessage = { id: id(), agentId: agent.id, role: 'agent', text: demoReply(agent, text), ts: new Date().toISOString(), origin: 'demo' }
      set({ byAgent: { ...get().byAgent, [agent.id]: [...(get().byAgent[agent.id] ?? []), reply] } })
    }, 650)
  },
}))
