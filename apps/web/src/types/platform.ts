/**
 * Contratos da plataforma de organizações multiagentes (espelham apps/api/app/routers).
 * Todos os dados destes tipos vêm do backend real (origin: 'real').
 */
export interface Department { id: string; name: string; description: string }

export interface Organization {
  id: string
  name: string
  description: string
  template: string
  environmentId: string
  departments: Department[]
  agentIds: string[]
  createdAt: string
}

export interface OrgTemplate { id: string; name: string; environmentId: string; departments: string[]; roles: string[] }

export type ProjectStatus = 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'delivered' | 'revising' | 'completed' | 'failed' | 'cancelled'
export type TaskKind = 'research' | 'analysis' | 'writing' | 'review' | 'revision' | 'general'
export type TaskStatus = 'proposed' | 'pending' | 'running' | 'done' | 'failed' | 'cancelled'

export interface ProjectTask {
  id: string
  key: string
  title: string
  description: string
  kind: TaskKind
  agentId: string | null
  dependsOn: string[]
  deliverable: string
  status: TaskStatus
  step: string
  stepsDone: number
  stepsTotal: number
  resultArtifactId: string | null
  targetArtifactId: string | null
  error: string
  position: number
  startedAt: string | null
  finishedAt: string | null
}

export interface ProjectPlan {
  objetivo?: string
  escopo?: string
  subtemas?: string[]
  entregaveis?: string[]
  criterios_qualidade?: string[]
  estimativa_custo_usd?: number
  estimativa_e_aproximada?: boolean
  tarefa_avulsa?: boolean
}

export interface Approval { id: string; kind: 'plan' | 'delivery'; status: string; note: string; createdAt: string; decidedAt: string | null }

export interface Project {
  id: string
  organizationId: string | null
  title: string
  request: string
  status: ProjectStatus
  budgetUsd: number
  costUsd: number
  llmCalls: number
  error: string
  createdAt: string
  updatedAt: string
  tasksTotal: number
  tasksDone: number
  plan?: ProjectPlan
  tasks?: ProjectTask[]
  approvals?: Approval[]
}

export type MessageType = 'solicitacao' | 'resposta' | 'delegacao' | 'entrega' | 'revisao' | 'correcao' | 'aprovacao' | 'alerta' | 'discussao' | 'orientacao' | 'feedback'

export interface AgentMessage {
  id: string
  projectId: string | null
  taskId: string | null
  fromKind: 'agent' | 'user' | 'system'
  fromAgentId: string | null
  toKind: 'agent' | 'user' | 'system'
  toAgentId: string | null
  type: MessageType
  content: string
  artifactIds: string[]
  status: 'pending' | 'processed'
  createdAt: string
}

export interface ArtifactVersionMeta { version: number; agentId: string | null; note: string; createdAt: string; chars: number }
export interface Artifact {
  id: string
  title: string
  kind: 'findings' | 'analysis' | 'report' | 'review' | string
  agentId: string | null
  taskId: string | null
  currentVersion: number
  createdAt: string
  versions: ArtifactVersionMeta[]
}
export interface ArtifactContent { artifactId: string; version: number; content: string; note: string; agentId: string | null; createdAt: string }

export interface Evidence {
  id: string
  code: string
  source: string
  title: string
  authors: string
  year: number | null
  doi: string
  url: string
  abstract: string
  fullText: boolean
  query: string
  taskId: string | null
  agentId: string | null
  accessedAt: string
}

export interface Execution {
  id: string
  projectId: string | null
  taskId: string | null
  agentId: string | null
  purpose: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  costIsEstimate: boolean
  latencyMs: number
  status: 'ok' | 'error'
  error: string
  createdAt: string
}

export interface UsageRow { key: string | null; calls: number; inputTokens: number; outputTokens: number; costUsd: number }
export interface Usage { byAgent: UsageRow[]; byProject: UsageRow[]; byModel: UsageRow[]; byProvider: UsageRow[]; costIsEstimate: boolean }

export interface Overview {
  projects: Record<ProjectStatus, number>
  projectsTotal: number
  agentsTotal: number
  runningTasks: { id: string; title: string; agentId: string | null; projectId: string; step: string; stepsDone: number; stepsTotal: number }[]
  pendingApprovals: number
  costUsd: number
  llmCalls: number
  tokens: number
  errors: number
  credentials: number
}

/** Evento do backend (SSE). */
export interface PlatformEvent { id: number; type: string; projectId: string | null; payload: Record<string, unknown>; ts: string }
