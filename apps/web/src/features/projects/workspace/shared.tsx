import { useCallback, useEffect, useState } from 'react'
import type { AgentMessage, Artifact, Evidence, Execution, Project, ProjectTask, ToolCall } from '@/types/platform'
import { useLabStore } from '@/stores/labStore'
import { fmtDuration } from '@/lib/format'

/** Dados reais do projeto carregados do backend (atualizados pelos eventos SSE). */
export interface WorkspaceData {
  project: Project
  messages: AgentMessage[]
  artifacts: Artifact[]
  evidence: Evidence[]
  executions: Execution[]
  toolCalls: ToolCall[]
  reload: () => Promise<void>
}

export type Area = 'planejamento' | 'execucao' | 'conversas' | 'documentos' | 'revisao' | 'custos'

/** Navegação entre áreas com seleção contextual (ex.: abrir um documento a partir de uma mensagem). */
export interface Nav {
  go: (area: Area, focus?: { artifactId?: string; taskId?: string }) => void
  focus: { artifactId?: string; taskId?: string }
}

export const TASK_STATUS: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposta', color: '#8b97c4' },
  pending: { label: 'Aguardando', color: '#8b97c4' },
  running: { label: 'Em execução', color: '#39d6ff' },
  done: { label: 'Concluída', color: '#00f5a0' },
  failed: { label: 'Falhou', color: '#ff537a' },
  cancelled: { label: 'Cancelada', color: '#8a93b0' },
}

export const DOC_KIND: Record<string, { label: string; group: 'final' | 'parcial' | 'revisao' }> = {
  report: { label: 'Relatório consolidado', group: 'final' },
  findings: { label: 'Achados de pesquisa', group: 'parcial' },
  analysis: { label: 'Análise técnica', group: 'parcial' },
  review: { label: 'Parecer de revisão', group: 'revisao' },
}

export function useAgentName() {
  const agents = useLabStore((s) => s.agents)
  return useCallback(
    (id: string | null | undefined, kind = 'agent') => (kind === 'user' ? 'Gestor (você)' : kind === 'system' ? 'Sistema' : agents.find((a) => a.id === id)?.name ?? '—'),
    [agents],
  )
}

export function useTeam(project: Project) {
  const agents = useLabStore((s) => s.agents)
  return agents.filter((a) => !project.organizationId || a.organizationId === project.organizationId)
}

/** Relógio de 1 s para durações ao vivo (só quando há algo em execução). */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function taskDuration(t: Pick<ProjectTask, 'startedAt' | 'finishedAt' | 'status'>, now: number) {
  if (!t.startedAt) return null
  const end = t.finishedAt && t.status !== 'running' ? new Date(t.finishedAt).getTime() : now
  return fmtDuration(end - new Date(t.startedAt).getTime())
}

/** Nível de cada tarefa no grafo de dependências (1 = sem dependências). */
export function stages(tasks: ProjectTask[]): ProjectTask[][] {
  const by = new Map(tasks.map((t) => [t.key, t]))
  const level = new Map<string, number>()
  const visit = (t: ProjectTask, seen = new Set<string>()): number => {
    if (level.has(t.key)) return level.get(t.key)!
    if (seen.has(t.key)) return 1
    seen.add(t.key)
    const deps = t.dependsOn.map((k) => by.get(k)).filter(Boolean) as ProjectTask[]
    const l = deps.length ? Math.max(...deps.map((d) => visit(d, seen))) + 1 : 1
    level.set(t.key, l)
    return l
  }
  tasks.forEach((t) => visit(t))
  const out: ProjectTask[][] = []
  for (const t of tasks) (out[level.get(t.key)! - 1] ??= []).push(t)
  return out.filter(Boolean)
}

/** Texto legível de uma área vazia. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[6px] border border-dashed border-white/10 px-4 py-6 text-center text-[13px] text-lab-muted">{children}</p>
}
