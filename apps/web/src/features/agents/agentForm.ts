import type { Agent, AgentDraft, ProviderId } from '@/types/domain'

export const ROLE_PRESETS = [
  'Analista de Dados', 'Pesquisador(a)', 'Redator(a) Técnico(a)', 'Revisor(a)', 'Code Agent', 'Especialista em Conhecimento',
  'Orquestrador(a) Multiagente', 'Planejador(a)', 'Analista de BI', 'Engenheiro(a) de Automação', 'Cientista de Avaliação', 'MLOps',
]

export const DEPARTMENTS = ['Dados & BI', 'Pesquisa', 'Conhecimento', 'Operações', 'Conteúdo', 'Desenvolvimento', 'Qualidade', 'Gestão', 'Orquestração']

export const ACCENTS = ['#00f5a0', '#39d6ff', '#9d62ff', '#ffb800', '#ff537a', '#e6ecff']

export const KNOWLEDGE_SOURCES = ['Base corporativa', 'Artigos científicos', 'Web', 'Documentação técnica', 'Tickets de suporte', 'Planilhas']

export function emptyDraft(defaults?: { name?: string; objective?: string; environmentId?: string }): AgentDraft {
  return {
    name: defaults?.name ?? '',
    role: 'Pesquisador(a)',
    department: 'Pesquisa',
    description: '',
    objective: defaults?.objective ?? '',
    appearance: { characterId: 'pesquisadora', accentColor: '#39d6ff' },
    environmentId: defaults?.environmentId === 'research' ? 'research' : 'office',
    stationId: null,
    intelligence: {
      provider: 'gemini', model: 'gemini-2.5-flash', behavior: 'analitico', temperature: 0.4, topP: 0.9, maxOutputTokens: 2048, credentialId: null,
      instructions: 'Você é um agente do AgentsLab_Studio. Responda em português do Brasil, cite fontes verificáveis e explique suas decisões.',
    },
    tools: ['web_search'],
    permissions: { readFiles: true, writeFiles: false, internet: true, externalApis: false, sensitiveRequiresApproval: true },
    integrations: [],
    knowledge: { sources: [], documents: [], memory: 'short', ragEnabled: false, ragBaseId: null },
    limits: { maxTokensPerRun: 8000, maxCostPerDayUsd: 1, timeoutSec: 120, maxRetries: 2 },
    rules: { autonomy: 'supervised', requireHumanReview: true, allowDelegation: false, restrictions: '' },
    tags: [],
    status: 'active',
  }
}

export function draftFromAgent(a: Agent): AgentDraft {
  const { createdAt: _c, updatedAt: _u, stats: _s, level: _l, xp: _x, version: _v, origin: _o, ...draft } = a
  void _c; void _u; void _s; void _l; void _x; void _v; void _o
  return JSON.parse(JSON.stringify(draft)) as AgentDraft
}

export type StepId = 'identidade' | 'inteligencia' | 'ferramentas' | 'conhecimento' | 'configuracao' | 'revisao'

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'inteligencia', label: 'Inteligência' },
  { id: 'ferramentas', label: 'Ferramentas' },
  { id: 'conhecimento', label: 'Conhecimento' },
  { id: 'configuracao', label: 'Configuração' },
  { id: 'revisao', label: 'Revisão' },
]

export type Errors = Partial<Record<string, string>>

/** Validação por etapa — retorna mensagens em português. */
export function validateStep(step: StepId, d: AgentDraft, providerModels: Record<ProviderId, string[]>): Errors {
  const e: Errors = {}
  if (step === 'identidade' || step === 'revisao') {
    if (d.name.trim().length < 3) e.name = 'Informe um nome com pelo menos 3 caracteres.'
    if (d.name.length > 60) e.name = 'Nome muito longo (máx. 60).'
    if (!d.role.trim()) e.role = 'Informe o papel/profissão.'
    if (d.objective.trim().length < 10) e.objective = 'Descreva o objetivo (mín. 10 caracteres).'
  }
  if (step === 'inteligencia' || step === 'revisao') {
    if (!providerModels[d.intelligence.provider]?.includes(d.intelligence.model)) e.model = 'Selecione um modelo do provedor escolhido.'
    if (d.intelligence.instructions.trim().length < 20) e.instructions = 'Instruções de sistema devem ter pelo menos 20 caracteres.'
    if (d.intelligence.temperature < 0 || d.intelligence.temperature > 2) e.temperature = 'Temperatura entre 0 e 2.'
    if (d.intelligence.maxOutputTokens < 64 || d.intelligence.maxOutputTokens > 32000) e.maxOutputTokens = 'Entre 64 e 32.000 tokens.'
  }
  if (step === 'ferramentas' || step === 'revisao') {
    if (d.permissions.writeFiles && !d.permissions.sensitiveRequiresApproval) e.permissions = 'Escrita de arquivos exige aprovação humana para operações sensíveis.'
  }
  if (step === 'conhecimento' || step === 'revisao') {
    if (d.knowledge.ragEnabled && !d.knowledge.ragBaseId) e.ragBaseId = 'Escolha a base RAG.'
  }
  if (step === 'configuracao' || step === 'revisao') {
    if (d.limits.maxTokensPerRun < 256) e.maxTokensPerRun = 'Mínimo de 256 tokens por execução.'
    if (d.limits.maxTokensPerRun < d.intelligence.maxOutputTokens) e.maxTokensPerRun = 'Deve ser ≥ ao máximo de tokens de saída.'
    if (d.limits.maxCostPerDayUsd < 0 || d.limits.maxCostPerDayUsd > 500) e.maxCostPerDayUsd = 'Entre US$ 0 e US$ 500.'
    if (d.limits.timeoutSec < 5 || d.limits.timeoutSec > 3600) e.timeoutSec = 'Entre 5 e 3.600 segundos.'
    if (d.limits.maxRetries < 0 || d.limits.maxRetries > 5) e.maxRetries = 'Entre 0 e 5 tentativas (evita loops).'
    if (d.rules.autonomy === 'autonomous' && !d.permissions.sensitiveRequiresApproval) e.autonomy = 'Modo autônomo exige aprovação para operações sensíveis.'
  }
  return e
}
