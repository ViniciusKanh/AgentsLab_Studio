import { modelLabel } from '@/lib/format'
import { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Crosshair, ExternalLink, MessageSquare, Send, X } from 'lucide-react'
import type { Agent } from '@/types/domain'
import { useSimulationStore } from '@/stores/simulationStore'
import { useChatStore } from '@/stores/chatStore'
import { useAgentUsage } from '@/hooks/useAgentUsage'
import { platform, MESSAGE_TYPE } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import type { AgentMessage } from '@/types/platform'
import { useLabStore } from '@/stores/labStore'
import { STATE_META } from '@/simulation/states'
import { worldBus } from '@/world/events/bus'
import { Avatar, Chip, DemoTag, ProgressBar, Tabs, cx } from '@/components/ui/primitives'
import { providerIconUrl } from '@/lib/assets'
import { fmtClock, fmtCost, fmtInt, timeAgo } from '@/lib/format'
import { appConfig } from '@/services/config'

type T = 'status' | 'chat' | 'historico' | 'interacoes'

/** Painel contextual compacto do agente selecionado (some ao fechar). */
export function AgentContextPanel({ agent, onClose, onAssign }: { agent: Agent; onClose: () => void; onAssign: () => void }) {
  const [tab, setTab] = useState<T>('status')
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
            <Chip color={meta.color}>{meta.label}</Chip>
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

      <Tabs value={tab} onChange={setTab} className="px-3 pt-2.5" items={[{ id: 'status', label: 'Status' }, { id: 'chat', label: 'Chat' }, { id: 'historico', label: 'Histórico' }, { id: 'interacoes', label: 'Interações' }]} />

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
