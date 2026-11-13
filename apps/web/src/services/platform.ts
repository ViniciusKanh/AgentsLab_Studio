import type {
  AgentMessage, Artifact, ArtifactContent, Evidence, Execution, Organization, OrgTemplate, Overview, Project, ProjectTask, Usage,
} from '@/types/platform'
import { apiBase } from './backend'
import { errorText } from './api/apiDataSource'

/** Cliente da API da plataforma (somente com backend conectado). */
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api/v1${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!res.ok) throw new Error(await errorText(res))
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
const post = <T>(path: string, body?: unknown) => http<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
const put = <T>(path: string, body: unknown) => http<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export const platform = {
  overview: () => http<Overview>('/overview'),
  organizations: () => http<Organization[]>('/organizations'),
  templates: () => http<OrgTemplate[]>('/organization-templates'),
  createOrganization: (b: { name: string; description?: string; template: string; departments?: string[] }) => post<Organization>('/organizations', b),
  deleteOrganization: (id: string) => http<void>(`/organizations/${id}`, { method: 'DELETE' }),
  addDepartment: (orgId: string, name: string) => post(`/organizations/${orgId}/departments`, { name }),
  deleteDepartment: (orgId: string, depId: string) => http<void>(`/organizations/${orgId}/departments/${depId}`, { method: 'DELETE' }),

  projects: (organizationId?: string) => http<Project[]>(`/projects${organizationId ? `?organizationId=${organizationId}` : ''}`),
  project: (id: string) => http<Project>(`/projects/${id}`),
  createProject: (b: { request: string; title?: string; organizationId: string | null; budgetUsd?: number }) => post<Project>('/projects', b),
  editPlan: (id: string, tasks: Partial<ProjectTask>[]) => put<Project>(`/projects/${id}/plan`, { tasks }),
  decidePlan: (id: string, approve: boolean, note = '') => post<Project>(`/projects/${id}/plan/decision`, { approve, note }),
  decideDelivery: (id: string, approve: boolean, note = '') => post<Project>(`/projects/${id}/delivery/decision`, { approve, note }),
  control: (id: string, action: 'pause' | 'resume' | 'cancel') => post<Project>(`/projects/${id}/control`, { action }),
  setBudget: (id: string, budgetUsd: number) => put<Project>(`/projects/${id}/budget`, { budgetUsd }),
  feedback: (id: string, artifactId: string, text: string, agentId?: string) => post<Project>(`/projects/${id}/feedback`, { artifactId, text, agentId }),
  guidance: (id: string, agentId: string, text: string) => post(`/projects/${id}/guidance`, { agentId, text }),
  messages: (id: string) => http<AgentMessage[]>(`/projects/${id}/messages`),
  artifacts: (id: string) => http<Artifact[]>(`/projects/${id}/artifacts`),
  artifact: (id: string, artifactId: string, version?: number) => http<ArtifactContent>(`/projects/${id}/artifacts/${artifactId}${version ? `?version=${version}` : ''}`),
  diff: (id: string, artifactId: string, a: number, b: number) => http<{ diff: string }>(`/projects/${id}/artifacts/${artifactId}/diff?a=${a}&b=${b}`),
  downloadUrl: (id: string, artifactId: string, version?: number) => `${apiBase()}/api/v1/projects/${id}/artifacts/${artifactId}/download${version ? `?version=${version}` : ''}`,
  evidence: (id: string) => http<Evidence[]>(`/projects/${id}/evidence`),
  executions: (id: string) => http<Execution[]>(`/projects/${id}/executions`),

  allExecutions: (limit = 200) => http<Execution[]>(`/executions?limit=${limit}`),
  recentMessages: (limit = 60) => http<AgentMessage[]>(`/messages?limit=${limit}`),
  usage: () => http<Usage>('/usage'),
  chat: (agentId: string, text: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
    post<{ reply: string; tokens: number; costUsd: number }>(`/agents/${agentId}/chat`, { text, history }),
  assignTask: (agentId: string, b: { title: string; description: string; kind?: string }) => post<{ projectId: string }>(`/agents/${agentId}/tasks`, b),
  vault: () => http<{ available: boolean; backend: string | null; kind: string | null; error?: string }>('/credentials/vault'),
  setDefaultCredential: (id: string) => post(`/credentials/${id}/default`),
}

export const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planejando', color: '#39d6ff' },
  awaiting_approval: { label: 'Aguardando aprovação', color: '#ffb800' },
  running: { label: 'Em execução', color: '#00f5a0' },
  paused: { label: 'Pausado', color: '#ffb800' },
  delivered: { label: 'Entregue — avaliar', color: '#9d62ff' },
  revising: { label: 'Em revisão', color: '#39d6ff' },
  completed: { label: 'Concluído', color: '#00f5a0' },
  failed: { label: 'Falhou', color: '#ff537a' },
  cancelled: { label: 'Cancelado', color: '#8a93b0' },
}

export const TASK_KIND: Record<string, string> = {
  research: 'Pesquisa', analysis: 'Análise', writing: 'Redação', review: 'Revisão', revision: 'Revisão de versão', general: 'Geral',
}

export const MESSAGE_TYPE: Record<string, { label: string; color: string }> = {
  solicitacao: { label: 'Solicitação', color: '#39d6ff' }, resposta: { label: 'Resposta', color: '#e9ecf5' }, delegacao: { label: 'Delegação', color: '#9d62ff' },
  entrega: { label: 'Entrega', color: '#00f5a0' }, revisao: { label: 'Revisão', color: '#ffb800' }, correcao: { label: 'Correção', color: '#ffb800' },
  aprovacao: { label: 'Aprovação', color: '#00f5a0' }, alerta: { label: 'Alerta', color: '#ff537a' }, discussao: { label: 'Discussão', color: '#39d6ff' },
  orientacao: { label: 'Orientação', color: '#9d62ff' }, feedback: { label: 'Feedback', color: '#ff537a' },
}
