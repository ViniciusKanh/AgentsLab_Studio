import { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Crosshair, ExternalLink, MessageSquare, Pause, Play, Send, X } from 'lucide-react'
import type { Agent } from '@/types/domain'
import { useSimulationStore } from '@/stores/simulationStore'
import { useChatStore } from '@/stores/chatStore'
import { useMissionStore } from '@/stores/missionStore'
import { useLabStore } from '@/stores/labStore'
import { STATE_META } from '@/simulation/states'
import { worldBus } from '@/world/events/bus'
import { Avatar, Chip, DemoTag, ProgressBar, Tabs, cx } from '@/components/ui/primitives'
import { providerIconUrl } from '@/lib/assets'
import { fmtClock, fmtInt, timeAgo } from '@/lib/format'
import { appConfig } from '@/services/config'

type T = 'status' | 'chat' | 'historico' | 'interacoes'

/** Painel contextual compacto do agente selecionado (some ao fechar). */
export function AgentContextPanel({ agent, onClose, onMission }: { agent: Agent; onClose: () => void; onMission: () => void }) {
  const [tab, setTab] = useState<T>('status')
  const rt = useSimulationStore((s) => s.runtime[agent.id])
  const paused = useSimulationStore((s) => !!s.manualPaused[agent.id])
  const togglePause = useSimulationStore((s) => s.togglePause)
  const credentials = useLabStore((s) => s.credentials)
  const nav = useNavigate()
  const meta = STATE_META[rt?.state ?? 'idle']
  const cred = credentials.find((c) => c.id === agent.intelligence.credentialId)
  const busy = rt && rt.state !== 'idle' && rt.state !== 'paused'

  return (
    <aside className="flex w-[330px] shrink-0 flex-col border-l border-lab-line/60 bg-[#0a1023]" data-testid="agent-panel">
      <header className="flex items-start gap-3 border-b border-white/5 p-3">
        <Avatar characterId={agent.appearance.characterId} size={56} ring={meta.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold">{agent.name}</p>
          <p className="truncate text-[11px] text-lab-muted">{agent.role} · {agent.department}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Chip color={meta.color}>{meta.label}</Chip>
            {appConfig.mode === 'demo' && busy && <DemoTag />}
          </div>
        </div>
        <button onClick={onClose} className="text-lab-muted hover:text-white" aria-label="Fechar painel"><X size={16} /></button>
      </header>

      <div className="grid grid-cols-3 gap-1.5 border-b border-white/5 p-3">
        <button className="px-btn sm" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => setTab('chat')}><MessageSquare size={13} /> Conversar</button>
        <button className="px-btn sm solid" onClick={onMission} disabled={agent.status !== 'active'}><Briefcase size={13} /> Missão</button>
        <button className="px-btn sm" style={{ ['--c' as string]: '#9d62ff' }} onClick={() => nav(`/agentes/${agent.id}`)}><ExternalLink size={13} /> Detalhes</button>
      </div>

      <Tabs value={tab} onChange={setTab} className="px-3 pt-2.5" items={[{ id: 'status', label: 'Status' }, { id: 'chat', label: 'Chat' }, { id: 'historico', label: 'Histórico' }, { id: 'interacoes', label: 'Interações' }]} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'status' && (
          <div className="space-y-3 text-[12px]">
            <div className="rounded-[6px] bg-[#070b17] p-2.5">
              <p className="text-[10.5px] text-lab-muted">Tarefa em execução</p>
              <p className="font-bold">{rt?.taskTitle ?? 'Nenhuma — em atividade livre no ambiente'}</p>
              {busy && (
                <>
                  <ProgressBar value={rt?.progress ?? 0} height={7} className="mt-2" />
                  <p className="mt-1 flex justify-between text-[10.5px] text-lab-muted"><span>{Math.round((rt?.progress ?? 0) * 100)}%</span><span>{fmtInt(rt?.tokensSession ?? 0)} tokens {appConfig.mode === 'demo' && '(simulados)'}</span></p>
                </>
              )}
            </div>
            <dl className="grid grid-cols-[96px_1fr] gap-y-1.5">
              <dt className="text-lab-muted">Modelo</dt>
              <dd className="flex items-center gap-1.5 truncate"><img src={providerIconUrl(agent.intelligence.provider)} className="pixel h-4 w-4" alt="" />{agent.intelligence.model}</dd>
              <dt className="text-lab-muted">Chave</dt>
              <dd className="truncate">{cred ? cred.alias : 'Padrão do provedor'}</dd>
              <dt className="text-lab-muted">Autonomia</dt><dd>{agent.rules.autonomy}</dd>
              <dt className="text-lab-muted">Objetivo</dt><dd className="text-[11.5px]">{agent.objective}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-1.5">
              <button className="px-btn sm ghost" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => worldBus.emit('camera:focus', { agentId: agent.id })}><Crosshair size={13} /> Centralizar</button>
              <button className="px-btn sm ghost" style={{ ['--c' as string]: paused ? '#00f5a0' : '#ffb800' }} onClick={() => togglePause(agent.id)} disabled={agent.status !== 'active'}>
                {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? 'Retomar' : 'Pausar'}
              </button>
            </div>
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
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length])
  const list = msgs ?? []
  return (
    <div className="flex h-full flex-col" data-testid="agent-chat">
      {appConfig.mode === 'demo' && <p className="mb-2 rounded-[5px] border border-neon-gold/50 bg-neon-gold/10 p-2 text-[10.5px] text-neon-gold">Respostas demonstrativas geradas localmente — nenhum modelo de IA é chamado.</p>}
      <div className="min-h-[160px] flex-1 space-y-2">
        {list.length === 0 && <p className="text-[11px] text-lab-muted">Pergunte sobre o status, a tarefa atual ou o papel do agente.</p>}
        {list.map((m) => (
          <div key={m.id} className={cx('max-w-[88%] rounded-[8px] px-2.5 py-1.5 text-[11.5px]', m.role === 'user' ? 'ml-auto bg-neon-purple/25' : m.role === 'system' ? 'bg-neon-pink/15 text-neon-pink' : 'bg-white/5')}>
            {m.text}
            <span className="mt-0.5 block text-[9px] text-lab-muted">{fmtClock(m.ts)}{m.role === 'agent' && m.origin === 'demo' ? ' · demo' : ''}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { send(agent, text.trim()); setText('') } }}>
        <input className="px-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem para o agente…" aria-label="Mensagem" maxLength={500} />
        <button className="px-btn sm solid" aria-label="Enviar"><Send size={13} /></button>
      </form>
    </div>
  )
}

function AgentHistory({ agentId }: { agentId: string }) {
  const runs = useSimulationStore((s) => s.sessionRuns)
  const missions = useMissionStore((s) => s.missions)
  const mine = useMemo(() => runs.filter((r) => r.agentId === agentId), [runs, agentId])
  const myMissions = useMemo(() => missions.filter((m) => m.agentIds.includes(agentId)), [missions, agentId])
  return (
    <div className="space-y-3 text-[11.5px]">
      <div>
        <p className="mb-1 font-extrabold">Missões</p>
        {myMissions.length === 0 ? <p className="text-lab-muted">Nenhuma missão atribuída.</p> : myMissions.map((m) => (
          <p key={m.id} className="flex justify-between border-b border-white/5 py-1"><span className="truncate">{m.title}</span><Chip color={m.status === 'concluida' ? '#00f5a0' : m.status === 'falhou' ? '#ff537a' : '#39d6ff'}>{m.status.replace('_', ' ')}</Chip></p>
        ))}
      </div>
      <div>
        <p className="mb-1 flex items-center gap-1.5 font-extrabold">Execuções da sessão <DemoTag /></p>
        {mine.length === 0 ? <p className="text-lab-muted">Sem execuções ainda.</p> : mine.slice(0, 12).map((r) => (
          <p key={r.id} className="flex justify-between border-b border-white/5 py-1"><span className={r.status === 'ok' ? 'text-neon-green' : 'text-neon-pink'}>{r.status === 'ok' ? '✓' : '✗'} {r.title}</span><span className="text-lab-muted">{timeAgo(r.startedAt)}</span></p>
        ))}
      </div>
    </div>
  )
}

function AgentInteractions({ agentId }: { agentId: string }) {
  const logs = useSimulationStore((s) => s.logs)
  const mine = useMemo(() => logs.filter((l) => l.agentId === agentId).slice(-20).reverse(), [logs, agentId])
  return (
    <div className="space-y-1 font-mono text-[10.5px]">
      <p className="mb-1 font-sans text-[10.5px] text-lab-muted">Mensagens operacionais (eventos do motor de execução). No modo real virão do backend.</p>
      {mine.length === 0 ? <p className="text-lab-muted">Sem interações profissionais registradas.</p> : mine.map((l) => (
        <p key={l.id}><span className="text-lab-muted">[{fmtClock(l.ts)}]</span> {l.message}</p>
      ))}
    </div>
  )
}
