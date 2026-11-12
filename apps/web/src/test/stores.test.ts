import { beforeEach, describe, expect, it } from 'vitest'
import { useSimulationStore } from '@/stores/simulationStore'
import { levelFromXp, useGameStore, xpForLevel } from '@/stores/gameStore'
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

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().reset())
  it('concede XP apenas por ações verificáveis e libera missão', () => {
    const g = useGameStore.getState()
    g.record('agentCreated', { rag: true })
    expect(useGameStore.getState().xp).toBeGreaterThan(0)
    expect(useGameStore.getState().claimMission('m-first-agent')).toBe(true)
    expect(useGameStore.getState().claimMission('m-first-agent')).toBe(false)
    expect(useGameStore.getState().claimMission('m-workflow')).toBe(false)
  })
  it('não duplica XP por ambiente revisitado', () => {
    const g = useGameStore.getState()
    g.record('environmentVisited', { envId: 'office' })
    const xp = useGameStore.getState().xp
    g.record('environmentVisited', { envId: 'office' })
    expect(useGameStore.getState().xp).toBe(xp)
  })
  it('curva de níveis é monotônica', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(xpForLevel(5))).toBe(5)
    expect(xpForLevel(6)).toBeGreaterThan(xpForLevel(5))
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
  it('dashboard demo é marcado como demonstrativo', async () => {
    const d = await createDemoDataSource().getDashboard('7d')
    expect(d.origin).toBe('demo')
    expect(d.kpis).toHaveLength(6)
  })
})

