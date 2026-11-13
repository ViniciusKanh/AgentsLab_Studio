/**
 * Contratos de dados do AgentsLab_Studio.
 *
 * Estes tipos são compartilhados pelo modo demonstrativo e pelo modo real.
 * O backend FastAPI (apps/api/app/schemas) espelha estes contratos em Pydantic.
 * Toda entidade carrega `origin` para diferenciar dados reais de fictícios.
 */

export type DataOrigin = 'demo' | 'real'

export type ProviderId = 'gemini' | 'groq' | 'openai' | 'huggingface' | 'ollama'

/** Estados mínimos de execução (CLAUDE.md §7). Derivados de eventos do backend. */
export type AgentRuntimeState =
  | 'idle'
  | 'planning'
  | 'working'
  | 'collaborating'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'paused'
  /** tem tarefa no projeto, mas aguarda uma dependência terminar */
  | 'waiting'

export type AgentStatus = 'active' | 'paused' | 'archived'
export type AutonomyLevel = 'manual' | 'supervised' | 'autonomous'
export type MemoryMode = 'none' | 'short' | 'long'
export type BehaviorProfile = 'analitico' | 'criativo' | 'preciso' | 'didatico' | 'executor'

export interface AgentAppearance {
  /** id do personagem na spritesheet (rooms.json → cast) */
  characterId: string
  accentColor: string
}

export interface AgentIntelligence {
  provider: ProviderId
  model: string
  instructions: string
  behavior: BehaviorProfile
  temperature: number
  topP: number
  maxOutputTokens: number
  /** Perfil de credencial (chave de API) usado por este agente. null = padrão do provedor. */
  credentialId?: string | null
}

export interface AgentPermissions {
  readFiles: boolean
  writeFiles: boolean
  internet: boolean
  externalApis: boolean
  /** Operações sensíveis/destrutivas sempre exigem aprovação humana. */
  sensitiveRequiresApproval: boolean
}

export interface AgentKnowledge {
  sources: string[]
  documents: string[]
  memory: MemoryMode
  ragEnabled: boolean
  ragBaseId: string | null
}

export interface AgentLimits {
  maxTokensPerRun: number
  maxCostPerDayUsd: number
  timeoutSec: number
  maxRetries: number
}

export interface AgentRules {
  autonomy: AutonomyLevel
  requireHumanReview: boolean
  allowDelegation: boolean
  restrictions: string
}

export interface AgentStats {
  runs: number
  successRate: number
  tokens30d: number
  costUsd30d: number
  avgLatencySec: number
}

export interface Agent {
  id: string
  name: string
  role: string
  department: string
  description: string
  objective: string
  appearance: AgentAppearance
  environmentId: string
  stationId: string | null
  intelligence: AgentIntelligence
  tools: string[]
  permissions: AgentPermissions
  integrations: string[]
  knowledge: AgentKnowledge
  limits: AgentLimits
  rules: AgentRules
  tags: string[]
  status: AgentStatus
  version: string
  /** Indicadores reais calculados das execuções (ausentes até haver uso). */
  stats?: AgentStats
  /** Organização à qual o agente pertence (modo conectado). */
  organizationId?: string | null
  /** Coordenador interpreta solicitações e distribui o trabalho. */
  isCoordinator?: boolean
  /** Personalidade: influencia o comportamento ambiental (e futuramente as instruções). */
  personality?: AgentPersonality
  createdAt: string
  updatedAt: string
  origin: DataOrigin
}

export interface AgentPersonality {
  sociability: number
  creativity: number
  organization: number
  curiosity: number
  collaboration: number
  initiative: number
  preference: 'individual' | 'duplas' | 'grupos'
}

/**
 * Perfil de credencial. O SEGREDO nunca fica no frontend: a chave é enviada uma única vez
 * ao backend local, que a guarda no cofre do sistema operacional e devolve só metadados.
 */
export interface CredentialProfile {
  id: string
  provider: ProviderId
  alias: string
  last4: string | null
  status: 'demo' | 'stored' | 'valid' | 'invalid'
  /** perfil padrão do provedor (usado por agentes sem perfil próprio) */
  isDefault?: boolean
  createdAt: string
  origin: DataOrigin
}

export interface Mission {
  id: string
  title: string
  description: string
  agentIds: string[]
  envId: string
  status: 'pendente' | 'em_execucao' | 'concluida' | 'falhou'
  taskIds: string[]
  createdAt: string
  finishedAt?: string
  origin: DataOrigin
}

export interface ChatMessage {
  id: string
  agentId: string
  role: 'user' | 'agent' | 'system'
  text: string
  ts: string
  origin: DataOrigin
}

export type AgentDraft = Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'stats' | 'version' | 'origin'> & {
  id?: string
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number | null
  /** USD por 1M tokens — valores ilustrativos no modo demo (sempre estimativa) */
  inputPer1M: number | null
  outputPer1M: number | null
  priceIsEstimate: boolean
  tags: string[]
}

export interface Provider {
  id: ProviderId
  name: string
  kind: 'cloud' | 'local'
  status: 'connected' | 'disconnected' | 'not_configured'
  badge: string
  enabled: boolean
  defaultModel: string
  models: ModelInfo[]
  usage: { tokensMonth: number; quotaMonth: number; costUsdMonth: number }
  /** última sincronização da lista de modelos com a API do provedor */
  modelsSyncedAt?: string | null
  origin: DataOrigin
}

export type RunStatus = 'ok' | 'warning' | 'error' | 'running' | 'queued'

export interface ExecutionRun {
  id: string
  agentId: string
  title: string
  project: string
  status: RunStatus
  startedAt: string
  durationMs: number
  tokens: number
  costUsd: number
  provider: ProviderId
  model: string
  origin: DataOrigin
}

export interface LogEntry {
  id: string
  ts: string
  level: 'info' | 'warn' | 'error' | 'debug'
  agentId: string | null
  message: string
  origin: DataOrigin
}

export interface Experiment {
  id: string
  name: string
  provider: ProviderId
  model: string
  metric: string
  value: number
  status: 'done' | 'running' | 'failed'
  date: string
  origin: DataOrigin
}

export type DashboardPeriod = '24h' | '7d' | '30d'

export interface Kpi {
  key: string
  label: string
  value: number
  format: 'int' | 'compact' | 'seconds' | 'percent' | 'currency'
  delta: number
  deltaUnit: '%' | 'pp' | 'abs'
  /** true quando queda é boa (ex.: latência) */
  invert?: boolean
}

export interface TokenPoint {
  label: string
  gemini: number
  groq: number
  openai: number
  huggingface: number
}

export interface DashboardData {
  period: DashboardPeriod
  kpis: Kpi[]
  tokenSeries: TokenPoint[]
  topAgents: { agentId: string; runs: number }[]
  recentRuns: ExecutionRun[]
  experiments: Experiment[]
  logs: LogEntry[]
  counters: { projects: number; workflows: number; ragBases: number; integrations: number }
  origin: DataOrigin
}

// ---------------------------------------------------------------------------
// Ambientes
// ---------------------------------------------------------------------------
export interface EnvironmentInfo {
  id: string
  name: string
  description: string
  thumbnail: string
  /** implementado = navegável no motor Phaser; planned = apenas planejamento */
  availability: 'implemented' | 'planned'
  accent: string
  unlockLevel: number
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------
export type WorkflowNodeKind = 'start' | 'agent' | 'tool' | 'condition' | 'review' | 'output'

export interface WorkflowNodeData {
  label: string
  kind: WorkflowNodeKind
  agentId?: string
  tool?: string
  condition?: string
  reviewer?: 'humano' | 'agente'
  outputFormat?: string
  notes?: string
  /** estado durante simulação demonstrativa */
  runState?: 'idle' | 'running' | 'done' | 'failed'
  [key: string]: unknown
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeKind
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  updatedAt: string
  origin: DataOrigin
}

// ---------------------------------------------------------------------------
// Tarefas e eventos de simulação (contrato com o backend em tempo real)
// ---------------------------------------------------------------------------
export interface Task {
  id: string
  title: string
  agentId: string
  workflowId?: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: number
  createdAt: string
  result?: string
  origin: DataOrigin
}

export type SimulationEvent =
  | { type: 'agent.state'; agentId: string; state: AgentRuntimeState; taskId?: string; taskTitle?: string; taskKind?: string; projectId?: string; partnerId?: string; ts: string; origin: DataOrigin }
  | { type: 'task.progress'; agentId: string; taskId: string; progress: number; tokens: number; ts: string; origin: DataOrigin }
  | { type: 'task.finished'; agentId: string; taskId: string; status: 'done' | 'failed'; tokens: number; costUsd: number; durationMs: number; result: string; ts: string; origin: DataOrigin }
  | { type: 'log'; entry: LogEntry; ts: string; origin: DataOrigin }

export interface AgentRuntime {
  agentId: string
  state: AgentRuntimeState
  taskId: string | null
  taskTitle: string | null
  /** tipo da tarefa real (research, analysis, writing, review, revision...) */
  taskKind?: string | null
  projectId?: string | null
  progress: number
  partnerId: string | null
  since: string
  tokensSession: number
  /** etapa real informada pelo backend (sem porcentagens arbitrárias) */
  step?: string
  stepsDone?: number
  stepsTotal?: number
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------
export interface KnowledgeBase {
  id: string
  name: string
  kind: 'documentos' | 'web' | 'banco' | 'api'
  documents: number
  chunks: number
  embeddingModel: string
  updatedAt: string
  status: 'indexado' | 'indexando' | 'planejado'
  origin: DataOrigin
}
