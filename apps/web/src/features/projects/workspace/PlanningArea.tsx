import { useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { Project, ProjectTask } from '@/types/platform'
import { platform, TASK_KIND } from '@/services/platform'
import { useUiStore } from '@/stores/uiStore'
import { Avatar, Chip, Field, Panel } from '@/components/ui/primitives'
import { fmtCost, fmtDate } from '@/lib/format'
import { Empty, TASK_STATUS, stages, useAgentName, useTeam, type Nav } from './shared'

/** Planejamento: revisão/aprovação do plano e, depois, o plano aprovado (registro imutável) e o fluxo de dependências. */
export function PlanningArea({ project, onDone, nav }: { project: Project; onDone: () => void; nav: Nav }) {
  if (project.status === 'planning') return <Empty>O coordenador está interpretando a solicitação e montando o plano…</Empty>
  if (project.status === 'awaiting_approval') return <PlanReview project={project} onDone={onDone} />
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <FlowBoard project={project} nav={nav} />
      <PlanSummary project={project} />
    </div>
  )
}

function PlanSummary({ project }: { project: Project }) {
  const plan = project.plan ?? {}
  const approved = plan.plano_aprovado
  const name = useAgentName()
  const extra = (project.tasks ?? []).filter((t) => approved && !approved.tarefas.some((a) => a.key === t.key))
  return (
    <Panel accent="gold" title="Plano aprovado" bodyClassName="space-y-3 text-[13px]">
      {plan.objetivo && <p><b>Objetivo:</b> {plan.objetivo}</p>}
      {plan.escopo && <p><b>Escopo:</b> {plan.escopo}</p>}
      {!!plan.entregaveis?.length && <p><b>Entregáveis:</b> {plan.entregaveis.join(' · ')}</p>}
      {!!plan.criterios_qualidade?.length && <p><b>Critérios de qualidade:</b> {plan.criterios_qualidade.join(' · ')}</p>}
      {approved ? (
        <>
          <p className="text-[12px] text-lab-muted">Aprovado em {fmtDate(approved.aprovadoEm)}{approved.nota ? ` — “${approved.nota}”` : ''}. Este registro não muda quando tarefas de revisão são adicionadas.</p>
          <ol className="space-y-1">
            {approved.tarefas.map((t) => (
              <li key={t.key} className="flex gap-2 rounded-[5px] bg-white/[0.04] px-2 py-1.5">
                <span className="font-mono font-bold text-neon-cyan">{t.key}</span>
                <span className="min-w-0 flex-1"><b>{t.title}</b><span className="block text-[12px] text-lab-muted">{TASK_KIND[t.kind]} · {name(t.agentId)}{t.dependsOn.length ? ` · depende de ${t.dependsOn.join(', ')}` : ''}</span></span>
              </li>
            ))}
          </ol>
        </>
      ) : <p className="text-[12px] text-lab-muted">Projeto anterior ao registro do plano aprovado.</p>}
      {extra.length > 0 && (
        <div>
          <p className="px-label">Tarefas criadas depois da aprovação (revisões e feedback)</p>
          <p className="text-[12.5px]">{extra.map((t) => `${t.key} — ${t.title}`).join(' · ')}</p>
        </div>
      )}
    </Panel>
  )
}

/** Fluxo por etapas: tarefas da mesma etapa podem rodar em paralelo; setas indicam dependências. */
function FlowBoard({ project, nav }: { project: Project; nav: Nav }) {
  const team = useTeam(project)
  const cols = stages(project.tasks ?? [])
  return (
    <Panel accent="cyan" title="Fluxo de trabalho (dependências)" data-testid="flow-board">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map((col, i) => (
          <div key={i} className="flex min-w-[220px] flex-1 flex-col gap-2">
            <p className="px-label">Etapa {i + 1}{col.length > 1 ? ' · em paralelo' : ''}</p>
            {col.map((t) => {
              const a = team.find((x) => x.id === t.agentId)
              const s = TASK_STATUS[t.status]
              return (
                <button key={t.id} onClick={() => nav.go('execucao', { taskId: t.id })} className="px-inset flex flex-col gap-1 p-2.5 text-left text-[13px] hover:brightness-125" style={{ borderLeft: `3px solid ${s.color}` }}>
                  <span className="flex items-center gap-2"><span className="font-mono font-bold text-neon-cyan">{t.key}</span><Chip color={s.color}>{s.label}</Chip></span>
                  <b className="leading-snug">{t.title}</b>
                  <span className="flex items-center gap-1.5 text-[12px] text-lab-muted">{a && <Avatar characterId={a.appearance.characterId} size={20} />}{a?.name ?? '—'} · {TASK_KIND[t.kind]}</span>
                  {t.dependsOn.length > 0 && <span className="text-[11.5px] text-lab-muted">← {t.dependsOn.join(', ')}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function PlanReview({ project, onDone }: { project: Project; onDone: () => void }) {
  const team = useTeam(project)
  const toast = useUiStore((s) => s.toast)
  const [tasks, setTasks] = useState<ProjectTask[]>(project.tasks ?? [])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(tasks) !== JSON.stringify(project.tasks ?? [])
  const plan = project.plan ?? {}
  const upd = (i: number, patch: Partial<ProjectTask>) => setTasks(tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok, 'success'); onDone() } catch (err) { toast((err as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Panel accent="gold" title="Plano proposto pelo coordenador — revise e aprove" data-testid="plan-review" bodyClassName="text-[13px]">
      <div className="mb-4 grid gap-2.5 md:grid-cols-2">
        <p><b>Objetivo:</b> {plan.objetivo}</p>
        <p><b>Escopo:</b> {plan.escopo}</p>
        {!!plan.subtemas?.length && <p><b>Subtemas:</b> {plan.subtemas.join(' · ')}</p>}
        {!!plan.entregaveis?.length && <p><b>Entregáveis:</b> {plan.entregaveis.join(' · ')}</p>}
        {!!plan.criterios_qualidade?.length && <p className="md:col-span-2"><b>Critérios de qualidade:</b> {plan.criterios_qualidade.join(' · ')}</p>}
        {plan.estimativa_custo_usd !== undefined && <p className="text-[12px] text-lab-muted md:col-span-2">Estimativa aproximada de custo: {fmtCost(plan.estimativa_custo_usd)} — o custo real é registrado por chamada na área Custos.</p>}
      </div>
      <div className="mb-1 hidden grid-cols-[56px_1fr_160px_200px_150px_32px] gap-2 px-2 text-[11.5px] font-bold uppercase tracking-wide text-lab-muted lg:grid">
        <span>Chave</span><span>Tarefa</span><span>Tipo</span><span>Agente</span><span>Depende de</span><span />
      </div>
      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={t.id} className="px-inset grid grid-cols-1 gap-2 p-2.5 lg:grid-cols-[56px_1fr_160px_200px_150px_32px]">
            <span className="self-center font-mono text-[14px] font-bold text-neon-cyan">{t.key}</span>
            <input className="px-input" value={t.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label={`Título ${t.key}`} />
            <select className="px-input" value={t.kind} onChange={(e) => upd(i, { kind: e.target.value as ProjectTask['kind'] })} aria-label={`Tipo ${t.key}`}>
              {['research', 'analysis', 'writing', 'review', 'general'].map((k) => <option key={k} value={k}>{TASK_KIND[k]}</option>)}
            </select>
            <select className="px-input" value={t.agentId ?? ''} onChange={(e) => upd(i, { agentId: e.target.value })} aria-label={`Agente ${t.key}`}>
              {team.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
            <input className="px-input font-mono" value={t.dependsOn.join(', ')} onChange={(e) => upd(i, { dependsOn: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} title="Chaves separadas por vírgula" aria-label={`Dependências ${t.key}`} />
            <button className="self-center text-lab-muted hover:text-neon-pink" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} aria-label={`Remover ${t.key}`}><Trash2 size={16} /></button>
            {t.description && <p className="text-[12.5px] text-lab-muted lg:col-span-6">{t.description}</p>}
          </div>
        ))}
        <button className="px-btn sm ghost" onClick={() => setTasks([...tasks, { ...(tasks[tasks.length - 1] ?? {}), id: `novo-${tasks.length}`, key: `N${tasks.length + 1}`, title: 'Nova tarefa', description: '', kind: 'general', dependsOn: [], status: 'proposed' } as ProjectTask])}><Plus size={14} /> Adicionar tarefa</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1"><Field label="Observação (opcional)"><input className="px-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: inclua também drones autônomos" /></Field></div>
        {dirty && <button className="px-btn" disabled={busy} onClick={() => void run(() => platform.editPlan(project.id, tasks), 'Plano ajustado')}>Salvar ajustes</button>}
        <button className="px-btn" style={{ ['--c' as string]: '#ff537a' }} disabled={busy} onClick={() => void run(() => platform.decidePlan(project.id, false, note), 'Plano devolvido ao coordenador')}><X size={14} /> Pedir novo plano</button>
        <button className="px-btn solid" disabled={busy || dirty} title={dirty ? 'Salve os ajustes antes de aprovar' : undefined} onClick={() => void run(() => platform.decidePlan(project.id, true, note), 'Plano aprovado — execução iniciada')} data-testid="plan-approve"><Check size={14} /> Aprovar e iniciar</button>
      </div>
    </Panel>
  )
}
