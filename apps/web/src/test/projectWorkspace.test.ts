import { describe, expect, it } from 'vitest'
import { stages } from '@/features/projects/workspace/shared'
import { activityLabel } from '@/simulation/states'
import type { ProjectTask } from '@/types/platform'

const t = (key: string, dependsOn: string[] = []): ProjectTask => ({
  id: key, key, title: key, description: '', kind: 'research', agentId: null, dependsOn, deliverable: '', status: 'pending', step: '', stepsDone: 0, stepsTotal: 1,
  resultArtifactId: null, targetArtifactId: null, error: '', position: 0, startedAt: null, finishedAt: null,
})

describe('fluxo de dependências', () => {
  it('agrupa tarefas independentes na mesma etapa (paralelo) e respeita a ordem', () => {
    const s = stages([t('T1'), t('T2'), t('T3', ['T1', 'T2']), t('T4', ['T3']), t('T5', ['T4']), t('FB1'), t('UP1', ['FB1'])])
    expect(s.map((c) => c.map((x) => x.key))).toEqual([['T1', 'T2', 'FB1'], ['T3', 'UP1'], ['T4'], ['T5']])
  })
  it('tolera dependência inexistente e ciclos sem travar', () => {
    expect(stages([t('A', ['X']), t('B', ['C']), t('C', ['B'])]).flat().length).toBe(3)
  })
})

describe('rótulo de atividade', () => {
  it('combina estado real com o tipo da tarefa', () => {
    expect(activityLabel('working', 'research')).toBe('Pesquisando')
    expect(activityLabel('working', 'writing')).toBe('Redigindo')
    expect(activityLabel('reviewing', 'review')).toBe('Revisando')
    expect(activityLabel('waiting', 'analysis')).toBe('Aguardando dependência')
    expect(activityLabel('idle', null)).toBe('Ocioso')
  })
})
