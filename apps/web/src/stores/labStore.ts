import { create } from 'zustand'
import type { Agent, AgentDraft, CredentialProfile, Provider, Workflow } from '@/types/domain'
import { dataSource } from '@/services'
import { useGameStore } from './gameStore'
import { useUiStore } from './uiStore'

/**
 * Estado compartilhado de entidades (agentes, workflows, provedores).
 * A persistência é delegada ao `dataSource` (demo: localStorage | real: FastAPI).
 */
interface LabState {
  loaded: boolean
  agents: Agent[]
  workflows: Workflow[]
  providers: Provider[]
  credentials: CredentialProfile[]
  createCredential: (input: { provider: CredentialProfile['provider']; alias: string; apiKey?: string }) => Promise<CredentialProfile | null>
  deleteCredential: (id: string) => Promise<void>
  load: () => Promise<void>
  saveAgent: (draft: AgentDraft) => Promise<Agent>
  duplicateAgent: (id: string) => Promise<Agent>
  deleteAgent: (id: string) => Promise<void>
  setAgentStatus: (id: string, status: Agent['status']) => Promise<void>
  saveWorkflow: (wf: Workflow) => Promise<Workflow>
  deleteWorkflow: (id: string) => Promise<void>
  updateProvider: (id: Provider['id'], patch: Partial<Pick<Provider, 'enabled' | 'defaultModel'>>) => Promise<void>
  resetDemo: () => Promise<void>
}

export const useLabStore = create<LabState>((set, get) => ({
  loaded: false,
  agents: [],
  workflows: [],
  providers: [],
  credentials: [],
  async load() {
    const [agents, workflows, providers] = await Promise.all([dataSource.listAgents(), dataSource.listWorkflows(), dataSource.listProviders()])
    const credentials = await dataSource.listCredentials().catch(() => [] as CredentialProfile[])
    set({ agents, workflows, providers, credentials, loaded: true })
  },
  async createCredential(input) {
    try {
      const c = await dataSource.createCredential(input)
      set({ credentials: [...get().credentials, c] })
      useUiStore.getState().toast(`Perfil de chave “${c.alias}” criado`, 'success')
      return c
    } catch (err) {
      useUiStore.getState().toast((err as Error).message, 'error')
      return null
    }
  },
  async deleteCredential(id) {
    await dataSource.deleteCredential(id)
    set({ credentials: get().credentials.filter((c) => c.id !== id), agents: get().agents.map((a) => (a.intelligence.credentialId === id ? { ...a, intelligence: { ...a.intelligence, credentialId: null } } : a)) })
  },
  async saveAgent(draft) {
    const isNew = !draft.id
    const saved = await dataSource.saveAgent(draft)
    set({ agents: isNew ? [...get().agents, saved] : get().agents.map((a) => (a.id === saved.id ? saved : a)) })
    if (isNew) useGameStore.getState().record('agentCreated', { rag: saved.knowledge.ragEnabled })
    useUiStore.getState().toast(isNew ? `Agente “${saved.name}” criado` : `Agente “${saved.name}” atualizado`, 'success')
    return saved
  },
  async duplicateAgent(id) {
    const copy = await dataSource.duplicateAgent(id)
    set({ agents: [...get().agents, copy] })
    useUiStore.getState().toast(`Agente duplicado: ${copy.name}`, 'success')
    return copy
  },
  async deleteAgent(id) {
    await dataSource.deleteAgent(id)
    set({ agents: get().agents.filter((a) => a.id !== id) })
    useUiStore.getState().toast('Agente excluído', 'info')
  },
  async setAgentStatus(id, status) {
    const a = get().agents.find((x) => x.id === id)
    if (!a) return
    const { createdAt: _c, updatedAt: _u, stats: _s, level: _l, xp: _x, version: _v, origin: _o, ...draft } = a
    void _c; void _u; void _s; void _l; void _x; void _v; void _o
    const saved = await dataSource.saveAgent({ ...draft, status })
    set({ agents: get().agents.map((x) => (x.id === id ? saved : x)) })
  },
  async saveWorkflow(wf) {
    const saved = await dataSource.saveWorkflow(wf)
    const exists = get().workflows.some((w) => w.id === wf.id)
    set({ workflows: exists ? get().workflows.map((w) => (w.id === saved.id ? saved : w)) : [...get().workflows, saved] })
    useGameStore.getState().record('workflowSaved')
    useUiStore.getState().toast(`Workflow “${saved.name}” salvo localmente`, 'success')
    return saved
  },
  async deleteWorkflow(id) {
    await dataSource.deleteWorkflow(id)
    set({ workflows: get().workflows.filter((w) => w.id !== id) })
  },
  async updateProvider(id, patch) {
    const p = await dataSource.updateProvider(id, patch)
    set({ providers: get().providers.map((x) => (x.id === id ? p : x)) })
  },
  async resetDemo() {
    await dataSource.reset()
    await get().load()
    useUiStore.getState().toast('Dados demonstrativos restaurados', 'info')
  },
}))
