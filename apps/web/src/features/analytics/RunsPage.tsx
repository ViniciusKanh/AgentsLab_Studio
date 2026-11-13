import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScrollText, Search } from 'lucide-react'
import type { AgentMessage, Execution } from '@/types/platform'
import { appConfig } from '@/services/config'
import { MESSAGE_TYPE, platform } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useLabStore } from '@/stores/labStore'
import { Avatar, Chip, Panel, Tabs } from '@/components/ui/primitives'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtClock, fmtCost, fmtDate, fmtInt } from '@/lib/format'

/** Execuções: todas as chamadas de modelo e mensagens registradas no backend. */
export default function RunsPage() {
  const [params, setParams] = useSearchParams()
  const agentFilter = params.get('agent') ?? ''
  const [tab, setTab] = useState<'chamadas' | 'mensagens'>('chamadas')
  const [status, setStatus] = useState<'all' | 'ok' | 'error'>('all')
  const [q, setQ] = useState('')
  const [execs, setExecs] = useState<Execution[]>([])
  const [msgs, setMsgs] = useState<AgentMessage[]>([])
  const agents = useLabStore((s) => s.agents)
  const real = appConfig.mode === 'real'
  useEffect(() => {
    if (!real) return
    const load = () => { platform.allExecutions(500).then(setExecs).catch(() => undefined); platform.recentMessages(300).then(setMsgs).catch(() => undefined) }
    load()
    let t: ReturnType<typeof setTimeout> | null = null
    const off = onPlatformEvent((e) => { if ((e.type === 'execution' || e.type === 'agent.message') && !t) t = setTimeout(() => { t = null; load() }, 800) })
    return () => { off(); if (t) clearTimeout(t) }
  }, [real])
  const name = (id: string | null) => agents.find((a) => a.id === id)?.name ?? '—'
  const list = useMemo(() => execs.filter((e) => (status === 'all' || e.status === status) && (!agentFilter || e.agentId === agentFilter) && (!q || `${e.purpose} ${e.model} ${name(e.agentId)}`.toLowerCase().includes(q.toLowerCase()))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [execs, status, agentFilter, q, agents])
  if (!real) return <OfflineNotice what="Execuções e registros" />
  return (
    <div className="flex flex-col gap-2.5" data-testid="runs-page">
      <div className="px-panel c-green flex flex-wrap items-center gap-3 px-3 py-2">
        <ScrollText size={30} className="text-neon-green" />
        <div><h1 className="title-pixel text-[15px]">Execuções</h1><p className="text-[12px] text-lab-muted">Chamadas reais aos modelos (tokens, latência, custo) e mensagens trocadas entre agentes.</p></div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'chamadas', label: `Chamadas de modelo (${execs.length})` }, { id: 'mensagens', label: `Mensagens (${msgs.length})` }]} />
      {tab === 'chamadas' ? (
        <Panel accent="purple" title={`Chamadas (${list.length})`} actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative"><Search size={13} className="absolute left-2 top-1.5 text-lab-muted" /><input className="px-input w-44 py-1 pl-7 text-[11px]" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <select className="px-input w-auto py-1 text-[11px]" value={agentFilter} onChange={(e) => setParams(e.target.value ? { agent: e.target.value } : {})}><option value="">Todos os agentes</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select className="px-input w-auto py-1 text-[11px]" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Todos</option><option value="ok">Sucesso</option><option value="error">Erro</option></select>
          </div>
        }>
          {list.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhuma chamada registrada.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead className="text-left text-lab-muted"><tr><th className="pb-1">Data</th><th>Agente</th><th>Finalidade</th><th>Modelo</th><th>Tokens</th><th>Latência</th><th className="text-right">Custo</th></tr></thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className="border-t border-white/5">
                      <td className="py-1 text-lab-muted">{fmtDate(e.createdAt)}</td>
                      <td><span className="flex items-center gap-1.5">{agents.find((a) => a.id === e.agentId) && <Avatar characterId={agents.find((a) => a.id === e.agentId)!.appearance.characterId} size={20} />}{name(e.agentId)}</span></td>
                      <td className={e.status === 'error' ? 'text-neon-pink' : ''}>{e.purpose}{e.status === 'error' && <span className="block text-[10px]">{e.error.slice(0, 140)}</span>}</td>
                      <td className="font-mono text-[10.5px]">{e.provider}/{e.model}</td>
                      <td>{fmtInt(e.inputTokens + e.outputTokens)}</td>
                      <td>{(e.latencyMs / 1000).toFixed(1)} s</td>
                      <td className="text-right">{fmtCost(e.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel accent="cyan" title="Mensagens recentes">
          <ol className="space-y-1.5">
            {msgs.slice().reverse().map((m) => (
              <li key={m.id} className="rounded-[6px] bg-white/[0.04] p-2 text-[11.5px]">
                <p className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-lab-muted"><Chip color={MESSAGE_TYPE[m.type]?.color}>{MESSAGE_TYPE[m.type]?.label ?? m.type}</Chip>{m.fromKind === 'user' ? 'Gestor' : name(m.fromAgentId)} → {m.toKind === 'user' ? 'Gestor' : m.toAgentId ? name(m.toAgentId) : 'equipe'} · {fmtClock(m.createdAt)}</p>
                <p className="line-clamp-3 whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  )
}
