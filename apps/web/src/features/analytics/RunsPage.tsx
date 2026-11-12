import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScrollText, Search } from 'lucide-react'
import { dataSource } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { Avatar, Chip, DemoTag, Panel, Tabs } from '@/components/ui/primitives'
import { RunStatusIcon } from '@/features/dashboard/widgets'
import { fmtClock, fmtDate, fmtInt, fmtUsd } from '@/lib/format'
import type { RunStatus } from '@/types/domain'

export default function RunsPage() {
  const [params, setParams] = useSearchParams()
  const agentFilter = params.get('agent') ?? ''
  const [status, setStatus] = useState<'all' | RunStatus>('all')
  const [q, setQ] = useState('')
  const { data } = useAsync(() => dataSource.listRuns(), [])
  const session = useSimulationStore((s) => s.sessionRuns)
  const logs = useSimulationStore((s) => s.logs)
  const agents = useLabStore((s) => s.agents)
  const all = useMemo(() => [...session, ...(data ?? [])], [session, data])
  const list = all.filter((r) => (status === 'all' || r.status === status) && (!agentFilter || r.agentId === agentFilter) && (!q || r.title.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="flex flex-col gap-2.5" data-testid="runs-page">
      <div className="px-panel c-green flex flex-wrap items-center gap-3 px-3 py-2">
        <ScrollText size={30} className="text-neon-green" />
        <div><h1 className="title-pixel text-[15px]">Logs & Execuções</h1><p className="text-[12px] text-lab-muted">Histórico de execuções e eventos. <DemoTag label="DADOS DEMO" /></p></div>
      </div>
      <Panel accent="purple" title={`Execuções (${list.length})`} actions={
        <div className="flex items-center gap-2">
          <select className="px-input w-48 py-1" value={agentFilter} onChange={(e) => setParams(e.target.value ? { agent: e.target.value } : {})} aria-label="Filtrar por agente"><option value="">Todos os agentes</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <label className="relative w-48"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-lab-muted" /><input className="px-input py-1 pl-7" placeholder="Buscar tarefa..." value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>
      }>
        <Tabs value={status} onChange={setStatus} className="mb-2" items={[{ id: 'all', label: 'Todas' }, { id: 'ok', label: 'Sucesso' }, { id: 'warning', label: 'Aviso' }, { id: 'error', label: 'Erro' }]} />
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-[#0e1630] text-left text-lab-muted"><tr><th className="py-1">Status</th><th>Tarefa</th><th>Agente</th><th>Início</th><th>Duração</th><th className="text-right">Tokens</th><th className="text-right">Custo est.</th><th>Origem</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const a = agents.find((x) => x.id === r.agentId)
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-1"><RunStatusIcon status={r.status} /></td>
                    <td className="font-bold">{r.title}</td>
                    <td><span className="flex items-center gap-1.5">{a && <Avatar characterId={a.appearance.characterId} size={20} />}{a?.name ?? '—'}</span></td>
                    <td className="text-lab-muted">{fmtDate(r.startedAt)}</td>
                    <td>{(r.durationMs / 1000).toFixed(1)} s</td>
                    <td className="text-right">{fmtInt(r.tokens)}</td>
                    <td className="text-right">{fmtUsd(r.costUsd)}</td>
                    <td>{r.origin === 'demo' ? <Chip color="#ffb800">demo</Chip> : <Chip color="#00f5a0">real</Chip>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel accent="green" title="Eventos da simulação (sessão)" demo bodyClassName="max-h-[260px] overflow-auto">
        <div className="font-mono text-[11px] leading-relaxed">
          {logs.slice().reverse().map((l) => <p key={l.id}><span className="text-lab-muted">[{fmtClock(l.ts)}]</span> <span className={l.level === 'warn' ? 'text-neon-gold' : l.level === 'error' ? 'text-neon-pink' : 'text-neon-green'}>{l.level.toUpperCase()}</span> {l.message}</p>)}
          {logs.length === 0 && <p className="text-lab-muted">Sem eventos ainda.</p>}
        </div>
      </Panel>
    </div>
  )
}
