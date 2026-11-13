import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Pause, Play, RefreshCcw, RotateCw, Square } from 'lucide-react'
import type { AgentMessage, Artifact, Evidence, Execution, Project, ToolCall } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform, PROJECT_STATUS } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { Chip, Field, Panel, ProgressBar, cx } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtCost } from '@/lib/format'
import type { Area, Nav, WorkspaceData } from './workspace/shared'
import { PlanningArea } from './workspace/PlanningArea'
import { ExecutionArea } from './workspace/ExecutionArea'
import { ConversationsArea } from './workspace/ConversationsArea'
import { DocumentsArea } from './workspace/DocumentsArea'
import { ReviewArea } from './workspace/ReviewArea'
import { CostsArea } from './workspace/CostsArea'

const AREAS: { id: Area; label: string }[] = [
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'execucao', label: 'Execução' },
  { id: 'conversas', label: 'Conversas' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'custos', label: 'Custos' },
]

/** Área mais útil para o estado atual do projeto. */
function defaultArea(p: Project): Area {
  if (['planning', 'awaiting_approval'].includes(p.status)) return 'planejamento'
  if (p.status === 'delivered') return 'revisao'
  if (p.status === 'completed') return 'documentos'
  return 'execucao'
}

/** Espaço de trabalho do projeto: áreas separadas por abas, com painéis contextuais. Tudo vem do backend real. */
export default function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const toast = useUiStore((s) => s.toast)
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState('')
  const [reanalyze, setReanalyze] = useState(false)
  const real = appConfig.mode === 'real'

  const load = useCallback(async () => {
    try {
      const [p, m, a, e, x, tc] = await Promise.all([platform.project(projectId), platform.messages(projectId), platform.artifacts(projectId), platform.evidence(projectId),
        platform.executions(projectId), platform.toolCalls(projectId).catch(() => [])])
      setProject(p); setMessages(m); setArtifacts(a); setEvidence(e); setExecutions(x); setToolCalls(tc); setError('')
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

  const area = (params.get('area') as Area | null) ?? (project ? defaultArea(project) : 'planejamento')
  const focus = useMemo(() => ({ artifactId: params.get('doc') ?? undefined, taskId: params.get('tarefa') ?? undefined }), [params])
  const nav: Nav = useMemo(() => ({
    focus,
    go: (a, f) => {
      const next = new URLSearchParams()
      next.set('area', a)
      if (f?.artifactId) next.set('doc', f.artifactId)
      if (f?.taskId) next.set('tarefa', f.taskId)
      setParams(next, { replace: true })
    },
  }), [focus, setParams])

  if (!real) return <OfflineNotice what="Projetos" />
  if (error && !project) return <Panel title="Projeto"><p className="text-neon-pink">{error}</p><Link to="/projetos" className="text-neon-cyan">← Projetos</Link></Panel>
  if (!project) return <p className="title-pixel animate-blink p-6 text-[10px] text-lab-muted">Carregando…</p>

  const data: WorkspaceData = { project, messages, artifacts, evidence, executions, toolCalls, reload: load }
  const st = PROJECT_STATUS[project.status]
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok, 'success'); await load() } catch (err) { toast((err as Error).message, 'error') }
  }
  const decisions = messages.filter((m) => m.needsDecision && m.status === 'pending')
  const tasks = project.tasks ?? []
  const counts: Partial<Record<Area, string>> = {
    execucao: tasks.length ? `${project.tasksDone}/${project.tasksTotal}` : '',
    conversas: String(messages.length),
    documentos: String(artifacts.length),
    revisao: project.status === 'delivered' ? '!' : '',
    custos: fmtCost(project.costUsd),
  }
  const decisionArea = (text: string): Area => (/plano/i.test(text) ? 'planejamento' : /entrega|revisor/i.test(text) ? 'revisao' : /orçamento|chamadas/i.test(text) ? 'custos' : 'execucao')

  return (
    <div className="flex flex-col gap-3 text-[13.5px]" data-testid="project-workspace">
      <header className="px-panel flex flex-wrap items-start gap-4 px-4 py-3" style={{ ['--c' as string]: st?.color }}>
        <Link to="/projetos" className="mt-1 text-lab-muted hover:text-white" aria-label="Voltar"><ArrowLeft size={20} /></Link>
        <div className="min-w-[260px] flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[19px] font-extrabold leading-tight">{project.title} <Chip color={st?.color}>{st?.label}</Chip></h1>
          <p className="mt-1 line-clamp-2 max-w-[980px] text-[13px] leading-relaxed text-lab-muted">{project.request}</p>
        </div>
        <div className="min-w-[220px] space-y-1 text-[13px]">
          <p className="flex justify-between gap-3"><span className="text-lab-muted">Tarefas</span><b>{project.tasksDone}/{project.tasksTotal}</b></p>
          <ProgressBar value={project.tasksTotal ? project.tasksDone / project.tasksTotal : 0} height={6} />
          <p className="flex justify-between gap-3"><span className="text-lab-muted">Custo (estimativa)</span><b>{fmtCost(project.costUsd)} / {fmtCost(project.budgetUsd)}</b></p>
        </div>
        <div className="flex flex-wrap gap-1.5 self-center">
          {['running', 'revising'].includes(project.status) && <button className="px-btn sm" style={{ ['--c' as string]: '#ffb800' }} onClick={() => void act(() => platform.control(project.id, 'pause'), 'Pausa solicitada — vale a partir da próxima etapa de cada agente')}><Pause size={14} /> Pausar</button>}
          {project.status === 'paused' && <button className="px-btn sm solid" onClick={() => void act(() => platform.control(project.id, 'resume'), 'Execução retomada')}><Play size={14} /> Retomar</button>}
          {['failed', 'awaiting_approval', 'paused', 'delivered', 'cancelled'].includes(project.status) && <button className="px-btn sm" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => setReanalyze(true)} data-testid="project-reanalyze"><RefreshCcw size={14} /> Reanalisar</button>}
          {tasks.some((t) => t.status === 'failed' || t.status === 'cancelled') && ['failed', 'paused'].includes(project.status) && <button className="px-btn sm" onClick={() => void act(() => platform.retry(project.id), 'Tarefas com falha reenviadas')} data-testid="project-retry"><RotateCw size={14} /> Repetir falhas</button>}
          {!['completed', 'cancelled', 'failed'].includes(project.status) && <button className="px-btn sm" style={{ ['--c' as string]: '#ff537a' }} onClick={() => void act(() => platform.control(project.id, 'cancel'), 'Projeto cancelado — chamadas em andamento interrompidas')} data-testid="project-cancel"><Square size={14} /> Cancelar</button>}
        </div>
      </header>

      {decisions.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[8px] border border-neon-gold/60 bg-neon-gold/10 px-4 py-3" data-testid="decision-banner">
          <p className="flex items-center gap-2 font-bold text-neon-gold"><AlertTriangle size={16} /> Decisão necessária</p>
          {decisions.slice(-3).map((m) => (
            <p key={m.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <span className="min-w-0 flex-1">{m.content}</span>
              <button className="px-btn sm" onClick={() => nav.go(decisionArea(m.content), { taskId: m.taskId ?? undefined })}>Abrir</button>
            </p>
          ))}
        </div>
      )}
      {project.error && <p className="rounded-[6px] border border-neon-pink/50 bg-neon-pink/10 px-4 py-2.5 text-[13px] text-neon-pink" data-testid="project-error">{project.error}</p>}

      <nav role="tablist" aria-label="Áreas do projeto" className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
        {AREAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={area === a.id} onClick={() => nav.go(a.id)} data-testid={`area-${a.id}`}
            className={cx('flex items-center gap-2 rounded-[5px] border px-4 py-2 text-[13.5px] font-bold transition-colors',
              area === a.id ? 'border-neon-green bg-neon-green text-[#04120c] shadow-[0_0_10px_-2px_#00f5a0]' : 'border-lab-line bg-[#0a1126] text-lab-muted hover:border-neon-green/60 hover:text-lab-text')}>
            {a.label}
            {counts[a.id] && <span className={cx('rounded-[3px] px-1.5 text-[11.5px]', area === a.id ? 'bg-black/20' : counts[a.id] === '!' ? 'bg-neon-gold text-black' : 'bg-white/10')}>{counts[a.id]}</span>}
          </button>
        ))}
      </nav>

      {area === 'planejamento' && <PlanningArea project={project} onDone={load} nav={nav} />}
      {area === 'execucao' && <ExecutionArea data={data} nav={nav} />}
      {area === 'conversas' && <ConversationsArea data={data} nav={nav} />}
      {area === 'documentos' && <DocumentsArea data={data} nav={nav} />}
      {area === 'revisao' && <ReviewArea data={data} nav={nav} />}
      {area === 'custos' && <CostsArea data={data} />}
      {reanalyze && <ReanalyzeModal project={project} onClose={() => setReanalyze(false)} onDone={load} />}
    </div>
  )
}

/** Reanalisar: refaz o plano — opcionalmente trocando provedor/modelo de toda a equipe. */
function ReanalyzeModal({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: () => void }) {
  const providers = useLabStore((s) => s.providers)
  const agents = useLabStore((s) => s.agents)
  const reload = useLabStore((s) => s.load)
  const toast = useUiStore((s) => s.toast)
  const team = agents.filter((a) => !project.organizationId || a.organizationId === project.organizationId)
  const enabled = providers.filter((p) => p.enabled)
  const [apply, setApply] = useState(/404|NotFound|no longer|desativado|not found|descontinu/i.test(project.error))
  const [provider, setProvider] = useState(team[0]?.intelligence.provider ?? enabled[0]?.id ?? 'gemini')
  const prov = providers.find((p) => p.id === provider)
  const [model, setModel] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const r = await platform.reanalyze(project.id, apply ? { provider, model, applyToTeam: true, note } : { note })
      toast(apply ? `Reanálise iniciada — ${r.agentsUpdated} agente(s) agora usam ${provider}/${model || prov?.defaultModel}` : 'Reanálise iniciada', 'success')
      await reload()
      onClose()
      onDone()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title="Reanalisar projeto" accent="cyan" width={560}
      footer={<><button className="px-btn ghost" onClick={onClose}>Cancelar</button><button className="px-btn solid" disabled={busy} onClick={() => void submit()} data-testid="reanalyze-submit"><RefreshCcw size={13} /> {busy ? 'Enviando…' : 'Reanalisar'}</button></>}>
      <div className="space-y-3 text-[12px]">
        <p className="text-lab-muted">O coordenador refaz o plano a partir da solicitação original. Tarefas não concluídas e aprovações pendentes são descartadas; documentos e custos já registrados permanecem.</p>
        {project.error && <p className="rounded-[5px] border border-neon-pink/40 bg-neon-pink/10 p-2 text-[11px] text-neon-pink">Último erro: {project.error.slice(0, 260)}</p>}
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="accent-[#00f5a0]" checked={apply} onChange={(e) => setApply(e.target.checked)} data-testid="reanalyze-apply" /> Trocar o modelo de IA de toda a equipe ({team.length} agentes)</label>
        {apply && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Provedor">
              <select className="px-input" value={provider} onChange={(e) => { setProvider(e.target.value as typeof provider); setModel('') }} data-testid="reanalyze-provider">
                {enabled.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Modelo" hint="Vazio = modelo padrão do provedor (Provedores e Custos)">
              <input className="px-input" list="reanalyze-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={prov ? `padrão: ${prov.defaultModel}` : ''} data-testid="reanalyze-model" />
              <datalist id="reanalyze-models">{prov?.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
            </Field>
          </div>
        )}
        <Field label="Orientação para o coordenador (opcional)"><textarea className="px-input h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: reduza para 4 tarefas e foque em manutenção preditiva" /></Field>
      </div>
    </Modal>
  )
}
