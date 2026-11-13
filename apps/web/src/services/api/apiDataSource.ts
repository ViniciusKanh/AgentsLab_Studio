import type { LabDataSource } from '../dataSource'
import { NotAvailableError } from '../dataSource'
import type { Agent, CredentialProfile, EnvironmentInfo, ExecutionRun, KnowledgeBase, LogEntry, Provider, Workflow } from '@/types/domain'

/** Extrai a mensagem de erro do FastAPI ({detail}) para exibir ao usuário. */
export async function errorText(res: Response): Promise<string> {
  const raw = await res.text()
  try {
    const d = (JSON.parse(raw) as { detail?: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: { msg?: string }) => x.msg).join('; ')
  } catch { /* texto puro */ }
  return `Erro ${res.status}: ${raw.slice(0, 200)}`
}

/**
 * Implementação REAL (FastAPI local). Mesmas assinaturas do modo de exemplos.
 * Endpoints documentados em docs/ARCHITECTURE.md e apps/api/app/routers.
 * Credenciais de LLM NUNCA trafegam pelo frontend — ficam no backend.
 */
export function createApiDataSource(baseUrl: () => string): LabDataSource {
  async function http<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl()}/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    if (res.status === 501) throw new NotAvailableError(path)
    if (!res.ok) throw new Error(await errorText(res))
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }
  return {
    kind: 'real',
    listAgents: () => http<Agent[]>('/agents'),
    saveAgent: (draft) => (draft.id ? http<Agent>(`/agents/${draft.id}`, { method: 'PUT', body: JSON.stringify(draft) }) : http<Agent>('/agents', { method: 'POST', body: JSON.stringify(draft) })),
    duplicateAgent: async (id) => {
      const a = await http<Agent>(`/agents/${id}`)
      const { id: _i, createdAt: _c, updatedAt: _u, origin: _o, ...rest } = a
      return http<Agent>('/agents', { method: 'POST', body: JSON.stringify({ ...rest, name: `${a.name} (cópia)`.slice(0, 60), isCoordinator: false }) })
    },
    deleteAgent: (id) => http<void>(`/agents/${id}`, { method: 'DELETE' }),
    listWorkflows: () => http<Workflow[]>('/workflows'),
    saveWorkflow: (wf) => http<Workflow>(`/workflows/${wf.id}`, { method: 'PUT', body: JSON.stringify(wf) }),
    deleteWorkflow: (id) => http<void>(`/workflows/${id}`, { method: 'DELETE' }),
    listProviders: () => http<Provider[]>('/providers'),
    updateProvider: (id, patch) => http<Provider>(`/providers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    listEnvironments: async () => [] as EnvironmentInfo[],
    listKnowledgeBases: async () => [] as KnowledgeBase[],
    listRuns: async () => [] as ExecutionRun[],
    listLogs: async () => [] as LogEntry[],
    listCredentials: () => http<CredentialProfile[]>('/credentials'),
    createCredential: (input) => http<CredentialProfile>('/credentials', { method: 'POST', body: JSON.stringify({ provider: input.provider, alias: input.alias, api_key: input.apiKey ?? '' }) }),
    deleteCredential: (id) => http<void>(`/credentials/${id}`, { method: 'DELETE' }),
    reset: async () => {
      throw new NotAvailableError('reset')
    },
  }
}
