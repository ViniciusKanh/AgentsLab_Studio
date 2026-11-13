import { create } from 'zustand'
import type { Agent, ChatMessage } from '@/types/domain'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'

/**
 * Conversa com um agente: chamada REAL ao modelo configurado (POST /agents/{id}/chat).
 * Sem backend conectado nenhuma resposta é gerada — o app avisa em vez de simular.
 */
interface ChatState {
  byAgent: Record<string, ChatMessage[]>
  pending: Record<string, boolean>
  send: (agent: Agent, text: string) => Promise<void>
}

const id = () => `msg-${Math.random().toString(36).slice(2, 9)}`

export const useChatStore = create<ChatState>((set, get) => ({
  byAgent: {},
  pending: {},
  async send(agent, text) {
    const push = (m: ChatMessage) => set({ byAgent: { ...get().byAgent, [agent.id]: [...(get().byAgent[agent.id] ?? []), m] } })
    const history = (get().byAgent[agent.id] ?? []).filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }))
    push({ id: id(), agentId: agent.id, role: 'user', text, ts: new Date().toISOString(), origin: appConfig.mode })
    if (appConfig.mode !== 'real') {
      push({ id: id(), agentId: agent.id, role: 'system', text: 'Backend desconectado: inicie o servidor local para conversar com o agente.', ts: new Date().toISOString(), origin: 'demo' })
      return
    }
    set({ pending: { ...get().pending, [agent.id]: true } })
    try {
      const r = await platform.chat(agent.id, text, history)
      push({ id: id(), agentId: agent.id, role: 'agent', text: r.reply, ts: new Date().toISOString(), origin: 'real' })
    } catch (err) {
      push({ id: id(), agentId: agent.id, role: 'system', text: (err as Error).message, ts: new Date().toISOString(), origin: 'real' })
    } finally {
      set({ pending: { ...get().pending, [agent.id]: false } })
    }
  },
}))
