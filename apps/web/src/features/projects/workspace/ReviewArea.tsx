import { useEffect, useState } from 'react'
import { Check, MessageSquarePlus, X } from 'lucide-react'
import { platform, TASK_KIND } from '@/services/platform'
import { useUiStore } from '@/stores/uiStore'
import { Chip, Field, Panel, cx } from '@/components/ui/primitives'
import { fmtDate } from '@/lib/format'
import { Empty, TASK_STATUS, useAgentName, useTeam, type Nav, type WorkspaceData } from './shared'

const REVISION_PREFIX = /^(FB|UP|RR|RV)\d+$/

/** Revisão: entregas aguardando aprovação, feedback roteado (documento ou tarefa) e o ciclo de correções. */
export function ReviewArea({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, artifacts } = data
  const report = artifacts.find((a) => a.kind === 'report')
  const reviews = artifacts.filter((a) => a.kind === 'review')
  const lastReview = reviews[reviews.length - 1]
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        {project.status === 'delivered' && report ? <DeliveryReview data={data} reportId={report.id} reviewTitle={lastReview?.title} nav={nav} /> : (
          <Panel accent="purple" title="Entregas aguardando aprovação">
            <Empty>{project.status === 'completed' ? 'Entrega aprovada. O projeto está concluído.' : ['running', 'revising'].includes(project.status) ? 'A equipe ainda está trabalhando — a entrega aparece aqui quando o relatório for consolidado e revisado.' : 'Nenhuma entrega pendente.'}</Empty>
          </Panel>
        )}
        <FeedbackComposer data={data} nav={nav} />
      </div>
      <RevisionCycle data={data} nav={nav} />
    </div>
  )
}

function DeliveryReview({ data, reportId, reviewTitle, nav }: { data: WorkspaceData; reportId: string; reviewTitle?: string; nav: Nav }) {
  const { project, artifacts } = data
  const report = artifacts.find((a) => a.id === reportId)!
  const toast = useUiStore((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const decide = async (approve: boolean) => {
    setBusy(true)
    try { await platform.decideDelivery(project.id, approve, note); toast(approve ? 'Entrega aprovada' : 'Entrega rejeitada', 'success'); await data.reload() } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Panel accent="purple" title="Entrega aguardando sua aprovação" data-testid="delivery-review" bodyClassName="space-y-3 text-[13.5px]">
      <p><button className="text-left font-bold text-neon-cyan hover:underline" onClick={() => nav.go('documentos', { artifactId: report.id })}>{report.code} “{report.title}”</button> — versão {report.currentVersion}, {fmtDate(report.updatedAt ?? report.createdAt)}</p>
      {reviewTitle && <p className="text-lab-muted">Último parecer do revisor: <b className="text-lab-text">{reviewTitle}</b> (veja em Documentos → Pareceres de revisão).</p>}
      <Field label="Observação da decisão (opcional)"><input className="px-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-2">
        <button className="px-btn solid" disabled={busy} onClick={() => void decide(true)} data-testid="delivery-approve"><Check size={14} /> Aprovar entrega</button>
        <button className="px-btn" style={{ ['--c' as string]: '#ff537a' }} disabled={busy} onClick={() => void decide(false)}><X size={14} /> Rejeitar sem revisão</button>
      </div>
      <p className="text-[12.5px] text-lab-muted">Para pedir mudanças, use o feedback ao lado: o responsável cria uma nova versão e os documentos dependentes são atualizados em sequência.</p>
    </Panel>
  )
}

function FeedbackComposer({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, artifacts } = data
  const tasks = project.tasks ?? []
  const team = useTeam(project)
  const name = useAgentName()
  const toast = useUiStore((s) => s.toast)
  const [mode, setMode] = useState<'doc' | 'task'>(nav.focus.taskId ? 'task' : 'doc')
  const [artifactId, setArtifactId] = useState(nav.focus.artifactId ?? artifacts.find((a) => a.kind === 'report')?.id ?? artifacts[0]?.id ?? '')
  const [taskId, setTaskId] = useState(nav.focus.taskId ?? tasks.find((t) => t.status === 'failed')?.id ?? tasks[0]?.id ?? '')
  const [agentId, setAgentId] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (nav.focus.taskId) { setMode('task'); setTaskId(nav.focus.taskId) }
    else if (nav.focus.artifactId) { setMode('doc'); setArtifactId(nav.focus.artifactId) }
  }, [nav.focus.taskId, nav.focus.artifactId])
  const closed = ['completed', 'cancelled', 'planning', 'awaiting_approval'].includes(project.status)
  const art = artifacts.find((a) => a.id === artifactId)
  const task = tasks.find((t) => t.id === taskId)
  const responsible = agentId || (mode === 'doc' ? art?.agentId : task?.agentId) || null
  const send = async () => {
    setBusy(true)
    try {
      const r = await platform.feedback(project.id, mode === 'doc' ? { artifactId } : { taskId }, text.trim(), agentId || undefined)
      const ks = r.feedback.tasks
      toast(`Feedback enviado a ${name(r.feedback.agentId)}${ks.length > 1 ? ` — ${ks.length - 1} tarefa(s) dependente(s) serão atualizadas` : ''}`, 'success')
      setText('')
      await data.reload()
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Panel accent="pink" title="Feedback do gestor" data-testid="feedback-composer" bodyClassName="space-y-3 text-[13.5px]">
      {closed ? <Empty>{project.status === 'completed' ? 'Projeto concluído — crie um novo projeto para outro ciclo.' : 'Disponível depois que o plano for aprovado.'}</Empty> : (
        <>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Alvo do feedback">
            {(['doc', 'task'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cx('rounded-[5px] border px-3 py-1.5 text-[13px] font-bold', mode === m ? 'border-neon-pink bg-neon-pink/15' : 'border-lab-line text-lab-muted')}>
                {m === 'doc' ? 'Sobre um documento' : 'Sobre uma tarefa'}
              </button>
            ))}
          </div>
          {mode === 'doc' ? (
            <Field label="Documento">
              <select className="px-input" value={artifactId} onChange={(e) => setArtifactId(e.target.value)} data-testid="feedback-artifact">
                {artifacts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.title} (v{a.currentVersion})</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Tarefa">
              <select className="px-input" value={taskId} onChange={(e) => setTaskId(e.target.value)} data-testid="feedback-task">
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.key} — {t.title} ({TASK_STATUS[t.status].label})</option>)}
              </select>
            </Field>
          )}
          <Field label="Responsável" hint="Automático: autor do documento ou dono da tarefa. Escolha outro agente para reatribuir.">
            <select className="px-input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Automático — {name(mode === 'doc' ? art?.agentId : task?.agentId)}</option>
              {team.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
            </select>
          </Field>
          <Field label="O que precisa mudar?">
            <textarea className="px-input h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: inclua métricas de precisão por dataset e explique as limitações de cada abordagem." data-testid="feedback-text" />
          </Field>
          <p className="text-[12.5px] text-lab-muted">
            {name(responsible)} criará uma nova versão (as anteriores são preservadas, com diff). Documentos que dependem deste serão atualizados em sequência e, se já houve revisão, o revisor avalia de novo.
          </p>
          <button className="px-btn solid" disabled={busy || text.trim().length < 3 || (mode === 'doc' ? !artifactId : !taskId)} onClick={() => void send()} data-testid="feedback-send"><MessageSquarePlus size={14} /> Enviar feedback</button>
        </>
      )}
    </Panel>
  )
}

function RevisionCycle({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, messages, artifacts } = data
  const name = useAgentName()
  const revs = (project.tasks ?? []).filter((t) => REVISION_PREFIX.test(t.key) || t.kind === 'revision')
  const feedbacks = messages.filter((m) => m.type === 'feedback' || m.type === 'revisao')
  const approvals = project.approvals ?? []
  return (
    <div className="flex flex-col gap-3">
      <Panel accent="gold" title={`Ciclo de correções (${revs.length})`} data-testid="revision-cycle">
        {revs.length === 0 ? <Empty>Nenhuma revisão solicitada ainda.</Empty> : (
          <ol className="space-y-1.5 text-[13px]">
            {revs.map((t) => {
              const target = artifacts.find((a) => a.id === (t.targetArtifactId ?? t.resultArtifactId))
              return (
                <li key={t.id}>
                  <button className="flex w-full flex-col rounded-[6px] bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.07]" onClick={() => nav.go('execucao', { taskId: t.id })}>
                    <span className="flex items-center gap-2"><span className="font-mono font-bold text-neon-cyan">{t.key}</span><b className="min-w-0 flex-1 truncate">{t.title}</b><Chip color={TASK_STATUS[t.status].color}>{TASK_STATUS[t.status].label}</Chip></span>
                    <span className="text-[12px] text-lab-muted">{name(t.agentId)} · {TASK_KIND[t.kind]}{target ? ` · ${target.code} agora em v${target.currentVersion}` : ''}{t.dependsOn.length ? ` · após ${t.dependsOn.join(', ')}` : ''}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>
      <Panel accent="purple" title="Feedback e pareceres">
        {feedbacks.length === 0 ? <Empty>Sem feedback registrado.</Empty> : (
          <ol className="max-h-[320px] space-y-1.5 overflow-auto text-[13px]">
            {[...feedbacks].reverse().map((m) => (
              <li key={m.id} className="rounded-[6px] bg-white/[0.04] px-3 py-2">
                <p className="text-[12px] text-lab-muted"><b className="text-lab-text">{name(m.fromAgentId, m.fromKind)}</b> → {m.toAgentId ? name(m.toAgentId) : 'Gestor'} · {fmtDate(m.createdAt)}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {approvals.length > 0 && (
        <Panel accent="green" title="Decisões registradas">
          <ul className="space-y-1 text-[13px]">
            {approvals.map((a) => <li key={a.id}>{a.kind === 'plan' ? 'Plano' : 'Entrega'} · <b>{({ approved: 'aprovado', changes_requested: 'mudanças solicitadas', rejected: 'rejeitado', pending: 'pendente', superseded: 'substituído' } as Record<string, string>)[a.status] ?? a.status}</b> · {fmtDate(a.decidedAt ?? a.createdAt)}{a.note ? ` — ${a.note.slice(0, 120)}` : ''}</li>)}
          </ul>
        </Panel>
      )}
    </div>
  )
}
