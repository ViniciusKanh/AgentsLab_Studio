import type { Agent, AgentRuntimeState, SimulationEvent } from '@/types/domain'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useGameStore } from '@/stores/gameStore'

/**
 * SIMULADOR DEMONSTRATIVO.
 * Produz eventos no mesmo formato que o backend real emitirá (SimulationEvent),
 * com origin: 'demo'. Nenhuma chamada a LLM é feita. Serve apenas para validar
 * a interface, as animações e o fluxo de estados.
 */
const TASKS: Record<string, string[]> = {
  default: ['Responder solicitação interna', 'Organizar contexto da tarefa', 'Gerar resumo executivo'],
  'Dados & BI': ['Atualizar dashboard comercial', 'Analisar churn mensal', 'Validar medidas DAX', 'Consulta SQL de vendas'],
  Pesquisa: ['Ler e resumir 3 artigos (RAG)', 'Comparar modelos no benchmark', 'Buscar referências verificáveis'],
  Conhecimento: ['Responder com base nos documentos', 'Reindexar documentação BI'],
  Operações: ['Sincronizar API externa', 'Executar rotina agendada'],
  Conteúdo: ['Redigir relatório semanal', 'Revisar texto do release'],
  Desenvolvimento: ['Refatorar módulo ETL', 'Escrever testes do pipeline'],
  Qualidade: ['Revisar relatório de vendas', 'Aplicar rubrica de qualidade'],
  Gestão: ['Planejar sprint de agentes', 'Priorizar backlog'],
  Orquestração: ['Distribuir tarefas da fila', 'Coordenar workflow comercial'],
}

type Timer = ReturnType<typeof setTimeout>

export class DemoSimulator {
  private timers = new Map<string, Timer[]>()
  private busy = new Set<string>()
  private unsub: (() => void) | null = null
  private seq = 0

  start() {
    if (this.unsub) return
    this.syncAgents()
    this.unsub = useLabStore.subscribe((s, prev) => {
      if (s.agents !== prev.agents) this.syncAgents()
    })
  }

  stop() {
    this.unsub?.()
    this.unsub = null
    for (const list of this.timers.values()) list.forEach(clearTimeout)
    this.timers.clear()
    this.busy.clear()
  }

  private now() {
    return new Date().toISOString()
  }

  private emit(e: SimulationEvent) {
    useSimulationStore.getState().ingest(e)
  }

  private state(agentId: string, state: AgentRuntimeState, extra: Partial<Extract<SimulationEvent, { type: 'agent.state' }>> = {}) {
    this.emit({ type: 'agent.state', agentId, state, ts: this.now(), origin: 'demo', ...extra })
  }

  private log(agentId: string | null, message: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.emit({ type: 'log', ts: this.now(), origin: 'demo', entry: { id: `lg-${++this.seq}`, ts: this.now(), level, agentId, message, origin: 'demo' } })
  }

  /**
   * Agenda callback. A velocidade da simulação AMBIENTAL não afeta tarefas;
   * `running=false` congela apenas as missões automáticas (autopiloto demo).
   */
  private after(agentId: string, ms: number, fn: () => void) {
    const t = setTimeout(fn, ms)
    const list = this.timers.get(agentId) ?? []
    list.push(t)
    this.timers.set(agentId, list.slice(-8))
  }

  private syncAgents() {
    const agents = useLabStore.getState().agents
    useSimulationStore.getState().ensure(agents.map((a) => a.id))
    for (const a of agents) {
      if (!this.timers.has(a.id)) {
        this.timers.set(a.id, [])
        this.after(a.id, 20000 + Math.random() * 70000, () => this.cycle(a.id))
      }
    }
    for (const id of [...this.timers.keys()]) {
      if (!agents.some((a) => a.id === id)) {
        this.timers.get(id)?.forEach(clearTimeout)
        this.timers.delete(id)
      }
    }
  }

  private agent(id: string): Agent | undefined {
    return useLabStore.getState().agents.find((a) => a.id === id)
  }

  private isBlocked(a: Agent) {
    return a.status !== 'active' || !!useSimulationStore.getState().manualPaused[a.id]
  }

  /** Missão atribuída pelo usuário (modo demo): mesmo contrato de eventos do backend. */
  runMission(agentId: string, title: string): string | null {
    const a = this.agent(agentId)
    if (!a || this.isBlocked(a)) return null
    if (this.busy.has(agentId)) this.timers.get(agentId)?.forEach(clearTimeout)
    this.busy.delete(agentId)
    return this.startTask(agentId, title)
  }

  private cycle(id: string) {
    const a = this.agent(id)
    if (!a) return
    if (!useSimulationStore.getState().running) {
      this.after(id, 3000, () => this.cycle(id))
      return
    }
    if (this.isBlocked(a)) {
      if (useSimulationStore.getState().runtime[id]?.state !== 'paused') this.state(id, 'paused')
      this.after(id, 1500, () => this.cycle(id))
      return
    }
    if (this.busy.has(id)) {
      this.after(id, 1500, () => this.cycle(id))
      return
    }
    const pool = TASKS[a.department] ?? TASKS.default
    this.startTask(id, pool[Math.floor(Math.random() * pool.length)])
  }

  private startTask(id: string, title: string): string {
    const a = this.agent(id)!
    this.busy.add(id)
    const taskId = `task-demo-${++this.seq}`
    const started = Date.now()
    let tokens = 0
    this.state(id, 'planning', { taskId, taskTitle: title })
    this.log(id, `[DEMO] ${a.name}: planejando “${title}”`)

    const workSteps = 8 + Math.floor(Math.random() * 8)
    const step = (i: number) => {
      const ag = this.agent(id)
      if (!ag || this.isBlocked(ag)) return this.finish(id, taskId, 'failed', tokens, started, true)
      const t = Math.round(120 + Math.random() * 380)
      tokens += t
      this.emit({ type: 'task.progress', agentId: id, taskId, progress: (i + 1) / workSteps, tokens: t, ts: this.now(), origin: 'demo' })
      if (i + 1 < workSteps) this.after(id, 1400, () => step(i + 1))
      else this.after(id, 400, () => this.maybeCollaborate(id, taskId, tokens, started))
    }
    // tempo para o personagem caminhar até a estação antes de "executar"
    this.after(id, 4500 + Math.random() * 2500, () => {
      this.state(id, 'working', { taskId, taskTitle: title })
      this.log(id, `[DEMO] ${a.name}: executando com ${a.intelligence.model}`)
      step(0)
    })
    return taskId
  }

  private maybeCollaborate(id: string, taskId: string, tokens: number, started: number) {
    const a = this.agent(id)
    if (!a) return
    const partner = a.rules.allowDelegation && Math.random() < 0.4
      ? useLabStore.getState().agents.find((p) => p.id !== id && p.environmentId === a.environmentId && !this.busy.has(p.id) && !this.isBlocked(p))
      : undefined
    if (partner) {
      this.busy.add(partner.id)
      this.state(id, 'collaborating', { partnerId: partner.id })
      this.state(partner.id, 'collaborating', { partnerId: id, taskTitle: `Apoiando: ${a.name}` })
      this.log(id, `[DEMO] ${a.name} ↔ ${partner.name}: colaboração iniciada`)
      this.after(id, 9000, () => {
        this.state(partner.id, 'idle')
        this.busy.delete(partner.id)
        this.review(id, taskId, tokens, started)
      })
    } else {
      this.review(id, taskId, tokens, started)
    }
  }

  private review(id: string, taskId: string, tokens: number, started: number) {
    this.state(id, 'reviewing')
    this.after(id, 2200 + Math.random() * 1500, () => {
      const failed = Math.random() < 0.07
      this.finish(id, taskId, failed ? 'failed' : 'done', tokens, started, false)
    })
  }

  private finish(id: string, taskId: string, status: 'done' | 'failed', tokens: number, started: number, interrupted: boolean) {
    const a = this.agent(id)
    this.emit({
      type: 'task.finished', agentId: id, taskId, status, tokens, costUsd: +(tokens * 0.0000015).toFixed(6),
      durationMs: Date.now() - started, result: status === 'done' ? 'Resultado demonstrativo gerado.' : 'Falha simulada.', ts: this.now(), origin: 'demo',
    })
    this.state(id, status === 'done' ? 'completed' : 'failed')
    if (a) this.log(id, `[DEMO] ${a.name}: ${status === 'done' ? 'tarefa concluída' : interrupted ? 'tarefa interrompida' : 'falha simulada (tentativa registrada)'}`, status === 'done' ? 'info' : 'warn')
    if (status === 'done') useGameStore.getState().record('taskObserved')
    this.after(id, 2400, () => {
      this.state(id, 'idle')
      this.busy.delete(id)
      this.after(id, 45000 + Math.random() * 75000, () => this.cycle(id))
    })
  }
}

export const demoSimulator = new DemoSimulator()
