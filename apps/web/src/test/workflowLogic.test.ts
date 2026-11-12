import { describe, expect, it } from 'vitest'
import { canConnect, executionPlan, validateWorkflow } from '@/features/workflows/workflowLogic'
import { DEMO_WORKFLOWS } from '@/services/demo/demoData'
import type { WorkflowNode } from '@/types/domain'

const n = (id: string, type: WorkflowNode['type'], extra: Partial<WorkflowNode['data']> = {}): WorkflowNode => ({ id, type, position: { x: 0, y: 0 }, data: { kind: type, label: id, ...extra } })

describe('workflowLogic', () => {
  it('valida os workflows de exemplo sem erros', () => {
    for (const wf of DEMO_WORKFLOWS) {
      const issues = validateWorkflow(wf.nodes, wf.edges)
      expect(issues.filter((i) => i.level === 'error')).toEqual([])
    }
  })

  it('bloqueia conexões inválidas', () => {
    const nodes = [n('s', 'start'), n('a', 'agent', { agentId: 'x' }), n('o', 'output')]
    expect(canConnect(nodes, [], 'a', 'a')).toMatch(/si mesmo/)
    expect(canConnect(nodes, [], 'a', 's')).toMatch(/Início/)
    expect(canConnect(nodes, [], 'o', 'a')).toMatch(/Saída/)
    expect(canConnect(nodes, [{ id: 'e', source: 's', target: 'a' }], 's', 'a')).toMatch(/duplicada/)
    expect(canConnect(nodes, [], 's', 'a')).toBeNull()
  })

  it('aponta início ausente, saída inalcançável e agente sem configuração', () => {
    const issues = validateWorkflow([n('a', 'agent'), n('o', 'output')], [])
    const msgs = issues.map((i) => i.message).join(' | ')
    expect(msgs).toMatch(/nó de Início/)
    expect(msgs).toMatch(/selecione um agente/)
  })

  it('gera plano de execução finito mesmo com laços', () => {
    const wf = DEMO_WORKFLOWS[1]
    const always = () => 0.99 // força o ramo "não" (laço de volta à pesquisa)
    const plan = executionPlan(wf.nodes, wf.edges, always)
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.length).toBeLessThan(30)
    expect(plan[0]).toBe('p1')
  })
})
