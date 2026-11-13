import type {
  Agent, AgentDraft, CredentialProfile, EnvironmentInfo, ExecutionRun, KnowledgeBase, LogEntry, Provider, Workflow,
} from '@/types/domain'

/**
 * Contrato da camada de dados. As páginas dependem apenas desta interface;
 * o modo demonstrativo (localStorage) e o modo real (FastAPI) a implementam.
 */
export interface LabDataSource {
  readonly kind: 'demo' | 'real'
  listAgents(): Promise<Agent[]>
  saveAgent(draft: AgentDraft): Promise<Agent>
  duplicateAgent(id: string): Promise<Agent>
  deleteAgent(id: string): Promise<void>

  listWorkflows(): Promise<Workflow[]>
  saveWorkflow(wf: Workflow): Promise<Workflow>
  deleteWorkflow(id: string): Promise<void>

  listProviders(): Promise<Provider[]>
  updateProvider(id: Provider['id'], patch: Partial<Pick<Provider, 'enabled' | 'defaultModel'>>): Promise<Provider>

  listEnvironments(): Promise<EnvironmentInfo[]>
  listKnowledgeBases(): Promise<KnowledgeBase[]>
  listRuns(): Promise<ExecutionRun[]>
  listLogs(): Promise<LogEntry[]>

  listCredentials(): Promise<CredentialProfile[]>
  /** apiKey só é aceita no modo real (enviada ao backend, nunca persistida no navegador). */
  createCredential(input: { provider: CredentialProfile['provider']; alias: string; apiKey?: string }): Promise<CredentialProfile>
  deleteCredential(id: string): Promise<void>

  /** Remove dados locais e restaura o cenário de exemplo (somente demo). */
  reset(): Promise<void>
}

export class NotAvailableError extends Error {
  constructor(feature: string) {
    super(`${feature} não está disponível nesta versão.`)
    this.name = 'NotAvailableError'
  }
}
