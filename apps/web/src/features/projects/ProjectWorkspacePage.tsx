import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, FileText, GitCompare, MessageSquarePlus, Pause, Play, Plus, Send, Square, Trash2, X } from 'lucide-react'
import type { AgentMessage, Artifact, ArtifactContent, Evidence, Execution, Project, ProjectTask } from '@/types/platform'
import { appConfig } from '@/services/config'
import { MESSAGE_TYPE, platform, PROJECT_STATUS, TASK_KIND } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { Avatar, Chip, Field, Panel, ProgressBar, Tabs, cx } from '@/components/ui/primitives'
import { Markdown } from '@/components/ui/Markdown'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtClock, fmtCost, fmtDate, fmtInt } from '@/lib/format'

type T = 'tarefas' | 'mensagens' | 'documentos' | 'evidencias' | 'custos'

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposta', color: '#8b97c4' }, pending: { label: 'Aguardando', color: '#8b97c4' }, running: { label: 'Em execução', color: '#39d6ff' },
  done: { label: 'Concluída', color: '#00f5a0' }, failed: { label: 'Falhou', color: '#ff537a' }, cancelled: { label: 'Cancelada', color: '#8a93b0' },
}

/** Espaço de trabalho do projeto: plano, aprovação, execução ao vivo, documentos, evidências e custos. */
export default function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const toast = useUiStore((s) => s.toast)
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [tab, setTab] = useState<T>('tarefas')
  const [error, setError] = useState('')
  const real = appConfig.mode === 'real'

  const load = useCallback(async () => {
    try {
      const [p, m, a, e, x] = await Promise.all([platform.project(projectId), platform.messages(projectId), platform.artifacts(projectId), platform.evidence(projectId), platform.executions(projectId)])
      setProject(p); setMessages(m); setArtifacts(a); setEvidence(e); setExecutions(x); setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }, [projectId])

  useEffect(() => {
    if (!real) return
    void load()
    let t: ReturnType<typeof setTimeout> | null = null
    const off = onPlatformEvent((e) => {
      if (e.projectId !== projectId || t) return
      t = setTimeout(() => { t = null; void load() }, 350)
    })
    return () => { off(); if (t) clearTimeout(t) }
  }, [real, load, projectId])

  if (!real) return <OfflineNotice what="Projetos" />
  if (error && !project) return <Panel title="Projeto"><p className="text-neon-pink">{error}</p><Link to="/projetos" className="text-neon-cyan">← Projetos</Link></Panel>
  if (!project) return <p className="title-pixel animate-blink p-6 text-[10px] text-lab-muted">Carregando…</p>

  const st = PROJECT_STATUS[project.status]
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok, 'success'); await load() } catch (err) { toast((err as Error).message, 'error') }
  }
  const report = artifacts.find((a) => a.kind === 'report')

  return (
    <div className="flex flex-col gap-2.5" data-testid="project-workspace">
      <div className="px-panel flex flex-wrap items-center gap-3 px-3 py-2" style={{ ['--c' as string]: st?.color }}>
        <Link to="/projetos" className="text-lab-muted hover:text-white" aria-label="Voltar"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[16px] font-extrabold">{project.title} <Chip color={st?.color}>{st?.label}</Chip></h1>
          <p className="line-clamp-2 text-[11.5px] text-lab-muted">{project.request}</p>
        </div>
        <div className="text-right text-[11px]">
          <p><b>{fmtCost(project.costUsd)}</b> de {fmtCost(project.budgetUsd)} <span className="text-lab-muted">(estimativa)</span></p>
          <p className="text-lab-muted">{project.llmCalls} chamadas · {project.tasksDone}/{project.tasksTotal} tarefas</p>
        </div>
        <div className="flex gap-1.5">
          {['running', 'revising'].includes(project.status) && <button className="px-btn sm" style={{ ['--c' as string]: '#ffb800' }} onClick={() => void act(() => platform.control(project.id, 'pause'), 'Execução pausada')}><Pause size={13} /> Pausar</button>}
          {project.status === 'paused' && <button className="px-btn sm solid" onClick={() => void act(() => platform.control(project.id, 'resume'), 'Execução retomada')}><Play size={13} /> Retomar</button>}
          {!['completed', 'cancelled', 'failed'].includes(project.status) && <button className="px-btn sm" style={{ ['--c' as string]: '#ff537a' }} onClick={() => void act(() => platform.control(project.id, 'cancel'), 'Projeto cancelado')} data-testid="project-cancel"><Square size={13} /> Cancelar</button>}
        </div>
      </div>

      {project.error && <p className="rounded-[6px] border border-neon-pink/50 bg-neon-pink/10 px-3 py-2 text-[12px] text-neon-pink" data-testid="project-error">{project.error}</p>}
      {project.status === 'paused' && <BudgetEditor project={project} onSaved={load} />}
      {project.status === 'planning' && <p className="animate-pulse rounded-[6px] bg-white/5 px-3 py-2 text-[12px]">O coordenador está interpretando a solicitação e montando o plano…</p>}
      {project.status === 'awaiting_approval' && <PlanReview project={project} onDone={load} />}
      {project.status === 'delivered' && report && <DeliveryReview project={project} report={report} onDone={load} />}

      <Tabs value={tab} onChange={setTab} items={[
        { id: 'tarefas', label: `Tarefas (${project.tasks?.length ?? 0})` }, { id: 'mensagens', label: `Mensagens (${messages.length})` },
        { id: 'documentos', label: `Documentos (${artifacts.length})` }, { id: 'evidencias', label: `Evidências (${evidence.length})` }, { id: 'custos', label: `Execuções e custos (${executions.length})` },
      ]} />
      {tab === 'tarefas' && <TaskBoard project={project} onGuide={load} />}
      {tab === 'mensagens' && <MessageTimeline messages={messages} />}
      {tab === 'documentos' && <Documents project={project} artifacts={artifacts} onFeedback={load} />}
      {tab === 'evidencias' && <EvidenceTable evidence={evidence} />}
      {tab === 'custos' && <ExecutionsTable executions={executions} />}
    </div>
  )
}

function useAgentName() {
  const agents = useLabStore((s) => s.agents)
  return useCallback((id: string | null, kind = 'agent') => (kind === 'user' ? 'Gestor (você)' : kind === 'system' ? 'Sistema' : agents.find((a) => a.id === id)?.name ?? '—'), [agents])
}

// ---------------------------------------------------------------------------
function PlanReview({ project, onDone }: { project: Project; onDone: () => void }) {
  const agents = useLabStore((s) => s.agents)
  const toast = useUiStore((s) => s.toast)
  const team = useMemo(() => agents.filter((a) => !project.organizationId || a.organizationId === project.organizationId), [agents, project.organizationId])
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
    <Panel accent="gold" title="Plano proposto pelo coordenador — revise e aprove" data-testid="plan-review">
      <div className="mb-3 grid gap-2 text-[11.5px] md:grid-cols-2">
        <p><b>Objetivo:</b> {plan.objetivo}</p>
        <p><b>Escopo:</b> {plan.escopo}</p>
        {!!plan.subtemas?.length && <p><b>Subtemas:</b> {plan.subtemas.join(' · ')}</p>}
        {!!plan.entregaveis?.length && <p><b>Entregáveis:</b> {plan.entregaveis.join(' · ')}</p>}
        {!!plan.criterios_qualidade?.length && <p className="md:col-span-2"><b>Critérios de qualidade:</b> {plan.criterios_qualidade.join(' · ')}</p>}
        {plan.estimativa_custo_usd !== undefined && <p className="text-lab-muted">Estimativa grosseira de custo: {fmtCost(plan.estimativa_custo_usd)} (aproximação; o custo real é registrado por chamada).</p>}
      </div>
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <div key={t.id} className="px-inset grid grid-cols-1 gap-1.5 p-2 text-[11.5px] lg:grid-cols-[48px_1fr_150px_190px_150px_28px]">
            <span className="font-mono font-bold text-neon-cyan">{t.key}</span>
            <input className="px-input py-1" value={t.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label={`Título ${t.key}`} />
            <select className="px-input py-1" value={t.kind} onChange={(e) => upd(i, { kind: e.target.value as ProjectTask['kind'] })} aria-label={`Tipo ${t.key}`}>
              {['research', 'analysis', 'writing', 'review', 'general'].map((k) => <option key={k} value={k}>{TASK_KIND[k]}</option>)}
            </select>
            <select className="px-input py-1" value={t.agentId ?? ''} onChange={(e) => upd(i, { agentId: e.target.value })} aria-label={`Agente ${t.key}`}>
              {team.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input className="px-input py-1 font-mono" value={t.dependsOn.join(', ')} onChange={(e) => upd(i, { dependsOn: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} title="Depende de (chaves separadas por vírgula)" aria-label={`Dependências ${t.key}`} />
            <button className="text-lab-muted hover:text-neon-pink" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} aria-label={`Remover ${t.key}`}><Trash2 size={14} /></button>
            {t.description && <p className="text-[10.5px] text-lab-muted lg:col-span-6">{t.description}</p>}
          </div>
        ))}
        <button className="px-btn sm ghost" onClick={() => setTasks([...tasks, { ...(tasks[tasks.length - 1] ?? {}), id: `novo-${tasks.length}`, key: `N${tasks.length + 1}`, title: 'Nova tarefa', description: '', kind: 'general', dependsOn: [], status: 'proposed' } as ProjectTask])}><Plus size={13} /> Adicionar tarefa</button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1"><Field label="Observação (opcional)"><input className="px-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: inclua também drones autônomos" /></Field></div>
        {dirty && <button className="px-btn" disabled={busy} onClick={() => void run(() => platform.editPlan(project.id, tasks), 'Plano ajustado')}>Salvar ajustes</button>}
        <button className="px-btn" style={{ ['--c' as string]: '#ff537a' }} disabled={busy} onClick={() => void run(() => platform.decidePlan(project.id, false, note), 'Plano devolvido ao coordenador')}><X size={13} /> Pedir novo plano</button>
        <button className="px-btn solid" disabled={busy || dirty} title={dirty ? 'Salve os ajustes antes de aprovar' : undefined} onClick={() => void run(() => platform.decidePlan(project.id, true, note), 'Plano aprovado — execução iniciada')} data-testid="plan-approve"><Check size={13} /> Aprovar e iniciar</button>
      </div>
    </Panel>
  )
}

function DeliveryReview({ project, report, onDone }: { project: Project; report: Artifact; onDone: () => void }) {
  const toast = useUiStore((s) => s.toast)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok, 'success'); setText(''); onDone() } catch (err) { toast((err as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Panel accent="purple" title={`Entrega pronta: “${report.title}” (v${report.currentVersion})`}>
      <p className="mb-2 text-[11.5px] text-lab-muted">Leia o documento na aba Documentos. Aprove a entrega ou descreva o que precisa mudar — o agente responsável criará uma nova versão.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1"><Field label="Feedback para revisão"><textarea className="px-input h-16" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: inclua uma seção sobre riscos regulatórios e certificação." data-testid="feedback-text" /></Field></div>
        <button className="px-btn" disabled={busy || text.trim().length < 3} onClick={() => void run(() => platform.feedback(project.id, report.id, text.trim()), 'Feedback enviado — revisão iniciada')} data-testid="feedback-send"><MessageSquarePlus size={13} /> Solicitar revisão</button>
        <button className="px-btn solid" disabled={busy} onClick={() => void run(() => platform.decideDelivery(project.id, true), 'Entrega aprovada')} data-testid="delivery-approve"><Check size={13} /> Aprovar entrega</button>
      </div>
    </Panel>
  )
}

function BudgetEditor({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const toast = useUiStore((s) => s.toast)
  const [v, setV] = useState(Math.max(project.budgetUsd * 2, project.costUsd + 0.5))
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-neon-gold/50 bg-neon-gold/10 px-3 py-2 text-[12px]">
      Execução pausada. Ajuste o orçamento se necessário e clique em Retomar.
      <input type="number" step={0.5} min={0.01} className="px-input w-28 py-1" value={v} onChange={(e) => setV(+e.target.value)} aria-label="Novo orçamento" />
      <button className="px-btn sm" onClick={() => void platform.setBudget(project.id, v).then(() => { toast('Orçamento atualizado', 'success'); onSaved() })}>Salvar orçamento</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
function TaskBoard({ project, onGuide }: { project: Project; onGuide: () => void }) {
  const agents = useLabStore((s) => s.agents)
  const toast = useUiStore((s) => s.toast)
  const [guide, setGuide] = useState<{ agentId: string; text: string } | null>(null)
  const tasks = project.tasks ?? []
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="task-board">
      {tasks.map((t) => {
        const a = agents.find((x) => x.id === t.agentId)
        const s = TASK_STATUS[t.status]
        return (
          <article key={t.id} className="px-panel flex flex-col gap-1.5 p-3 text-[11.5px]" style={{ ['--c' as string]: s.color }} data-testid="task-card">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-neon-cyan">{t.key}</span>
              <b className="min-w-0 flex-1 truncate">{t.title}</b>
              <Chip color={s.color}>{s.label}</Chip>
            </div>
            <p className="flex items-center gap-1.5 text-lab-muted">{a && <Avatar characterId={a.appearance.characterId} size={22} />}{a?.name ?? '—'} · {TASK_KIND[t.kind]}</p>
            {t.dependsOn.length > 0 && <p className="text-[10.5px] text-lab-muted">Depende de: {t.dependsOn.join(', ')}</p>}
            {t.status === 'running' && <><ProgressBar value={t.stepsTotal ? t.stepsDone / t.stepsTotal : 0} height={6} /><p className="text-[10.5px] text-neon-cyan">Etapa {Math.min(t.stepsDone + 1, t.stepsTotal)}/{t.stepsTotal}: {t.step}</p></>}
            {t.error && <p className="text-[10.5px] text-neon-pink">{t.error}</p>}
            {t.finishedAt && <p className="text-[10px] text-lab-muted">Concluída {fmtClock(t.finishedAt)}</p>}
            {t.agentId && !['completed', 'cancelled'].includes(project.status) && (
              <button className="mt-auto self-start text-[10.5px] font-bold text-neon-purple hover:underline" onClick={() => setGuide({ agentId: t.agentId!, text: '' })}>Orientar agente</button>
            )}
          </article>
        )
      })}
      {guide && (
        <div className="px-panel c-purple p-3 md:col-span-2 xl:col-span-3">
          <Field label={`Orientação para ${agents.find((a) => a.id === guide.agentId)?.name}`} hint="Entra no contexto da próxima chamada do agente; se ele já terminou, gera uma nova versão do que entregou.">
            <textarea className="px-input h-16" value={guide.text} onChange={(e) => setGuide({ ...guide, text: e.target.value })} />
          </Field>
          <div className="mt-2 flex gap-2">
            <button className="px-btn sm solid" disabled={guide.text.trim().length < 3} onClick={() => void platform.guidance(project.id, guide.agentId, guide.text.trim()).then(() => { toast('Orientação enviada', 'success'); setGuide(null); onGuide() }).catch((e: Error) => toast(e.message, 'error'))}><Send size={13} /> Enviar</button>
            <button className="px-btn sm ghost" onClick={() => setGuide(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageTimeline({ messages }: { messages: AgentMessage[] }) {
  const name = useAgentName()
  return (
    <Panel accent="cyan" title="Comunicação estruturada entre agentes e gestor">
      {messages.length === 0 ? <p className="text-[12px] text-lab-muted">Sem mensagens.</p> : (
        <ol className="space-y-1.5" data-testid="message-timeline">
          {messages.map((m) => {
            const t = MESSAGE_TYPE[m.type]
            return (
              <li key={m.id} className="rounded-[6px] bg-white/[0.04] p-2 text-[11.5px]">
                <p className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-lab-muted"><Chip color={t?.color}>{t?.label ?? m.type}</Chip><b className="text-lab-text">{name(m.fromAgentId, m.fromKind)}</b> → {m.toKind === 'user' ? 'Gestor (você)' : m.toAgentId ? name(m.toAgentId) : 'equipe'} · {fmtClock(m.createdAt)}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function Documents({ project, artifacts, onFeedback }: { project: Project; artifacts: Artifact[]; onFeedback: () => void }) {
  const name = useAgentName()
  const toast = useUiStore((s) => s.toast)
  const [sel, setSel] = useState<string | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [content, setContent] = useState<ArtifactContent | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [fb, setFb] = useState('')
  const art = artifacts.find((a) => a.id === sel) ?? artifacts.find((a) => a.kind === 'report') ?? artifacts[0]
  const v = version ?? art?.currentVersion
  useEffect(() => {
    if (!art) return
    setDiff(null)
    platform.artifact(project.id, art.id, v).then(setContent).catch(() => setContent(null))
  }, [project.id, art, v])
  if (!art) return <Panel title="Documentos"><p className="text-[12px] text-lab-muted">Nenhum documento produzido ainda.</p></Panel>
  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Panel accent="purple" title="Documentos do projeto">
        <ul className="space-y-1">
          {artifacts.map((a) => (
            <li key={a.id}>
              <button className={cx('w-full rounded-[5px] px-2 py-1.5 text-left text-[11.5px]', a.id === art.id ? 'bg-neon-purple/20' : 'hover:bg-white/5')} onClick={() => { setSel(a.id); setVersion(null) }}>
                <span className="flex items-center gap-1.5 font-bold"><FileText size={13} />{a.title}</span>
                <span className="text-[10px] text-lab-muted">{name(a.agentId)} · v{a.currentVersion}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel accent="cyan" title={art.title} actions={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select className="px-input w-auto py-0.5 text-[11px]" value={v} onChange={(e) => setVersion(+e.target.value)} aria-label="Versão">
            {art.versions.map((x) => <option key={x.version} value={x.version}>v{x.version} · {fmtDate(x.createdAt)}</option>)}
          </select>
          {art.currentVersion > 1 && <button className="px-btn sm ghost" onClick={() => void platform.diff(project.id, art.id, Math.max(1, (v ?? 2) - 1), v ?? 2).then((d) => setDiff(d.diff))} disabled={(v ?? 1) < 2} title="Comparar com a versão anterior"><GitCompare size={13} /> Diff</button>}
          <a className="px-btn sm" href={platform.downloadUrl(project.id, art.id, v)} download><Download size={13} /> .md</a>
        </div>
      }>
        {content?.note && <p className="mb-2 text-[10.5px] text-lab-muted">Nota da versão: {content.note}</p>}
        {diff !== null ? (
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-[5px] bg-[#050913] p-2 font-mono text-[11px]" data-testid="diff-view">
            {diff.split('\n').map((l, i) => <span key={i} className={l.startsWith('+') ? 'text-neon-green' : l.startsWith('-') ? 'text-neon-pink' : 'text-lab-muted'}>{l}{'\n'}</span>)}
          </pre>
        ) : content ? <div className="max-h-[560px] overflow-auto pr-1" data-testid="document-view"><Markdown source={content.content} /></div> : null}
        {!['completed', 'cancelled'].includes(project.status) && (
          <div className="mt-3 flex items-end gap-2 border-t border-white/5 pt-2">
            <div className="flex-1"><Field label="Feedback neste documento"><input className="px-input" value={fb} onChange={(e) => setFb(e.target.value)} placeholder="O que deve mudar?" /></Field></div>
            <button className="px-btn sm" disabled={fb.trim().length < 3} onClick={() => void platform.feedback(project.id, art.id, fb.trim()).then(() => { toast('Revisão solicitada', 'success'); setFb(''); onFeedback() }).catch((e: Error) => toast(e.message, 'error'))}><Send size={13} /> Enviar</button>
          </div>
        )}
      </Panel>
    </div>
  )
}

function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  const name = useAgentName()
  return (
    <Panel accent="green" title="Evidências registradas (fontes reais consultadas pelas ferramentas)">
      {evidence.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhuma fonte registrada.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]" data-testid="evidence-table">
            <thead className="text-left text-lab-muted"><tr><th className="pb-1">Código</th><th>Título</th><th>Autores / ano</th><th>Fonte</th><th>Acesso</th><th>Registrado por</th></tr></thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id} className="border-t border-white/5 align-top">
                  <td className="py-1 font-mono font-bold text-neon-cyan">{e.code}</td>
                  <td className="max-w-[420px]"><a href={e.doi ? `https://doi.org/${e.doi}` : e.url} target="_blank" rel="noreferrer noopener" className="hover:text-neon-cyan hover:underline">{e.title}</a>
                    {e.abstract && <details><summary className="cursor-pointer text-[10px] text-lab-muted">resumo</summary><p className="text-[10.5px] text-lab-muted">{e.abstract}</p></details>}</td>
                  <td className="text-lab-muted">{e.authors.split(',').slice(0, 3).join(',')}{e.authors.split(',').length > 3 ? ' et al.' : ''} ({e.year ?? 's.d.'})</td>
                  <td>{e.source}{e.doi && <span className="block font-mono text-[10px] text-lab-muted">doi:{e.doi}</span>}</td>
                  <td>{e.fullText ? <Chip color="#00f5a0">texto completo</Chip> : <Chip color="#ffb800">apenas resumo</Chip>}</td>
                  <td className="text-lab-muted">{name(e.agentId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-lab-muted">A seção de referências dos relatórios é gerada pelo sistema a partir destas evidências; citações a códigos inexistentes são apontadas na revisão.</p>
    </Panel>
  )
}

function ExecutionsTable({ executions }: { executions: Execution[] }) {
  const name = useAgentName()
  const total = executions.reduce((s, e) => s + e.costUsd, 0)
  return (
    <Panel accent="gold" title={`Chamadas de modelo · total ${fmtCost(total)} (estimativa)`}>
      {executions.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhuma chamada registrada.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]" data-testid="executions-table">
            <thead className="text-left text-lab-muted"><tr><th className="pb-1">Hora</th><th>Agente</th><th>Finalidade</th><th>Modelo</th><th>Tokens (in/out)</th><th>Latência</th><th className="text-right">Custo</th></tr></thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-1">{fmtClock(e.createdAt)}</td>
                  <td>{name(e.agentId)}</td>
                  <td className={e.status === 'error' ? 'text-neon-pink' : ''}>{e.purpose}{e.status === 'error' && <span className="block text-[10px]">{e.error.slice(0, 120)}</span>}</td>
                  <td className="font-mono text-[10.5px]">{e.provider}/{e.model}</td>
                  <td>{fmtInt(e.inputTokens)} / {fmtInt(e.outputTokens)}</td>
                  <td>{(e.latencyMs / 1000).toFixed(1)} s</td>
                  <td className="text-right">{fmtCost(e.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
