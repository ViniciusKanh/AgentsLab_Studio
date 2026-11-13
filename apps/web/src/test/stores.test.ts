import { beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from '@/stores/simulationStore'
import { dispatchPlatformEvent } from '@/services/realtime'
import { worldBus } from '@/world/events/bus'
import { createDemoDataSource, __resetDemoMemory } from '@/services/demo/demoDataSource'
import { emptyDraft } from '@/features/agents/agentForm'

describe('simulationStore', () => {
  it('aplica eventos de estado e conclusão (contrato SimulationEvent)', () => {
    const s = useSimulationStore.getState()
    const ts = new Date().toISOString()
    s.ingest({ type: 'agent.state', agentId: 'a1', state: 'working', taskId: 't1', taskTitle: 'Teste', ts, origin: 'demo' })
    s.ingest({ type: 'task.progress', agentId: 'a1', taskId: 't1', progress: 0.5, tokens: 100, ts, origin: 'demo' })
    let rt = useSimulationStore.getState().runtime.a1
    expect(rt.state).toBe('working')
    expect(rt.progress).toBe(0.5)
    expect(rt.tokensSession).toBe(100)
    s.ingest({ type: 'task.finished', agentId: 'a1', taskId: 't1', status: 'done', tokens: 100, costUsd: 0.001, durationMs: 1000, result: 'ok', ts, origin: 'demo' })
    rt = useSimulationStore.getState().runtime.a1
    expect(rt.progress).toBe(1)
    expect(useSimulationStore.getState().sessionRuns[0].origin).toBe('demo')
  })
})

describe('realtime (eventos do backend)', () => {
  beforeEach(() => useSimulationStore.getState().reset())
  it('converte eventos SSE em estado dos agentes, etapas reais e balões', () => {
    const said: string[] = []
    const off = worldBus.on('agent:message', (m) => said.push(`${m.type}:${m.fromAgentId}->${m.toAgentId}`))
    const ts = new Date().toISOString()
    dispatchPlatformEvent({ id: 1, type: 'agent.state', projectId: 'p', ts, payload: { agentId: 'a1', state: 'working', taskId: 't1', taskTitle: 'Pesquisar' } })
    dispatchPlatformEvent({ id: 2, type: 'task.progress', projectId: 'p', ts, payload: { agentId: 'a1', taskId: 't1', progress: 0.5, step: 'buscando fontes', stepsDone: 2, stepsTotal: 4, tokens: 30 } })
    dispatchPlatformEvent({ id: 3, type: 'agent.message', projectId: 'p', ts, payload: { fromAgentId: 'a1', toAgentId: 'a2', type: 'entrega', content: 'Achados prontos', fromKind: 'agent' } })
    off()
    const rt = useSimulationStore.getState().runtime.a1
    expect(rt.state).toBe('working')
    expect(rt.step).toBe('buscando fontes')
    expect([rt.stepsDone, rt.stepsTotal]).toEqual([2, 4])
    expect(said).toEqual(['entrega:a1->a2'])
    expect(useSimulationStore.getState().logs.at(-1)?.origin).toBe('real')
  })
})

describe('demoDataSource', () => {
  beforeEach(() => { localStorage.clear(); __resetDemoMemory() })
  it('cria, duplica e exclui agentes com persistência local', async () => {
    const ds = createDemoDataSource()
    const before = (await ds.listAgents()).length
    const a = await ds.saveAgent(emptyDraft({ name: 'Novo', objective: 'Objetivo de teste' }))
    expect(a.origin).toBe('demo')
    const c = await ds.duplicateAgent(a.id)
    expect((await ds.listAgents()).length).toBe(before + 2)
    await ds.deleteAgent(c.id)
    __resetDemoMemory()
    expect((await ds.listAgents()).some((x) => x.id === a.id)).toBe(true)
  })
})

