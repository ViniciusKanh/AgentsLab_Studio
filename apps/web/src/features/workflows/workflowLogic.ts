import type { WorkflowEdge, WorkflowNode } from '@/types/domain'

export interface ValidationIssue {
  level: 'error' | 'warn'
  message: string
  nodeId?: string
}

/** Regras básicas de conexão (usadas pelo React Flow e pelos testes). */
export function canConnect(nodes: WorkflowNode[], edges: WorkflowEdge[], source: string, target: string, sourceHandle?: string | null): string | null {
  if (source === target) return 'Um nó não pode se conectar a si mesmo.'
  const s = nodes.find((n) => n.id === source)
  const t = nodes.find((n) => n.id === target)
  if (!s || !t) return 'Nó inexistente.'
  if (t.type === 'start') return 'O nó de Início não aceita entradas.'
  if (s.type === 'output') return 'O nó de Saída não possui saídas.'
  if (edges.some((e) => e.source === source && e.target === target && (e.sourceHandle ?? null) === (sourceHandle ?? null))) return 'Conexão duplicada.'
  if (s.type === 'condition' && edges.some((e) => e.source === source && e.sourceHandle === sourceHandle)) return 'Cada ramo da condição aceita apenas uma conexão.'
  return null
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const starts = nodes.filter((n) => n.type === 'start')
  if (starts.length === 0) issues.push({ level: 'error', message: 'Adicione um nó de Início.' })
  if (starts.length > 1) issues.push({ level: 'error', message: 'Use apenas um nó de Início.' })
  if (!nodes.some((n) => n.type === 'output')) issues.push({ level: 'error', message: 'Adicione ao menos um nó de Saída.' })
  for (const n of nodes) {
    if (n.type === 'agent' && !n.data.agentId) issues.push({ level: 'error', message: `“${n.data.label}”: selecione um agente.`, nodeId: n.id })
    if (n.type === 'review' && n.data.reviewer === 'agente' && !n.data.agentId) issues.push({ level: 'error', message: `“${n.data.label}”: selecione o agente revisor.`, nodeId: n.id })
    if (n.type === 'tool' && !n.data.tool) issues.push({ level: 'error', message: `“${n.data.label}”: selecione a ferramenta.`, nodeId: n.id })
    if (n.type === 'condition' && !n.data.condition) issues.push({ level: 'warn', message: `“${n.data.label}”: defina a expressão da condição.`, nodeId: n.id })
    if (n.type !== 'start' && !edges.some((e) => e.target === n.id)) issues.push({ level: 'warn', message: `“${n.data.label}” não possui entrada.`, nodeId: n.id })
    if (n.type !== 'output' && !edges.some((e) => e.source === n.id)) issues.push({ level: 'warn', message: `“${n.data.label}” não possui saída.`, nodeId: n.id })
  }
  if (starts.length === 1) {
    const reach = reachable(starts[0].id, edges)
    for (const n of nodes) if (!reach.has(n.id)) issues.push({ level: 'warn', message: `“${n.data.label}” não é alcançável a partir do Início.`, nodeId: n.id })
    if (!nodes.some((n) => n.type === 'output' && reach.has(n.id))) issues.push({ level: 'error', message: 'Nenhuma Saída é alcançável a partir do Início.' })
  }
  return dedupe(issues)
}

function dedupe(list: ValidationIssue[]) {
  const seen = new Set<string>()
  return list.filter((i) => (seen.has(i.message) ? false : (seen.add(i.message), true)))
}

export function reachable(startId: string, edges: WorkflowEdge[]) {
  const seen = new Set<string>([startId])
  const q = [startId]
  while (q.length) {
    const cur = q.shift()!
    for (const e of edges) if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); q.push(e.target) }
  }
  return seen
}

/**
 * Plano de execução DEMONSTRATIVO: percorre o grafo a partir do Início.
 * Condições escolhem um ramo por sorteio; loops são limitados (máx. 2 visitas por nó)
 * para respeitar o critério de conclusão e evitar consumo descontrolado.
 */
export function executionPlan(nodes: WorkflowNode[], edges: WorkflowEdge[], rand: () => number = Math.random): string[] {
  const start = nodes.find((n) => n.type === 'start')
  if (!start) return []
  const plan: string[] = []
  const visits = new Map<string, number>()
  const queue = [start.id]
  let guard = 0
  while (queue.length && guard++ < 60) {
    const id = queue.shift()!
    const v = (visits.get(id) ?? 0) + 1
    if (v > 2) continue
    visits.set(id, v)
    plan.push(id)
    const node = nodes.find((n) => n.id === id)
    let outs = edges.filter((e) => e.source === id)
    if (node?.type === 'condition') {
      const branch = rand() < 0.7 || v > 1 ? 'true' : 'false'
      outs = outs.filter((e) => e.sourceHandle === branch)
    }
    for (const e of outs) if (!queue.includes(e.target)) queue.push(e.target)
  }
  return plan
}
