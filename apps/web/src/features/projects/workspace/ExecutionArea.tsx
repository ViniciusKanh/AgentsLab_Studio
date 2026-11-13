import { useMemo, useState } from 'react'
import { MessageSquarePlus, Send, Wrench } from 'lucide-react'
import type { ProjectTask } from '@/types/platform'
import type { Agent } from '@/types/domain'
import { MESSAGE_TYPE, platform, TASK_KIND, TOOL_LABEL } from '@/services/platform'
import { useUiStore } from '@/stores/uiStore'
import { activityLabel, STATE_META } from '@/simulation/states'
import { Avatar, Chip, Field, Panel, ProgressBar, cx } from '@/components/ui/primitives'
import { fmtClock, fmtCost, fmtInt } from '@/lib/format'
import { Empty, TASK_STATUS, stages, taskDuration, useAgentName, useNow, useTeam, type Nav, type WorkspaceData } from './shared'

type AgentRow = { agent: Agent; label: string; color: string; task: ProjectTask | null; detail: string }

/** Estado de cada agente derivado das tarefas persistidas (não de animações). */
function agentRows(team: Agent[], tasks: ProjectTask[], projectActive: boolean): AgentRow[] {
  const done = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.key))
  return team
    .filter((a) => tasks.some((t) => t.agentId === a.id))
    .map((agent) => {
      const mine = tasks.filter((t) => t.agentId === agent.id)
      const running = mine.find((t) => t.status === 'running')
      if (running) {
        const st = running.kind === 'review' ? 'reviewing' : 'working'
        return { agent, task: running, label: activityLabel(st, running.kind), color: STATE_META[st].color, detail: running.step }
      }
      const pending = mine.find((t) => t.status === 'pending')
      if (pending && projectActive) {
        const missing = pending.dependsOn.filter((d) => !done.has(d))
        return missing.length
          ? { agent, task: pending, label: STATE_META.waiting.label, color: STATE_META.waiting.color, detail: `Aguarda ${missing.join(', ')}` }
          : { agent, task: pending, label: 'Na fila', color: '#8b97c4', detail: 'Dependências prontas; aguardando vaga de execução' }
      }
      const failed = mine.find((t) => t.status === 'failed')
      if (failed) return { agent, task: failed, label: STATE_META.failed.label, color: STATE_META.failed.color, detail: failed.error }
      if (pending) return { agent, task: pending, label: 'Pausado', color: STATE_META.paused.color, detail: 'Execução do projeto parada' }
      const last = [...mine].reverse().find((t) => t.status === 'done')
      return { agent, task: last ?? null, label: last ? 'Entregou' : 'Ocioso', color: last ? '#00f5a0' : STATE_META.idle.color, detail: '' }
    })
}

export function ExecutionArea({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, toolCalls, executions } = data
  const tasks = project.tasks ?? []
  const team = useTeam(project)
  const active = ['running', 'revising'].includes(project.status)
  const now = useNow(tasks.some((t) => t.status === 'running'))
  const rows = agentRows(team, tasks, active || project.status === 'paused')
  const sel = tasks.find((t) => t.id === nav.focus.taskId) ?? tasks.find((t) => t.status === 'running') ?? null
  if (!tasks.length) return <Empty>O plano ainda não foi aprovado — nenhuma tarefa em execução.</Empty>
  return (
    <div className="flex flex-col gap-3">
      <Panel accent="green" title="Equipe agora" data-testid="agent-status">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <button key={r.agent.id} onClick={() => r.task && nav.go('execucao', { taskId: r.task.id })} className="px-inset flex items-center gap-3 p-2.5 text-left hover:brightness-125">
              <Avatar characterId={r.agent.appearance.characterId} size={40} ring={r.color} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px]">{r.agent.name}</b>
                <span className="block text-[12.5px] font-bold" style={{ color: r.color }}>{r.label}{r.task && r.task.status === 'running' ? ` · ${taskDuration(r.task, now)}` : ''}</span>
                {r.task && <span className="block truncate text-[12px] text-lab-muted">{r.task.key} — {r.detail || r.task.title}</span>}
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel accent="cyan" title="Atividades" data-testid="task-board">
          <div className="space-y-3">
            {stages(tasks).map((col, i) => (
              <div key={i}>
                <p className="px-label">Etapa {i + 1}{col.length > 1 ? ' · paralelo' : ''}</p>
                <div className="space-y-1.5">
                  {col.map((t) => {
                    const s = TASK_STATUS[t.status]
                    const tools = toolCalls.filter((c) => c.taskId === t.id).length
                    return (
                      <button key={t.id} onClick={() => nav.go('execucao', { taskId: t.id })} data-testid="task-card"
                        className={cx('flex w-full flex-col gap-1 rounded-[6px] border px-3 py-2 text-left text-[13px]', sel?.id === t.id ? 'border-neon-cyan bg-neon-cyan/10' : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]')}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neon-cyan">{t.key}</span>
                          <b className="min-w-0 flex-1 truncate">{t.title}</b>
                          <Chip color={s.color}>{s.label}</Chip>
                        </span>
                        <span className="flex flex-wrap gap-x-3 text-[12px] text-lab-muted">
                          <span>{TASK_KIND[t.kind]}</span>
                          {taskDuration(t, now) && <span>⏱ {taskDuration(t, now)}</span>}
                          {tools > 0 && <span><Wrench size={11} className="inline" /> {tools} uso(s) de ferramenta</span>}
                          {(t.attempts ?? 0) > 1 && <span>{t.attempts} tentativas</span>}
                        </span>
                        {t.status === 'running' && <><ProgressBar value={t.stepsTotal ? t.stepsDone / t.stepsTotal : 0} height={6} /><span className="text-[12px] text-neon-cyan">Etapa {Math.min(t.stepsDone + 1, t.stepsTotal)}/{t.stepsTotal}: {t.step}</span></>}
                        {t.error && <span className="text-[12px] text-neon-pink">{t.error.slice(0, 220)}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        {sel ? <TaskDetail data={data} task={sel} nav={nav} now={now} /> : <Empty>Selecione uma atividade para ver contexto, ferramentas e histórico.</Empty>}
      </div>
      <EventHistory data={data} nav={nav} executionsCount={executions.length} />
    </div>
  )
}

function TaskDetail({ data, task, nav, now }: { data: WorkspaceData; task: ProjectTask; nav: Nav; now: number }) {
  const { project, toolCalls, executions, messages, artifacts } = data
  const name = useAgentName()
  const toast = useUiStore((s) => s.toast)
  const [guide, setGuide] = useState('')
  const tools = toolCalls.filter((c) => c.taskId === task.id)
  const exes = executions.filter((e) => e.taskId === task.id)
  const msgs = messages.filter((m) => m.taskId === task.id)
  const ctx = task.context ?? {}
  const result = artifacts.find((a) => a.id === task.resultArtifactId)
  const s = TASK_STATUS[task.status]
  const closed = ['completed', 'cancelled'].includes(project.status)
  return (
    <Panel accent="purple" title={`${task.key} — ${task.title}`} actions={<Chip color={s.color}>{s.label}</Chip>} data-testid="task-detail" bodyClassName="space-y-3 text-[13px]">
      <p className="text-lab-muted">{name(task.agentId)} · {TASK_KIND[task.kind]}{taskDuration(task, now) ? ` · duração ${taskDuration(task, now)}` : ''}{(task.attempts ?? 0) > 1 ? ` · ${task.attempts} tentativas` : ''}</p>
      {task.description && <p className="whitespace-pre-wrap rounded-[5px] bg-white/[0.04] p-2">{task.description}</p>}
      {task.error && <p className="rounded-[5px] border border-neon-pink/40 bg-neon-pink/10 p-2 text-neon-pink">{task.error}</p>}
      <div>
        <p className="px-label">Contexto entregue ao agente</p>
        {!ctx.inputs?.length && !ctx.evidence?.length && !ctx.target ? <p className="text-[12.5px] text-lab-muted">{task.startedAt ? 'Sem documentos de entrada (tarefa inicial).' : 'Registrado quando a tarefa iniciar.'}</p> : (
          <ul className="space-y-1 text-[12.5px]">
            {ctx.target && <li>Documento a revisar: <button className="font-bold text-neon-cyan hover:underline" onClick={() => nav.go('documentos', { artifactId: ctx.target!.artifactId })}>{ctx.target.code} “{ctx.target.title}” v{ctx.target.version}</button></li>}
            {ctx.inputs?.map((i) => <li key={i.artifactId}>Entrada{i.fromTask ? ` de ${i.fromTask}` : ''}: <button className="font-bold text-neon-cyan hover:underline" onClick={() => nav.go('documentos', { artifactId: i.artifactId })}>{i.code} “{i.title}” v{i.version}</button></li>)}
            {!!ctx.evidence?.length && <li>Evidências disponíveis: <span className="font-mono">{ctx.evidence.join(', ')}</span></li>}
            {!!ctx.guidanceMessages && <li>{ctx.guidanceMessages} orientação(ões) do gestor incluída(s)</li>}
          </ul>
        )}
      </div>
      {result && <p>Resultado: <button className="font-bold text-neon-green hover:underline" onClick={() => nav.go('documentos', { artifactId: result.id })}>{result.code} “{result.title}” (v{result.currentVersion})</button></p>}
      <div>
        <p className="px-label">Ferramentas usadas ({tools.length})</p>
        {tools.length === 0 ? <p className="text-[12.5px] text-lab-muted">Nenhuma.</p> : (
          <ul className="max-h-48 space-y-1 overflow-auto text-[12.5px]">
            {tools.map((c) => (
              <li key={c.id} className="rounded-[5px] bg-white/[0.04] px-2 py-1">
                <span className={c.status === 'ok' ? 'text-neon-cyan' : 'text-neon-pink'}>{TOOL_LABEL[c.tool] ?? c.tool}</span> · {fmtClock(c.createdAt)} · {(c.latencyMs / 1000).toFixed(1)} s
                <span className="block text-lab-muted">{c.input}</span>
                <details><summary className="cursor-pointer text-[11.5px] text-lab-muted">resultado</summary><pre className="whitespace-pre-wrap font-mono text-[11.5px]">{c.output}</pre></details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[12.5px] text-lab-muted">Modelo: {exes.length} chamada(s) · {fmtInt(exes.reduce((n, e) => n + e.inputTokens + e.outputTokens, 0))} tokens · {fmtCost(exes.reduce((n, e) => n + e.costUsd, 0))}{exes.some((e) => e.status === 'retry') ? ` · ${exes.filter((e) => e.status === 'retry').length} retentativa(s)` : ''}</p>
      {msgs.length > 0 && <div><p className="px-label">Mensagens desta tarefa</p>{msgs.slice(-4).map((m) => <p key={m.id} className="text-[12.5px]"><Chip color={MESSAGE_TYPE[m.type]?.color}>{MESSAGE_TYPE[m.type]?.label ?? m.type}</Chip> {m.content.slice(0, 200)}</p>)}</div>}
      {!closed && task.agentId && (
        <div className="space-y-2 border-t border-white/5 pt-2">
          <Field label={`Orientar ${name(task.agentId)}`} hint="Entra no contexto da próxima chamada do agente; se ele já terminou, gera uma nova versão do que entregou.">
            <textarea className="px-input h-16" value={guide} onChange={(e) => setGuide(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button className="px-btn sm solid" disabled={guide.trim().length < 3} onClick={() => void platform.guidance(project.id, task.agentId!, guide.trim()).then(() => { toast('Orientação enviada', 'success'); setGuide(''); void data.reload() }).catch((e: Error) => toast(e.message, 'error'))}><Send size={13} /> Enviar orientação</button>
            <button className="px-btn sm" onClick={() => nav.go('revisao', { taskId: task.id })}><MessageSquarePlus size={13} /> Feedback nesta tarefa</button>
          </div>
        </div>
      )}
    </Panel>
  )
}

type Ev = { at: string; who: string | null; text: string; color: string; taskId: string | null }

/** Histórico de eventos persistidos: início/fim de tarefas, chamadas de modelo e uso de ferramentas. */
function EventHistory({ data, nav, executionsCount }: { data: WorkspaceData; nav: Nav; executionsCount: number }) {
  const { project, toolCalls, executions } = data
  const name = useAgentName()
  const [kind, setKind] = useState<'tudo' | 'tarefas' | 'modelo' | 'ferramentas'>('tudo')
  const events = useMemo(() => {
    const out: Ev[] = []
    const tasks = project.tasks ?? []
    const key = (id: string | null) => tasks.find((t) => t.id === id)?.key ?? ''
    if (kind === 'tudo' || kind === 'tarefas') {
      for (const t of tasks) {
        if (t.startedAt) out.push({ at: t.startedAt, who: t.agentId, text: `iniciou ${t.key} “${t.title}”`, color: '#39d6ff', taskId: t.id })
        if (t.finishedAt) out.push({ at: t.finishedAt, who: t.agentId, text: `${t.status === 'done' ? 'concluiu' : t.status === 'failed' ? 'falhou em' : 'encerrou'} ${t.key}`, color: TASK_STATUS[t.status].color, taskId: t.id })
      }
    }
    if (kind === 'tudo' || kind === 'modelo') {
      for (const e of executions) out.push({ at: e.createdAt, who: e.agentId, text: `${e.status === 'retry' ? 'retentativa' : e.status === 'error' ? 'erro' : 'chamada'} ${e.purpose} ${key(e.taskId)} · ${e.provider}/${e.model}${e.status === 'ok' ? ` · ${fmtInt(e.inputTokens + e.outputTokens)} tokens` : ` · ${e.error.slice(0, 90)}`}`, color: e.status === 'ok' ? '#9d62ff' : '#ff537a', taskId: e.taskId })
    }
    if (kind === 'tudo' || kind === 'ferramentas') {
      for (const c of toolCalls) out.push({ at: c.createdAt, who: c.agentId, text: `${TOOL_LABEL[c.tool] ?? c.tool} ${key(c.taskId)}: ${c.input.slice(0, 90)}`, color: c.status === 'ok' ? '#ffb800' : '#ff537a', taskId: c.taskId })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200)
  }, [project.tasks, executions, toolCalls, kind])
  return (
    <Panel accent="gold" title={`Histórico de eventos (${events.length})`} data-testid="event-history" actions={
      <select className="px-input w-auto py-1 text-[12px]" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Filtrar eventos">
        <option value="tudo">Tudo</option><option value="tarefas">Tarefas</option><option value="modelo">Chamadas de modelo ({executionsCount})</option><option value="ferramentas">Ferramentas ({toolCalls.length})</option>
      </select>
    }>
      {events.length === 0 ? <Empty>Nenhum evento ainda.</Empty> : (
        <ol className="max-h-[360px] space-y-1 overflow-auto pr-1 text-[12.5px]">
          {events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-[68px] shrink-0 font-mono text-lab-muted">{fmtClock(e.at)}</span>
              <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <button className="min-w-0 text-left hover:underline" onClick={() => e.taskId && nav.go('execucao', { taskId: e.taskId })}><b>{name(e.who)}</b> {e.text}</button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
