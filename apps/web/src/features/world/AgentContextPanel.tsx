import { modelLabel } from '@/lib/format'
import { useMemo, useRef, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, Crosshair, ExternalLink, MessageSquare, Send, X } from 'lucide-react'
import type { Agent } from '@/types/domain'
import { useSimulationStore } from '@/stores/simulationStore'
import { useChatStore } from '@/stores/chatStore'
import { useAgentUsage } from '@/hooks/useAgentUsage'
import { platform, MESSAGE_TYPE, TASK_KIND, TOOL_LABEL } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import type { AgentActivity, AgentActivityTask, AgentMessage } from '@/types/platform'
import { useLabStore } from '@/stores/labStore'
import { activityLabel, STATE_META } from '@/simulation/states'
import { worldBus } from '@/world/events/bus'
import { Avatar, Chip, DemoTag, ProgressBar, Tabs, cx } from '@/components/ui/primitives'
import { providerIconUrl } from '@/lib/assets'
import { fmtClock, fmtCost, fmtInt, timeAgo } from '@/lib/format'
import { appConfig } from '@/services/config'

type T = 'status' | 'trabalho' | 'chat' | 'historico' | 'interacoes'

/** Painel contextual compacto do agente selecionado (some ao fechar). */
export function AgentContextPanel({ agent, onClose, onAssign }: { agent: Agent; onClose: () => void; onAssign: () => void }) {
  const [tab, setTab] = useState<T>(appConfig.mode === 'real' ? 'trabalho' : 'status')
  const rt = useSimulationStore((s) => s.runtime[agent.id])
  const credentials = useLabStore((s) => s.credentials)
  const nav = useNavigate()
  const meta = STATE_META[rt?.state ?? 'idle']
  const cred = credentials.find((c) => c.id === agent.intelligence.credentialId)
  const busy = rt && rt.state !== 'idle' && rt.state !== 'paused'

  return (
    <aside className="fixed inset-x-0 bottom-0 top-12 z-40 flex w-full flex-col border-l border-lab-line/60 bg-[#0a1023] md:static md:z-auto md:w-[330px] md:shrink-0" data-testid="agent-panel">
      <header className="flex items-start gap-3 border-b border-white/5 p-3">
        <Avatar characterId={agent.appearance.characterId} size={56} ring={meta.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold">{agent.name}</p>
          <p className="truncate text-[11px] text-lab-muted">{agent.role} · {agent.department}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Chip color={meta.color}>{activityLabel(rt?.state ?? 'idle', rt?.taskKind)}</Chip>
            {agent.origin === 'demo' && <DemoTag label="EXEMPLO" />}
            {agent.isCoordinator && <Chip color="#ffb800">Coordenador</Chip>}
          </div>
        </div>
        <button onClick={onClose} className="text-lab-muted hover:text-white" aria-label="Fechar painel"><X size={16} /></button>
      </header>

      <div className="grid grid-cols-3 gap-1.5 border-b border-white/5 p-3">
        <button className="px-btn sm" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => setTab('chat')}><MessageSquare size={13} /> Conversar</button>
        <button className="px-btn sm solid" onClick={onAssign} disabled={agent.status !== 'active' || appConfig.mode !== 'real'} title={appConfig.mode !== 'real' ? 'Requer backend conectado' : undefined}><Briefcase size={13} /> Tarefa</button>
        <button className="px-btn sm" style={{ ['--c' as string]: '#9d62ff' }} onClick={() => nav(`/agentes/${agent.id}`)}><ExternalLink size={13} /> Detalhes</button>
      </div>

      <Tabs value={tab} onChange={setTab} className="px-3 pt-2.5" items={[{ id: 'trabalho', label: 'Trabalho' }, { id: 'status', label: 'Status' }, { id: 'chat', label: 'Chat' }, { id: 'historico', label: 'Chamadas' }, { id: 'interacoes', label: 'Mensagens' }]} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'status' && (
          <div className="space-y-3 text-[12px]">
            <div className="rounded-[6px] bg-[#070b17] p-2.5">
              <p className="text-[10.5px] text-lab-muted">Tarefa em execução</p>
              <p className="font-bold">{rt?.taskTitle ?? 'Nenhuma — em atividade livre no ambiente'}</p>
              {busy && rt?.stepsTotal ? (
                <>
                  <ProgressBar value={(rt.stepsDone ?? 0) / rt.stepsTotal} height={7} className="mt-2" />
                  <p className="mt-1 flex justify-between text-[10.5px] text-lab-muted"><span>Etapa {Math.min((rt.stepsDone ?? 0) + 1, rt.stepsTotal)}/{rt.stepsTotal}: {rt.step}</span><span>{fmtInt(rt.tokensSession)} tokens</span></p>
                </>
              ) : null}
            </div>
            <dl className="grid grid-cols-[96px_1fr] gap-y-1.5">
              <dt className="text-lab-muted">Modelo</dt>
              <dd className="flex items-center gap-1.5 truncate"><img src={providerIconUrl(agent.intelligence.provider)} className="pixel h-4 w-4" alt="" />{modelLabel(agent.intelligence.model, useLabStore.getState().providers.find((x) => x.id === agent.intelligence.provider)?.defaultModel)}</dd>
              <dt className="text-lab-muted">Chave</dt>
              <dd className="truncate">{cred ? cred.alias : 'Padrão do provedor'}</dd>
              <dt className="text-lab-muted">Autonomia</dt><dd>{agent.rules.autonomy}</dd>
              <dt className="text-lab-muted">Objetivo</dt><dd className="text-[11.5px]">{agent.objective}</dd>
            </dl>
            <button className="px-btn sm ghost w-full" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => worldBus.emit('camera:focus', { agentId: agent.id })}><Crosshair size={13} /> Centralizar</button>
          </div>
        )}
        {tab === 'trabalho' && <AgentWork agentId={agent.id} />}
        {tab === 'chat' && <AgentChat agent={agent} />}
        {tab === 'historico' && <AgentHistory agentId={agent.id} />}
        {tab === 'interacoes' && <AgentInteractions agentId={agent.id} />}
      </div>
    </aside>
  )
}

function AgentChat({ agent }: { agent: Agent }) {
  const msgs = useChatStore((s) => s.byAgent[agent.id])
  const send = useChatStore((s) => s.send)
  const pending = useChatStore((s) => !!s.pending[agent.id])
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])
  const list = msgs ?? []
  return (
    <div className="flex h-full flex-col" data-testid="agent-chat">
      {appConfig.mode !== 'real' && <p className="mb-2 rounded-[5px] border border-neon-gold/50 bg-neon-gold/10 p-2 text-[10.5px] text-neon-gold">Backend desconectado: o chat chama o modelo real do agente e só funciona com o servidor local ativo.</p>}
      <div className="min-h-[160px] flex-1 space-y-2">
        {list.length === 0 && <p className="text-[11px] text-lab-muted">Converse com o agente. A resposta usa {agent.intelligence.provider}/{modelLabel(agent.intelligence.model, useLabStore.getState().providers.find((x) => x.id === agent.intelligence.provider)?.defaultModel)} e entra no consumo registrado.</p>}
        {list.map((m) => (
          <div key={m.id} className={cx('max-w-[88%] rounded-[8px] px-2.5 py-1.5 text-[11.5px]', m.role === 'user' ? 'ml-auto bg-neon-purple/25' : m.role === 'system' ? 'bg-neon-pink/15 text-neon-pink' : 'bg-white/5')}>
            {m.text}
            <span className="mt-0.5 block text-[9px] text-lab-muted">{fmtClock(m.ts)}</span>
          </div>
        ))}
        {pending && <p className="animate-pulse text-[11px] text-lab-muted">{agent.name} está respondendo…</p>}
        <div ref={end} />
      </div>
      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !pending) { void send(agent, text.trim()); setText('') } }}>
        <input className="px-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem para o agente…" aria-label="Mensagem" maxLength={4000} />
        <button className="px-btn sm solid" aria-label="Enviar"><Send size={13} /></button>
      </form>
    </div>
  )
}

function AgentHistory({ agentId }: { agentId: string }) {
  const usage = useAgentUsage(agentId)
  if (appConfig.mode !== 'real') return <p className="text-[11.5px] text-lab-muted">Conecte o backend para ver o histórico real de execuções.</p>
  return (
    <div className="space-y-1 text-[11.5px]">
      <p className="mb-1 font-extrabold">Chamadas de modelo ({usage.calls}) · {fmtCost(usage.costUsd)}</p>
      {usage.items.length === 0 ? <p className="text-lab-muted">Nenhuma execução registrada.</p> : usage.items.slice(0, 20).map((e) => (
        <p key={e.id} className="flex justify-between gap-2 border-b border-white/5 py-1">
          <span className={e.status === 'ok' ? 'text-neon-green' : 'text-neon-pink'}>{e.status === 'ok' ? '✓' : '✗'} {e.purpose}</span>
          <span className="text-lab-muted">{fmtInt(e.inputTokens + e.outputTokens)} tok · {timeAgo(e.createdAt)}</span>
        </p>
      ))}
    </div>
  )
}

function AgentInteractions({ agentId }: { agentId: string }) {
  const agents = useLabStore((s) => s.agents)
  const [msgs, setMsgs] = useState<AgentMessage[]>([])
  useEffect(() => {
    if (appConfig.mode !== 'real') return
    const load = () => platform.recentMessages(200).then(setMsgs).catch(() => undefined)
    void load()
    return onPlatformEvent((e) => { if (e.type === 'agent.message') void load() })
  }, [])
  const mine = useMemo(() => msgs.filter((m) => m.fromAgentId === agentId || m.toAgentId === agentId).slice(-25).reverse(), [msgs, agentId])
  const name = (id: string | null, kind: string) => (kind === 'user' ? 'Gestor' : kind === 'system' ? 'Sistema' : agents.find((a) => a.id === id)?.name ?? 'Equipe')
  if (appConfig.mode !== 'real') return <p className="text-[11.5px] text-lab-muted">Conecte o backend para ver as mensagens reais entre agentes.</p>
  return (
    <div className="space-y-2 text-[11px]">
      {mine.length === 0 ? <p className="text-lab-muted">Sem mensagens registradas.</p> : mine.map((m) => (
        <div key={m.id} className="rounded-[5px] bg-white/5 p-2">
          <p className="mb-0.5 flex items-center gap-1.5 text-[10px] text-lab-muted"><Chip color={MESSAGE_TYPE[m.type]?.color}>{MESSAGE_TYPE[m.type]?.label ?? m.type}</Chip>{name(m.fromAgentId, m.fromKind)} → {name(m.toAgentId, m.toKind)} · {fmtClock(m.createdAt)}</p>
          <p className="line-clamp-4 whitespace-pre-wrap">{m.content}</p>
        </div>
      ))}
    </div>
  )
}

const TASK_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  running: { label: 'em execução', color: '#39d6ff' }, pending: { label: 'aguardando', color: '#8b97c4' }, done: { label: 'concluída', color: '#00f5a0' },
  failed: { label: 'falhou', color: '#ff537a' }, cancelled: { label: 'cancelada', color: '#8a93b0' }, proposed: { label: 'proposta', color: '#8b97c4' },
}

/** Trabalho real do agente: tarefa atual, pendências, resultados, ferramentas usadas e histórico (backend). */
function AgentWork({ agentId }: { agentId: string }) {
  const [data, setData] = useState<AgentActivity | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (appConfig.mode !== 'real') return
    let t: ReturnType<typeof setTimeout> | null = null
    const load = () => platform.agentActivity(agentId).then((d) => { setData(d); setError('') }).catch((e: Error) => setError(e.message))
    void load()
    const off = onPlatformEvent((e) => {
      const p = e.payload as { agentId?: string }
      if (p.agentId !== agentId || t) return
      t = setTimeout(() => { t = null; void load() }, 500)
    })
    return () => { off(); if (t) clearTimeout(t) }
  }, [agentId])
  if (appConfig.mode !== 'real') return <p className="text-[12px] text-lab-muted">Conecte o backend para ver o trabalho real do agente.</p>
  if (error) return <p className="text-[12px] text-neon-pink">{error}</p>
  if (!data) return <p className="animate-pulse text-[12px] text-lab-muted">Carregando…</p>
  const taskLink = (t: AgentActivityTask) => `/projetos/${t.projectId}?area=execucao&tarefa=${t.id}`
  const TaskRow = ({ t }: { t: AgentActivityTask }) => (
    <Link to={taskLink(t)} className="block rounded-[6px] bg-white/[0.04] px-2.5 py-2 hover:bg-white/[0.08]">
      <span className="flex items-center gap-1.5"><span className="font-mono font-bold text-neon-cyan">{t.key}</span><b className="min-w-0 flex-1 truncate">{t.title}</b><Chip color={TASK_STATUS_LABEL[t.status]?.color}>{TASK_STATUS_LABEL[t.status]?.label ?? t.status}</Chip></span>
      <span className="block truncate text-[11.5px] text-lab-muted">{TASK_KIND[t.kind]} · {t.projectTitle}</span>
      {t.status === 'running' && t.stepsTotal > 0 && <><ProgressBar value={t.stepsDone / t.stepsTotal} height={5} className="mt-1" /><span className="text-[11.5px] text-neon-cyan">{t.step}</span></>}
      {t.status === 'pending' && t.dependsOn.length > 0 && <span className="block text-[11.5px] text-lab-muted">Depende de {t.dependsOn.join(', ')}</span>}
      {t.error && <span className="block text-[11.5px] text-neon-pink">{t.error.slice(0, 140)}</span>}
    </Link>
  )
  return (
    <div className="space-y-3 text-[12.5px]" data-testid="agent-work">
      <section>
        <p className="mb-1 font-extrabold">Agora</p>
        {data.current.length === 0 && data.waiting.length === 0 ? <p className="text-lab-muted">Sem tarefa em andamento.</p> : (
          <div className="space-y-1.5">{[...data.current, ...data.waiting].map((t) => <TaskRow key={t.id} t={t} />)}</div>
        )}
      </section>
      <section>
        <p className="mb-1 font-extrabold">Resultados ({data.artifacts.length})</p>
        {data.artifacts.length === 0 ? <p className="text-lab-muted">Nenhum documento produzido.</p> : data.artifacts.slice(0, 8).map((a) => (
          <Link key={a.id} to={`/projetos/${a.projectId}?area=documentos&doc=${a.id}`} className="block truncate py-0.5 hover:text-neon-green"><span className="font-mono text-neon-cyan">{a.code}</span> {a.title} · v{a.currentVersion}</Link>
        ))}
      </section>
      <section>
        <p className="mb-1 font-extrabold">Ferramentas usadas ({data.totals.toolCalls})</p>
        {data.toolCalls.length === 0 ? <p className="text-lab-muted">Nenhuma.</p> : data.toolCalls.slice(0, 8).map((c) => (
          <p key={c.id} className="truncate border-b border-white/5 py-1"><span className={c.status === 'ok' ? 'text-neon-gold' : 'text-neon-pink'}>{TOOL_LABEL[c.tool] ?? c.tool}</span> · <span className="text-lab-muted">{c.input}</span></p>
        ))}
      </section>
      <section>
        <p className="mb-1 font-extrabold">Histórico ({data.history.length})</p>
        {data.history.length === 0 ? <p className="text-lab-muted">Nenhuma tarefa finalizada.</p> : <div className="space-y-1.5">{data.history.slice(0, 8).map((t) => <TaskRow key={t.id} t={t} />)}</div>}
      </section>
      <p className="text-[11.5px] text-lab-muted">{fmtInt(data.totals.tokens)} tokens · {fmtCost(data.totals.costUsd)} nas últimas chamadas registradas</p>
    </div>
  )
}
