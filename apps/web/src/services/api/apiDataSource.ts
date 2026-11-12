import type { LabDataSource } from '../dataSource'
import { NotAvailableError } from '../dataSource'
import type { Agent, CredentialProfile, DashboardData, EnvironmentInfo, ExecutionRun, KnowledgeBase, LogEntry, Provider, Workflow } from '@/types/domain'

/**
 * Implementação REAL (FastAPI). Preparada para a Fase 2: mesmas assinaturas do modo demo.
 * Endpoints documentados em docs/ARCHITECTURE.md e apps/api/app/routers.
 * Credenciais de LLM NUNCA trafegam pelo frontend — ficam no backend.
 */
export function createApiDataSource(baseUrl: string): LabDataSource {
  if (!baseUrl) {
    console.warn('[AgentsLab] VITE_API_BASE_URL vazio: chamadas reais falharão.')
  }
  async function http<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      credentials: 'include',
    })
    if (res.status === 501) throw new NotAvailableError(path)
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }
  return {
    kind: 'real',
    getDashboard: (period) => http<DashboardData>(`/dashboard?period=${period}`),
    listAgents: () => http<Agent[]>('/agents'),
    saveAgent: (draft) => (draft.id ? http<Agent>(`/agents/${draft.id}`, { method: 'PUT', body: JSON.stringify(draft) }) : http<Agent>('/agents', { method: 'POST', body: JSON.stringify(draft) })),
    duplicateAgent: (id) => http<Agent>(`/agents/${id}/duplicate`, { method: 'POST' }),
    deleteAgent: (id) => http<void>(`/agents/${id}`, { method: 'DELETE' }),
    listWorkflows: () => http<Workflow[]>('/workflows'),
    saveWorkflow: (wf) => http<Workflow>(`/workflows/${wf.id}`, { method: 'PUT', body: JSON.stringify(wf) }),
    deleteWorkflow: (id) => http<void>(`/workflows/${id}`, { method: 'DELETE' }),
    listProviders: () => http<Provider[]>('/providers'),
    updateProvider: (id, patch) => http<Provider>(`/providers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    listEnvironments: () => http<EnvironmentInfo[]>('/environments'),
    listKnowledgeBases: () => http<KnowledgeBase[]>('/knowledge-bases'),
    listRuns: () => http<ExecutionRun[]>('/runs'),
    listLogs: () => http<LogEntry[]>('/logs'),
    listCredentials: () => http<CredentialProfile[]>('/credentials'),
    createCredential: (input) => http<CredentialProfile>('/credentials', { method: 'POST', body: JSON.stringify({ provider: input.provider, alias: input.alias, api_key: input.apiKey }) }),
    deleteCredential: (id) => http<void>(`/credentials/${id}`, { method: 'DELETE' }),
    reset: async () => {
      throw new NotAvailableError('reset')
    },
  }
}
