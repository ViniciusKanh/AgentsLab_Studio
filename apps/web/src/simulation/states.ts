import type { AgentRuntimeState } from '@/types/domain'

export const STATE_META: Record<AgentRuntimeState, { label: string; color: string; icon: number }> = {
  idle: { label: 'Ocioso', color: '#9aa6bf', icon: 7 },
  planning: { label: 'Planejando', color: '#39d6ff', icon: 1 },
  working: { label: 'Executando', color: '#00f5a0', icon: 0 },
  collaborating: { label: 'Colaborando', color: '#9d62ff', icon: 2 },
  reviewing: { label: 'Revisando', color: '#ffb800', icon: 3 },
  completed: { label: 'Concluído', color: '#00f5a0', icon: 4 },
  failed: { label: 'Falhou', color: '#ff537a', icon: 5 },
  paused: { label: 'Pausado', color: '#9aa6bf', icon: 6 },
}
