/**
 * Dados DEMONSTRATIVOS (fictícios).
 * Nenhum número aqui representa consumo, custo ou execução real.
 * Todas as entidades são marcadas com origin: 'demo'.
 */
import type {
  Agent, CredentialProfile, DashboardData, DashboardPeriod, EnvironmentInfo, ExecutionRun, Experiment, KnowledgeBase,
  LogEntry, Provider, ProviderId, TokenPoint, Workflow,
} from '@/types/domain'

const NOW = () => new Date()
const iso = (msAgo: number) => new Date(NOW().getTime() - msAgo).toISOString()

/** PRNG determinístico (mulberry32) — gera séries estáveis entre recargas. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const baseAgent = (p: Partial<Agent> & Pick<Agent, 'id' | 'name' | 'role' | 'department' | 'description'>): Agent => ({
  objective: p.description,
  appearance: { characterId: 'analista', accentColor: '#00f5a0' },
  environmentId: 'office',
  stationId: null,
  intelligence: {
    provider: 'gemini', model: 'gemini-2.5-pro', behavior: 'analitico', temperature: 0.4, topP: 0.9, maxOutputTokens: 2048,
    instructions: 'Você é um agente do AgentsLab_Studio. Responda em português do Brasil, cite fontes e explique decisões.',
  },
  tools: [],
  permissions: { readFiles: true, writeFiles: false, internet: false, externalApis: false, sensitiveRequiresApproval: true },
  integrations: [],
  knowledge: { sources: [], documents: [], memory: 'short', ragEnabled: false, ragBaseId: null },
  limits: { maxTokensPerRun: 8000, maxCostPerDayUsd: 2, timeoutSec: 120, maxRetries: 2 },
  rules: { autonomy: 'supervised', requireHumanReview: false, allowDelegation: true, restrictions: '' },
  tags: [],
  status: 'active',
  version: '1.0.0',
  stats: { runs: 0, successRate: 0.95, tokens30d: 0, costUsd30d: 0, avgLatencySec: 5 },
  createdAt: iso(1000 * 60 * 60 * 24 * 40),
  updatedAt: iso(1000 * 60 * 60 * 5),
  origin: 'demo',
  ...p,
})

export const DEMO_AGENTS: Agent[] = [
  baseAgent({
    id: 'ag-analista', name: 'Analista de Dados', role: 'Analista de Dados', department: 'Dados & BI',
    description: 'Analisa dados, gera insights e relatórios.', appearance: { characterId: 'analista', accentColor: '#00f5a0' },
    environmentId: 'office', stationId: 'office-w_dados1', personality: { sociability: 40, creativity: 50, organization: 85, curiosity: 60, collaboration: 55, initiative: 70, preference: 'individual' }, tags: ['Dados', 'BI', 'SQL'], tools: ['sql', 'python', 'powerbi'],
    intelligence: { provider: 'gemini', model: 'gemini-2.5-pro', behavior: 'analitico', temperature: 0.3, topP: 0.9, maxOutputTokens: 4096, instructions: 'Analise bases de dados, valide hipóteses com SQL e entregue insights acionáveis em português.', credentialId: 'cred-gemini-2' },
    stats: { runs: 432, successRate: 0.982, tokens30d: 12_400_000, costUsd30d: 1.28, avgLatencySec: 6.1 },
  }),
  baseAgent({
    id: 'ag-pesquisa', name: 'Assistente de Pesquisa', role: 'Pesquisador(a)', department: 'Pesquisa',
    description: 'Busca, lê e resume documentos.', appearance: { characterId: 'pesquisadora', accentColor: '#39d6ff' },
    environmentId: 'research', stationId: 'research-w_lab1', personality: { sociability: 55, creativity: 70, organization: 50, curiosity: 90, collaboration: 60, initiative: 55, preference: 'duplas' }, tags: ['RAG', 'PDF', 'Web'], tools: ['web_search', 'pdf_reader'],
    intelligence: { provider: 'groq', model: 'llama-3.3-70b-versatile', behavior: 'didatico', temperature: 0.5, topP: 0.9, maxOutputTokens: 4096, instructions: 'Pesquise fontes verificáveis, resuma artigos e registre referências.', credentialId: 'cred-groq-1' },
    knowledge: { sources: ['Artigos científicos', 'Web'], documents: ['survey-llm-agents.pdf'], memory: 'long', ragEnabled: true, ragBaseId: 'kb-unesp' },
    stats: { runs: 281, successRate: 0.964, tokens30d: 5_100_000, costUsd30d: 0.62, avgLatencySec: 3.2 },
  }),
  baseAgent({
    id: 'ag-rag', name: 'RAG Corporativo', role: 'Especialista em Conhecimento', department: 'Conhecimento',
    description: 'Responde com base nos seus documentos.', appearance: { characterId: 'rag', accentColor: '#e9ecf5' },
    environmentId: 'research', stationId: 'research-w_banc1', personality: { sociability: 30, creativity: 45, organization: 75, curiosity: 70, collaboration: 50, initiative: 50, preference: 'individual' }, tags: ['RAG', 'Docs', 'Embeddings'], tools: ['retriever'],
    knowledge: { sources: ['Base corporativa'], documents: ['manual-bi.pdf', 'politicas.docx'], memory: 'long', ragEnabled: true, ragBaseId: 'kb-dw' },
    stats: { runs: 196, successRate: 0.97, tokens30d: 3_900_000, costUsd30d: 0.71, avgLatencySec: 4.4 },
  }),
  baseAgent({
    id: 'ag-automacao', name: 'Automação de Tarefas', role: 'Engenheiro(a) de Automação', department: 'Operações',
    description: 'Executa rotinas e integra ferramentas.', appearance: { characterId: 'ops', accentColor: '#39d6ff' },
    environmentId: 'office', stationId: 'office-w_auto', personality: { sociability: 35, creativity: 30, organization: 80, curiosity: 60, collaboration: 50, initiative: 90, preference: 'individual' }, tags: ['API', 'n8n', 'Agenda'], tools: ['http', 'scheduler'],
    intelligence: { provider: 'ollama', model: 'llama3.2:3b', behavior: 'executor', temperature: 0.2, topP: 0.8, maxOutputTokens: 1024, instructions: 'Execute rotinas agendadas e reporte falhas com contexto.' },
    stats: { runs: 154, successRate: 0.94, tokens30d: 900_000, costUsd30d: 0, avgLatencySec: 7.9 },
  }),
  baseAgent({
    id: 'ag-relatorios', name: 'Gerador de Relatórios', role: 'Redator(a) Técnico(a)', department: 'Conteúdo',
    description: 'Produz relatórios e resumos executivos.', appearance: { characterId: 'redatora', accentColor: '#ff537a' },
    environmentId: 'office', stationId: 'office-w_mesa1', personality: { sociability: 80, creativity: 85, organization: 55, curiosity: 55, collaboration: 70, initiative: 60, preference: 'grupos' }, tags: ['Docs', 'Resumo', 'PDF'], tools: ['docx', 'pdf_writer'],
    intelligence: { provider: 'openai', model: 'gpt-4.1-mini', behavior: 'criativo', temperature: 0.7, topP: 0.95, maxOutputTokens: 4096, instructions: 'Escreva relatórios claros, estruturados e com resumo executivo.' },
    stats: { runs: 122, successRate: 0.99, tokens30d: 2_300_000, costUsd30d: 0.94, avgLatencySec: 8.1 },
  }),
  baseAgent({
    id: 'ag-codigo', name: 'Engenheiro de Código', role: 'Code Agent', department: 'Desenvolvimento',
    description: 'Escreve, refatora e testa código.', appearance: { characterId: 'engenheiro', accentColor: '#9d62ff' },
    environmentId: 'office', stationId: 'office-w_dev1', personality: { sociability: 35, creativity: 70, organization: 65, curiosity: 60, collaboration: 45, initiative: 80, preference: 'individual' }, tags: ['Python', 'TS', 'Testes'], tools: ['python', 'git_read'],
    intelligence: { provider: 'openai', model: 'gpt-4.1', behavior: 'preciso', temperature: 0.2, topP: 0.9, maxOutputTokens: 8192, instructions: 'Produza código tipado, testado e documentado em português.' },
    rules: { autonomy: 'supervised', requireHumanReview: true, allowDelegation: false, restrictions: 'Sem push remoto.' },
    stats: { runs: 98, successRate: 0.93, tokens30d: 4_200_000, costUsd30d: 1.66, avgLatencySec: 9.4 },
  }),
  baseAgent({
    id: 'ag-revisor', name: 'Revisor de Qualidade', role: 'Revisor(a)', department: 'Qualidade',
    description: 'Revisa entregas e aplica critérios de aprovação.', appearance: { characterId: 'revisor', accentColor: '#ffb800' },
    environmentId: 'office', stationId: 'office-w_mesa2', personality: { sociability: 50, creativity: 40, organization: 90, curiosity: 45, collaboration: 75, initiative: 55, preference: 'duplas' }, tags: ['Qualidade', 'Revisão'], tools: ['rubric'],
    stats: { runs: 87, successRate: 0.99, tokens30d: 1_400_000, costUsd30d: 0.33, avgLatencySec: 4.2 },
  }),
  baseAgent({
    id: 'ag-bi', name: 'BI & Insights', role: 'Analista de BI', department: 'Dados & BI',
    description: 'Monitora KPIs e sugere ações de negócio.', appearance: { characterId: 'bi', accentColor: '#00f5a0' },
    environmentId: 'office', stationId: 'office-w_dados2', personality: { sociability: 55, creativity: 55, organization: 75, curiosity: 65, collaboration: 60, initiative: 65, preference: 'duplas' }, tags: ['KPIs', 'Power BI', 'DAX'], tools: ['powerbi', 'sql'],
    stats: { runs: 143, successRate: 0.97, tokens30d: 2_800_000, costUsd30d: 0.51, avgLatencySec: 5.5 },
  }),
  baseAgent({
    id: 'ag-planejador', name: 'Planejador de Tarefas', role: 'Planejador(a)', department: 'Gestão',
    description: 'Organiza agenda, projetos e prioridades.', appearance: { characterId: 'planejador', accentColor: '#39d6ff' },
    environmentId: 'office', stationId: 'office-w_mesa0', personality: { sociability: 80, creativity: 55, organization: 80, curiosity: 50, collaboration: 85, initiative: 70, preference: 'grupos' }, tags: ['Agenda', 'Projetos', 'API'], tools: ['calendar', 'http'],
    intelligence: { provider: 'groq', model: 'llama-3.1-8b-instant', behavior: 'executor', temperature: 0.3, topP: 0.9, maxOutputTokens: 2048, instructions: 'Quebre objetivos em tarefas com responsáveis, prazos e dependências.' },
    stats: { runs: 76, successRate: 0.96, tokens30d: 700_000, costUsd30d: 0.08, avgLatencySec: 2.1 },
  }),
  baseAgent({
    id: 'ag-orquestradora', name: 'Orquestradora', role: 'Orquestrador(a) Multiagente', department: 'Orquestração',
    description: 'Distribui tarefas e coordena workflows.', appearance: { characterId: 'orquestradora', accentColor: '#ffb800' },
    environmentId: 'office', stationId: 'office-w_mesa3', personality: { sociability: 75, creativity: 60, organization: 80, curiosity: 55, collaboration: 95, initiative: 85, preference: 'grupos' }, tags: ['LangGraph', 'Workflows'], tools: ['delegate', 'queue'],
    rules: { autonomy: 'supervised', requireHumanReview: true, allowDelegation: true, restrictions: 'Limite de 5 delegações por execução.' },
    stats: { runs: 211, successRate: 0.965, tokens30d: 3_300_000, costUsd30d: 0.88, avgLatencySec: 6.7 },
  }),
  baseAgent({
    id: 'ag-avaliadora', name: 'Avaliadora de Modelos', role: 'Cientista de Avaliação', department: 'Pesquisa',
    description: 'Compara modelos e estratégias com benchmarks.', appearance: { characterId: 'assistente', accentColor: '#ff537a' },
    environmentId: 'research', stationId: 'research-w_lab3', personality: { sociability: 60, creativity: 55, organization: 70, curiosity: 85, collaboration: 65, initiative: 60, preference: 'duplas' }, tags: ['Benchmark', 'F1', 'ROUGE'], tools: ['python', 'eval'],
    intelligence: { provider: 'huggingface', model: 'meta-llama/Llama-3.1-8B-Instruct', behavior: 'analitico', temperature: 0.1, topP: 0.9, maxOutputTokens: 2048, instructions: 'Execute benchmarks reprodutíveis e registre métricas com intervalos de confiança.' },
    stats: { runs: 64, successRate: 0.95, tokens30d: 1_100_000, costUsd30d: 0.12, avgLatencySec: 11.2 },
  }),
  baseAgent({
    id: 'ag-experimentos', name: 'Engenheiro de Experimentos', role: 'MLOps', department: 'Pesquisa',
    description: 'Prepara datasets, prompts e execuções de teste.', appearance: { characterId: 'devops', accentColor: '#00f5a0' },
    environmentId: 'research', stationId: 'research-w_lab2', personality: { sociability: 45, creativity: 65, organization: 60, curiosity: 80, collaboration: 55, initiative: 65, preference: 'duplas' }, tags: ['MLOps', 'Datasets'], tools: ['python', 'storage'],
    status: 'paused',
    stats: { runs: 41, successRate: 0.9, tokens30d: 600_000, costUsd30d: 0.07, avgLatencySec: 8.8 },
  }),
]

DEMO_AGENTS.push(baseAgent({
  id: 'ag-robo-lab', name: 'Assistente de Laboratório', role: 'Robô de Suporte', department: 'Operações',
  description: 'Organiza amostras e monitora equipamentos.', appearance: { characterId: 'robo2', accentColor: '#ff537a' },
  environmentId: 'research', stationId: 'research-w_banc2', tags: ['Suporte', 'Monitoramento'], tools: ['scheduler'],
  personality: { sociability: 60, creativity: 30, organization: 85, curiosity: 75, collaboration: 70, initiative: 90, preference: 'duplas' },
  intelligence: { provider: 'ollama', model: 'llama3.2:3b', behavior: 'executor', temperature: 0.2, topP: 0.8, maxOutputTokens: 1024, instructions: 'Monitore equipamentos e reporte anomalias com contexto e horário.' },
  stats: { runs: 58, successRate: 0.97, tokens30d: 300_000, costUsd30d: 0, avgLatencySec: 3.1 },
}))

/** Perfis de credencial DEMONSTRATIVOS (sem chave). Ex.: duas chaves Gemini para dividir cota. */
export const DEMO_CREDENTIALS: CredentialProfile[] = [
  { id: 'cred-gemini-1', provider: 'gemini', alias: 'Gemini · chave 1 (pesquisa)', last4: null, status: 'demo', createdAt: iso(864e5 * 9), origin: 'demo' },
  { id: 'cred-gemini-2', provider: 'gemini', alias: 'Gemini · chave 2 (BI)', last4: null, status: 'demo', createdAt: iso(864e5 * 4), origin: 'demo' },
  { id: 'cred-groq-1', provider: 'groq', alias: 'Groq · principal', last4: null, status: 'demo', createdAt: iso(864e5 * 6), origin: 'demo' },
]

export const DEMO_PROVIDERS: Provider[] = [
  {
    id: 'gemini', name: 'Gemini', kind: 'cloud', status: 'connected', badge: 'Padrão', enabled: true, defaultModel: 'gemini-2.5-pro', origin: 'demo',
    usage: { tokensMonth: 1_240_000, quotaMonth: 2_000_000, costUsdMonth: 2.07 },
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1_000_000, inputPer1M: 1.25, outputPer1M: 10, priceIsEstimate: true, tags: ['raciocínio', 'multimodal'] },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1_000_000, inputPer1M: 0.3, outputPer1M: 2.5, priceIsEstimate: true, tags: ['rápido', 'custo'] },
    ],
  },
  {
    id: 'groq', name: 'Groq', kind: 'cloud', status: 'connected', badge: 'Rápido', enabled: true, defaultModel: 'llama-3.3-70b-versatile', origin: 'demo',
    usage: { tokensMonth: 580_000, quotaMonth: 1_000_000, costUsdMonth: 0.84 },
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128_000, inputPer1M: 0.59, outputPer1M: 0.79, priceIsEstimate: true, tags: ['baixa latência'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128_000, inputPer1M: 0.05, outputPer1M: 0.08, priceIsEstimate: true, tags: ['econômico'] },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', kind: 'cloud', status: 'connected', badge: 'Alta Qualidade', enabled: true, defaultModel: 'gpt-4.1', origin: 'demo',
    usage: { tokensMonth: 2_840_000, quotaMonth: 5_000_000, costUsdMonth: 1.02 },
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1_000_000, inputPer1M: 2, outputPer1M: 8, priceIsEstimate: true, tags: ['código', 'qualidade'] },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', contextWindow: 1_000_000, inputPer1M: 0.4, outputPer1M: 1.6, priceIsEstimate: true, tags: ['custo'] },
    ],
  },
  {
    id: 'huggingface', name: 'Hugging Face', kind: 'cloud', status: 'connected', badge: 'Modelos Abertos', enabled: true, defaultModel: 'meta-llama/Llama-3.1-8B-Instruct', origin: 'demo',
    usage: { tokensMonth: 320_000, quotaMonth: 1_000_000, costUsdMonth: 0.18 },
    models: [
      { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct', contextWindow: 128_000, inputPer1M: null, outputPer1M: null, priceIsEstimate: true, tags: ['open-weights'] },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B Instruct', contextWindow: 32_000, inputPer1M: null, outputPer1M: null, priceIsEstimate: true, tags: ['open-weights', 'multilíngue'] },
    ],
  },
  {
    id: 'ollama', name: 'Ollama (local)', kind: 'local', status: 'not_configured', badge: 'Local', enabled: false, defaultModel: 'llama3.2:3b', origin: 'demo',
    usage: { tokensMonth: 0, quotaMonth: 0, costUsdMonth: 0 },
    models: [
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B', contextWindow: 128_000, inputPer1M: 0, outputPer1M: 0, priceIsEstimate: false, tags: ['local', 'sem custo de API'] },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', contextWindow: 32_000, inputPer1M: 0, outputPer1M: 0, priceIsEstimate: false, tags: ['local'] },
    ],
  },
]

export const ENVIRONMENTS: EnvironmentInfo[] = [
  { id: 'office', name: 'Escritório', description: 'Desenvolvimento, dados, documentos, automação e revisões — com mezanino, cafeteria e mesa colaborativa.', thumbnail: '/assets/world/office_preview.png', availability: 'implemented', accent: '#9d62ff', unlockLevel: 1 },
  { id: 'research', name: 'Laboratório de Pesquisa', description: 'Machine Learning, RAG, experimentos e avaliação de modelos ao redor do núcleo neural.', thumbnail: '/assets/world/research_preview.png', availability: 'implemented', accent: '#39d6ff', unlockLevel: 1 },
  { id: 'orchestration', name: 'Central de Orquestração', description: 'Fluxos, filas, tarefas e integrações.', thumbnail: '/assets/environments/orchestration_preview.png', availability: 'planned', accent: '#00f5a0', unlockLevel: 10 },
  { id: 'library', name: 'Biblioteca de Agentes', description: 'Repositório de agentes, templates e compartilhamento.', thumbnail: '/assets/environments/library_preview.png', availability: 'planned', accent: '#ffb800', unlockLevel: 15 },
  { id: 'arena', name: 'Arena de Testes', description: 'Avaliação, benchmarks e comparativos.', thumbnail: '/assets/environments/arena_preview.png', availability: 'planned', accent: '#39d6ff', unlockLevel: 20 },
  { id: 'automation', name: 'Estúdio de Automação', description: 'Integrações, APIs, ETL e n8n.', thumbnail: '/assets/environments/automation_preview.png', availability: 'planned', accent: '#ffb800', unlockLevel: 25 },
  { id: 'projects', name: 'Sala de Projetos', description: 'Roadmaps, kanban e planejamento das equipes.', thumbnail: '/assets/environments/projects_preview.png', availability: 'planned', accent: '#ff537a', unlockLevel: 30 },
]

export const KNOWLEDGE_BASES: KnowledgeBase[] = [
  { id: 'kb-dw', name: 'DW Corporativo', kind: 'banco', documents: 38, chunks: 4120, embeddingModel: 'text-embedding (demo)', updatedAt: iso(36e5 * 20), status: 'indexado', origin: 'demo' },
  { id: 'kb-unesp', name: 'Artigos UNESP — IA', kind: 'documentos', documents: 112, chunks: 15890, embeddingModel: 'text-embedding (demo)', updatedAt: iso(36e5 * 50), status: 'indexado', origin: 'demo' },
  { id: 'kb-docs-bi', name: 'Documentação BI', kind: 'documentos', documents: 24, chunks: 1980, embeddingModel: 'text-embedding (demo)', updatedAt: iso(36e5 * 5), status: 'indexando', origin: 'demo' },
  { id: 'kb-web', name: 'Fontes Web Monitoradas', kind: 'web', documents: 0, chunks: 0, embeddingModel: '—', updatedAt: iso(0), status: 'planejado', origin: 'demo' },
]

/** Ferramentas. `implemented: true` = executada de verdade pelo backend; as demais estão planejadas. */
export const TOOLS_CATALOG: { id: string; name: string; risk: string; implemented?: boolean }[] = [
  { id: 'literature_search', name: 'Busca acadêmica (OpenAlex + arXiv)', risk: 'baixo', implemented: true },
  { id: 'web_search', name: 'Busca Web', risk: 'baixo' },
  { id: 'pdf_reader', name: 'Leitor de PDF', risk: 'baixo' },
  { id: 'sql', name: 'Consulta SQL (leitura)', risk: 'médio' },
  { id: 'python', name: 'Execução Python (sandbox)', risk: 'alto' },
  { id: 'http', name: 'Requisições HTTP/API', risk: 'médio' },
  { id: 'powerbi', name: 'Power BI (leitura)', risk: 'baixo' },
  { id: 'docx', name: 'Gerar DOCX', risk: 'baixo' },
  { id: 'pdf_writer', name: 'Gerar PDF', risk: 'baixo' },
  { id: 'retriever', name: 'Recuperador RAG', risk: 'baixo' },
  { id: 'scheduler', name: 'Agendador', risk: 'médio' },
  { id: 'calendar', name: 'Calendário', risk: 'médio' },
  { id: 'git_read', name: 'Git (somente leitura)', risk: 'baixo' },
  { id: 'delegate', name: 'Delegação entre agentes', risk: 'médio' },
  { id: 'queue', name: 'Filas de tarefas', risk: 'baixo' },
  { id: 'rubric', name: 'Rubrica de avaliação', risk: 'baixo' },
  { id: 'eval', name: 'Benchmarks', risk: 'baixo' },
  { id: 'storage', name: 'Armazenamento de arquivos', risk: 'alto' },
] as const

export const INTEGRATIONS_CATALOG = ['Salesforce', 'Power BI', 'n8n', 'Google Drive', 'Slack', 'GitHub', 'PostgreSQL', 'Movidesk']

export const DEMO_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-analise-comercial', name: 'Análise Comercial', description: 'Coleta dados, analisa, gera insights e relatório.', updatedAt: iso(36e5 * 3), origin: 'demo',
    nodes: [
      { id: 'n1', type: 'start', position: { x: 0, y: 120 }, data: { kind: 'start', label: 'Início (Gatilho)' } },
      { id: 'n2', type: 'agent', position: { x: 175, y: 40 }, data: { kind: 'agent', label: 'Coletar Dados', agentId: 'ag-automacao' } },
      { id: 'n3', type: 'agent', position: { x: 350, y: 30 }, data: { kind: 'agent', label: 'Analisar (Python)', agentId: 'ag-analista' } },
      { id: 'n4', type: 'tool', position: { x: 350, y: 200 }, data: { kind: 'tool', label: 'Consulta SQL', tool: 'sql' } },
      { id: 'n5', type: 'agent', position: { x: 525, y: 120 }, data: { kind: 'agent', label: 'Gerar Insights', agentId: 'ag-bi' } },
      { id: 'n6', type: 'review', position: { x: 700, y: 120 }, data: { kind: 'review', label: 'Revisão', reviewer: 'agente', agentId: 'ag-revisor' } },
      { id: 'n7', type: 'output', position: { x: 875, y: 120 }, data: { kind: 'output', label: 'Criar Relatório', outputFormat: 'PDF' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }, { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' }, { id: 'e5', source: 'n4', target: 'n5' }, { id: 'e6', source: 'n5', target: 'n6' }, { id: 'e7', source: 'n6', target: 'n7' },
    ],
  },
  {
    id: 'wf-pesquisa', name: 'Pesquisa Científica', description: 'Pesquisador → Analista → Redator → Revisor.', updatedAt: iso(36e5 * 30), origin: 'demo',
    nodes: [
      { id: 'p1', type: 'start', position: { x: 0, y: 100 }, data: { kind: 'start', label: 'Início' } },
      { id: 'p2', type: 'agent', position: { x: 175, y: 100 }, data: { kind: 'agent', label: 'Pesquisar', agentId: 'ag-pesquisa' } },
      { id: 'p3', type: 'condition', position: { x: 350, y: 100 }, data: { kind: 'condition', label: 'Fontes ≥ 5?', condition: 'fontes >= 5' } },
      { id: 'p4', type: 'agent', position: { x: 525, y: 10 }, data: { kind: 'agent', label: 'Redigir', agentId: 'ag-relatorios' } },
      { id: 'p5', type: 'review', position: { x: 700, y: 10 }, data: { kind: 'review', label: 'Aprovação Humana', reviewer: 'humano' } },
      { id: 'p6', type: 'output', position: { x: 875, y: 10 }, data: { kind: 'output', label: 'Artigo', outputFormat: 'Markdown' } },
    ],
    edges: [
      { id: 'pe1', source: 'p1', target: 'p2' }, { id: 'pe2', source: 'p2', target: 'p3' },
      { id: 'pe3', source: 'p3', target: 'p4', sourceHandle: 'true', label: 'sim' }, { id: 'pe4', source: 'p3', target: 'p2', sourceHandle: 'false', label: 'não' },
      { id: 'pe5', source: 'p4', target: 'p5' }, { id: 'pe6', source: 'p5', target: 'p6' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Dashboard (séries determinísticas por período)
// ---------------------------------------------------------------------------
const RUN_TITLES = [
  'Análise de vendas – Projeto BI', 'Resumo de documento (RAG)', 'Geração de insights – Churn', 'Coleta de dados (API)',
  'Classificação de tickets', 'Relatório semanal de KPIs', 'Revisão de código – ETL', 'Benchmark de prompts',
  'Planejamento da sprint', 'Atualização de embeddings',
]

export function demoRuns(count = 12, seed = 7): ExecutionRun[] {
  const r = seeded(seed)
  const providers: ProviderId[] = ['gemini', 'groq', 'openai', 'huggingface']
  return Array.from({ length: count }, (_, i) => {
    const ag = DEMO_AGENTS[Math.floor(r() * DEMO_AGENTS.length)]
    const status = i === 3 ? 'warning' : r() < 0.06 ? 'error' : 'ok'
    const tokens = status === 'warning' ? 0 : Math.round(400 + r() * 2200)
    return {
      id: `run-demo-${seed}-${i}`, agentId: ag.id, title: RUN_TITLES[i % RUN_TITLES.length], project: ['Projeto BI', 'UNESP', 'Operações'][i % 3],
      status, startedAt: iso((i * 7 + 2) * 60_000), durationMs: Math.round(1500 + r() * 9000), tokens, costUsd: +(tokens * 0.0000012).toFixed(5),
      provider: providers[i % providers.length], model: ag.intelligence.model, origin: 'demo',
    }
  })
}

export function demoExperiments(): Experiment[] {
  return [
    { id: 'ex1', name: 'RAG – Documentos UNESP', provider: 'gemini', model: 'gemini-2.5-pro', metric: 'F1', value: 0.92, status: 'done', date: iso(36e5 * 4), origin: 'demo' },
    { id: 'ex2', name: 'Resumo Científico (Multi)', provider: 'openai', model: 'gpt-4.1', metric: 'ROUGE-L', value: 0.88, status: 'done', date: iso(36e5 * 24), origin: 'demo' },
    { id: 'ex3', name: 'Classificação de Tickets', provider: 'groq', model: 'llama-3.3-70b-versatile', metric: 'Acc', value: 0.94, status: 'done', date: iso(36e5 * 48), origin: 'demo' },
    { id: 'ex4', name: 'Extração de Entidades', provider: 'huggingface', model: 'Qwen2.5-7B', metric: 'F1', value: 0.81, status: 'running', date: iso(36e5 * 1), origin: 'demo' },
  ]
}

export function demoLogs(): LogEntry[] {
  const msgs: [LogEntry['level'], string | null, string][] = [
    ['info', 'ag-rag', 'Iniciando agente: agent_rag_documentos…'],
    ['info', 'ag-rag', 'Modelo: gemini-2.5-pro (tokens: 18.642)'],
    ['info', 'ag-rag', 'Recuperação: 12 documentos encontrados'],
    ['info', 'ag-rag', 'Geração concluída (3,9 s)'],
    ['warn', 'ag-automacao', 'API externa respondeu 429 — nova tentativa em 5 s'],
    ['info', 'ag-analista', 'Consulta SQL concluída: 18.230 linhas'],
  ]
  return msgs.map(([level, agentId, message], i) => ({ id: `log-demo-${i}`, ts: iso((msgs.length - i) * 8000), level, agentId, message, origin: 'demo' }))
}

const PERIOD_CFG: Record<DashboardPeriod, { points: number; label: (i: number, n: number) => string; scale: number; seed: number }> = {
  '24h': { points: 12, label: (i) => `${String(i * 2).padStart(2, '0')}h`, scale: 0.14, seed: 24 },
  '7d': { points: 7, label: (i, n) => { const d = new Date(NOW().getTime() - (n - 1 - i) * 864e5); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }, scale: 1, seed: 7 },
  '30d': { points: 15, label: (i, n) => { const d = new Date(NOW().getTime() - (n - 1 - i) * 2 * 864e5); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }, scale: 4.1, seed: 30 },
}

export function demoDashboard(period: DashboardPeriod, agentCount: number, workflowCount: number): DashboardData {
  const cfg = PERIOD_CFG[period]
  const r = seeded(cfg.seed)
  const series: TokenPoint[] = Array.from({ length: cfg.points }, (_, i) => {
    const trend = 1 + i / cfg.points * 0.8 + Math.sin(i * 1.3) * 0.12
    const k = 1000 * (period === '24h' ? 0.15 : 1)
    return {
      label: cfg.label(i, cfg.points),
      gemini: Math.round((260 + r() * 60) * trend * k),
      groq: Math.round((150 + r() * 50) * trend * k),
      openai: Math.round((210 + r() * 70) * trend * k),
      huggingface: Math.round((70 + r() * 40) * trend * k),
    }
  })
  const tokens = series.reduce((s, p) => s + p.gemini + p.groq + p.openai + p.huggingface, 0)
  const s = cfg.scale
  return {
    period, origin: 'demo',
    kpis: [
      { key: 'agents', label: 'Agentes Ativos', value: agentCount, format: 'int', delta: 3, deltaUnit: 'abs' },
      { key: 'tasks', label: 'Tarefas Executadas', value: Math.round(2847 * s), format: 'int', delta: 18.4, deltaUnit: '%' },
      { key: 'runs', label: 'Execuções (Runs)', value: Math.round(1093 * s), format: 'int', delta: 12.7, deltaUnit: '%' },
      { key: 'tokens', label: 'Tokens Consumidos', value: tokens, format: 'compact', delta: 9.3, deltaUnit: '%' },
      { key: 'latency', label: 'Tempo Médio', value: 6.8, format: 'seconds', delta: -14.2, deltaUnit: '%', invert: true },
      { key: 'success', label: 'Taxa de Sucesso', value: 97.6, format: 'percent', delta: 1.9, deltaUnit: 'pp' },
    ],
    tokenSeries: series,
    topAgents: [...DEMO_AGENTS].sort((a, b) => (b.stats?.runs ?? 0) - (a.stats?.runs ?? 0)).slice(0, 4).map((a) => ({ agentId: a.id, runs: Math.round((a.stats?.runs ?? 0) * (period === '24h' ? 0.1 : period === '30d' ? 3.2 : 1)) })),
    recentRuns: demoRuns(8, cfg.seed),
    experiments: demoExperiments(),
    logs: demoLogs(),
    counters: { projects: 5, workflows: workflowCount, ragBases: KNOWLEDGE_BASES.filter((k) => k.status !== 'planejado').length + 1, integrations: 6 },
  }
}
