import type { LabDataSource } from '../dataSource'
import type { Agent, AgentDraft, CredentialProfile, Provider, Workflow } from '@/types/domain'
import { DEMO_CREDENTIALS, DEMO_AGENTS, DEMO_PROVIDERS, DEMO_WORKFLOWS, ENVIRONMENTS, KNOWLEDGE_BASES, demoLogs, demoRuns } from './demoData'

/**
 * Implementação DEMONSTRATIVA: persiste no localStorage do navegador.
 * Nenhuma chamada de rede é feita. Todos os registros carregam origin: 'demo'.
 */
const KEY = 'agentslab:demo:v2'
const LEGACY_KEY = 'agentslab:demo:v1'

interface DemoDb {
  agents: Agent[]
  workflows: Workflow[]
  providers: Provider[]
  credentials: CredentialProfile[]
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function seedDb(): DemoDb {
  return { agents: clone(DEMO_AGENTS), workflows: clone(DEMO_WORKFLOWS), providers: clone(DEMO_PROVIDERS), credentials: clone(DEMO_CREDENTIALS) }
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

let memory: DemoDb | null = null

function load(): DemoDb {
  if (memory) return memory
  const s = storage()
  try {
    const raw = s?.getItem(KEY)
    const legacy = !raw ? s?.getItem(LEGACY_KEY) : null
    memory = raw ? (JSON.parse(raw) as DemoDb) : legacy ? migrateV1(JSON.parse(legacy) as DemoDb) : seedDb()
    memory.credentials ??= clone(DEMO_CREDENTIALS)
  } catch {
    memory = seedDb()
  }
  return memory
}

/** v1 → v2: Central de Orquestração virou "planejada"; estações agora são pontos do mapa. */
function migrateV1(old: DemoDb): DemoDb {
  const seed = seedDb()
  const agents = old.agents.map((a) => {
    const seeded = seed.agents.find((x) => x.id === a.id)
    const env = a.environmentId === 'research' ? 'research' : 'office'
    return { ...a, environmentId: seeded?.environmentId ?? env, stationId: seeded?.stationId ?? null, personality: a.personality ?? seeded?.personality } as Agent
  })
  for (const s of seed.agents) if (!agents.some((a) => a.id === s.id)) agents.push(s)
  return { ...seed, agents, workflows: old.workflows ?? seed.workflows, providers: old.providers ?? seed.providers }
}

function persist(db: DemoDb) {
  memory = db
  try {
    storage()?.setItem(KEY, JSON.stringify(db))
  } catch {
    /* armazenamento indisponível: mantém apenas em memória */
  }
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
const delay = <T,>(v: T, ms = 60) => new Promise<T>((res) => setTimeout(() => res(v), ms))

export function createDemoDataSource(): LabDataSource {
  return {
    kind: 'demo',
    async listAgents() {
      return delay(clone(load().agents))
    },
    async saveAgent(draft: AgentDraft) {
      const db = load()
      const now = new Date().toISOString()
      const existing = draft.id ? db.agents.find((a) => a.id === draft.id) : undefined
      const agent: Agent = existing
        ? { ...existing, ...draft, id: existing.id, updatedAt: now, version: bumpVersion(existing.version) }
        : {
            ...draft, id: uid('ag'), createdAt: now, updatedAt: now, version: '0.1.0', origin: 'demo',
            stats: { runs: 0, successRate: 0, tokens30d: 0, costUsd30d: 0, avgLatencySec: 0 },
          }
      const agents = existing ? db.agents.map((a) => (a.id === agent.id ? agent : a)) : [...db.agents, agent]
      persist({ ...db, agents })
      return delay(clone(agent))
    },
    async duplicateAgent(id) {
      const db = load()
      const src = db.agents.find((a) => a.id === id)
      if (!src) throw new Error('Agente não encontrado')
      const now = new Date().toISOString()
      const copy: Agent = { ...clone(src), id: uid('ag'), name: `${src.name} (cópia)`, stationId: null, createdAt: now, updatedAt: now, version: '0.1.0', stats: { runs: 0, successRate: 0, tokens30d: 0, costUsd30d: 0, avgLatencySec: 0 } }
      persist({ ...db, agents: [...db.agents, copy] })
      return delay(clone(copy))
    },
    async deleteAgent(id) {
      const db = load()
      persist({ ...db, agents: db.agents.filter((a) => a.id !== id) })
      return delay(undefined)
    },
    async listWorkflows() {
      return delay(clone(load().workflows))
    },
    async saveWorkflow(wf) {
      const db = load()
      const saved = { ...clone(wf), updatedAt: new Date().toISOString(), origin: 'demo' as const }
      const exists = db.workflows.some((w) => w.id === wf.id)
      persist({ ...db, workflows: exists ? db.workflows.map((w) => (w.id === wf.id ? saved : w)) : [...db.workflows, saved] })
      return delay(clone(saved))
    },
    async deleteWorkflow(id) {
      const db = load()
      persist({ ...db, workflows: db.workflows.filter((w) => w.id !== id) })
      return delay(undefined)
    },
    async listProviders() {
      return delay(clone(load().providers))
    },
    async updateProvider(id, patch) {
      const db = load()
      const providers = db.providers.map((p) => (p.id === id ? { ...p, ...patch } : p))
      persist({ ...db, providers })
      return delay(clone(providers.find((p) => p.id === id)!))
    },
    async listEnvironments() {
      return delay(clone(ENVIRONMENTS))
    },
    async listKnowledgeBases() {
      return delay(clone(KNOWLEDGE_BASES))
    },
    async listRuns() {
      return delay(demoRuns(40, 99))
    },
    async listLogs() {
      return delay(demoLogs())
    },
    async listCredentials() {
      return delay(clone(load().credentials))
    },
    async createCredential(input) {
      if (input.apiKey) {
        // segurança: no modo demo a chave NUNCA é armazenada no navegador
        throw new Error('Backend desconectado: chaves reais só podem ser salvas com o servidor local ativo.')
      }
      const db = load()
      const cred: CredentialProfile = { id: uid('cred'), provider: input.provider, alias: input.alias.trim(), last4: null, status: 'demo', createdAt: new Date().toISOString(), origin: 'demo' }
      persist({ ...db, credentials: [...db.credentials, cred] })
      return delay(clone(cred))
    },
    async deleteCredential(id) {
      const db = load()
      persist({ ...db, credentials: db.credentials.filter((c) => c.id !== id), agents: db.agents.map((a) => (a.intelligence.credentialId === id ? { ...a, intelligence: { ...a.intelligence, credentialId: null } } : a)) })
      return delay(undefined)
    },
    async reset() {
      memory = null
      try {
        storage()?.removeItem(KEY)
        storage()?.removeItem(LEGACY_KEY)
      } catch {
        /* ignora */
      }
      persist(seedDb())
    },
  }
}

function bumpVersion(v: string) {
  const [a, b, c] = v.split('.').map((n) => parseInt(n, 10) || 0)
  return `${a}.${b}.${c + 1}`
}

/** Utilitário para testes: limpa o cache em memória. */
export function __resetDemoMemory() {
  memory = null
}
