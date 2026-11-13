import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Copy, Eye, Loader2, MoreVertical, Pencil, Plus, Search, Settings2, Trash2, XCircle, Activity } from 'lucide-react'
import type { Agent, ExecutionRun, Provider } from '@/types/domain'
import { Avatar, Chip, Tabs, Toggle, cx } from '@/components/ui/primitives'
import { providerIconUrl } from '@/lib/assets'
import { fmtClock, fmtCompact, timeAgo } from '@/lib/format'
import { useLabStore } from '@/stores/labStore'
import { envPath } from '@/world/maps'
import { useSimulationStore } from '@/stores/simulationStore'
import { STATE_META } from '@/simulation/states'
import { ConfirmModal } from '@/components/ui/Modal'

// ---------------------------------------------------------------------------
export function ProvidersPanel({ providers, compact }: { providers: Provider[]; compact?: boolean }) {
  const update = useLabStore((s) => s.updateProvider)
  const nav = useNavigate()
  return (
    <ul className="space-y-1.5">
      {providers.filter((p) => compact ? p.id !== 'ollama' : true).map((p) => (
        <li key={p.id} className="px-inset flex items-center gap-2 px-2 py-1.5">
          <img src={providerIconUrl(p.id)} alt="" className="pixel h-6 w-6" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-extrabold">{p.name}</span>
            <span className={cx('flex items-center gap-1 text-[10px]', p.status === 'connected' ? 'text-neon-green' : 'text-lab-muted')}>
              <i className={cx('inline-block h-1.5 w-1.5 rounded-full', p.status === 'connected' ? 'bg-neon-green' : 'bg-lab-muted')} />
              {p.status === 'connected' ? 'Conectado' : p.status === 'not_configured' ? 'Não configurado' : 'Desconectado'}
              {p.origin === 'demo' && <span className="text-neon-gold">(demo)</span>}
            </span>
          </span>
          <Chip color="#9d62ff" className="hidden 2xl:inline-flex">{p.badge}</Chip>
          <Toggle checked={p.enabled} onChange={(v) => update(p.id, { enabled: v })} label={`Ativar ${p.name}`} disabled={p.status === 'not_configured'} />
          <button className="text-lab-muted hover:text-neon-cyan" aria-label={`Configurar ${p.name}`} onClick={() => nav(`/provedores?provider=${p.id}`)}><Settings2 size={15} /></button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
export function AgentMenu({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const nav = useNavigate()
  const { duplicateAgent, deleteAgent } = useLabStore()
  const [confirm, setConfirm] = useState(false)
  const select = useSimulationStore((s) => s.select)
  const item = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] hover:bg-white/5'
  return (
    <>
      <div className="px-panel c-cyan absolute right-1 top-7 z-30 w-44 py-1" onMouseLeave={onClose}>
        <button className={item} onClick={() => nav(`/agentes/${agent.id}`)}><Eye size={13} /> Ver perfil</button>
        <button className={item} onClick={() => nav(`/agentes/${agent.id}/editar`)}><Pencil size={13} /> Editar</button>
        <button className={item} onClick={() => { void duplicateAgent(agent.id); onClose() }}><Copy size={13} /> Duplicar</button>
        <button className={item} onClick={() => { select(agent.id); nav(envPath(agent.environmentId)) }}><Activity size={13} /> Ver no laboratório</button>
        <button className={cx(item, 'text-neon-pink')} onClick={() => setConfirm(true)}><Trash2 size={13} /> Excluir</button>
      </div>
      <ConfirmModal open={confirm} onClose={() => { setConfirm(false); onClose() }} onConfirm={() => void deleteAgent(agent.id)} title="Excluir agente" message={<>Excluir <b>{agent.name}</b>? A configuração será removida do armazenamento local (modo demo).</>} confirmLabel="Excluir" />
    </>
  )
}

export function AgentMiniCard({ agent }: { agent: Agent }) {
  const [menu, setMenu] = useState(false)
  const rt = useSimulationStore((s) => s.runtime[agent.id])
  const st = rt ? STATE_META[rt.state] : null
  const statusColor = agent.status === 'active' ? '#00f5a0' : agent.status === 'paused' ? '#ffb800' : '#8b97c4'
  return (
    <div className="px-panel relative flex h-full min-w-0 flex-col gap-1.5 p-2" style={{ ['--c' as string]: agent.appearance.accentColor } as CSSProperties} data-testid="agent-card">
      <div className="flex items-start gap-2">
        <Link to={`/agentes/${agent.id}`}><Avatar characterId={agent.appearance.characterId} size={38} ring={agent.appearance.accentColor} /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/agentes/${agent.id}`} className="line-clamp-2 block text-[11.5px] font-extrabold leading-tight hover:text-neon-cyan">{agent.name}</Link>
          <p className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: statusColor }}>
            <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
            {agent.status === 'active' ? 'Ativo' : agent.status === 'paused' ? 'Pausado' : 'Arquivado'}
          </p>
          {st && agent.status === 'active' && <p className="truncate text-[10px]" style={{ color: st.color }}>{st.label}</p>}
        </div>
        <button className="text-lab-muted hover:text-white" onClick={() => setMenu((v) => !v)} aria-label={`Ações de ${agent.name}`}><MoreVertical size={15} /></button>
      </div>
      <div className="flex flex-wrap gap-1">
        {agent.tags.slice(0, 3).map((t) => <Chip key={t} color="#8b97c4" className="text-[9.5px]">{t}</Chip>)}
      </div>
      {menu && <AgentMenu agent={agent} onClose={() => setMenu(false)} />}
    </div>
  )
}

type AgentFilter = 'all' | 'active' | 'paused' | 'archived'

export function AgentsGrid({ limit = 4 }: { limit?: number }) {
  const agents = useLabStore((s) => s.agents)
  const [filter, setFilter] = useState<AgentFilter>('all')
  const [q, setQ] = useState('')
  const list = useMemo(() => agents.filter((a) => filter === 'all' || a.status === filter)
    .filter((a) => !q || `${a.name} ${a.role} ${a.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())), [agents, filter, q])
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onChange={setFilter} items={[{ id: 'all', label: 'Todos' }, { id: 'active', label: 'Ativos' }, { id: 'paused', label: 'Pausados' }, { id: 'archived', label: 'Arquivados' }]} />
        <label className="relative ml-auto w-48">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-lab-muted" />
          <input className="px-input py-1 pl-7" placeholder="Buscar agente..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar agente" />
        </label>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {list.slice(0, limit).map((a, i) => <div key={a.id} className={cx('min-w-0', i === limit - 1 && 'xl:max-2xl:hidden')}><AgentMiniCard agent={a} /></div>)}
        <Link to="/agentes/novo" className="flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-lab-line text-[12px] font-bold text-lab-muted transition-colors hover:border-neon-green hover:text-neon-green">
          <Plus size={22} /> Criar Novo Agente
        </Link>
      </div>
      {list.length > limit && <Link to="/agentes" className="text-right text-[11px] font-bold text-neon-cyan">Ver todos os {list.length} agentes →</Link>}
    </div>
  )
}

// ---------------------------------------------------------------------------
export function RunStatusIcon({ status }: { status: ExecutionRun['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={15} className="shrink-0 text-neon-green" />
  if (status === 'warning') return <AlertTriangle size={15} className="shrink-0 text-neon-gold" />
  if (status === 'error') return <XCircle size={15} className="shrink-0 text-neon-pink" />
  return <Loader2 size={15} className="shrink-0 animate-spin text-neon-cyan" />
}

const RUN_TAG: Record<ExecutionRun['status'], [string, string]> = {
  ok: ['[OK]', 'text-neon-green'], warning: ['[AVISO]', 'text-neon-gold'], error: ['[ERRO]', 'text-neon-pink'], running: ['[EXEC]', 'text-neon-cyan'], queued: ['[FILA]', 'text-lab-muted'],
}

export function RecentRuns({ runs, max = 5 }: { runs: ExecutionRun[]; max?: number }) {
  return (
    <ul className="space-y-1">
      {runs.slice(0, max).map((r) => (
        <li key={r.id} className="flex items-center gap-2 border-b border-white/5 pb-1 text-[11.5px] last:border-0">
          <RunStatusIcon status={r.status} />
          <span className={cx('font-extrabold', RUN_TAG[r.status][1])}>{RUN_TAG[r.status][0]}</span>
          <span className="min-w-0 flex-1 truncate">{r.title}</span>
          <span className="w-[66px] shrink-0 text-right text-[10.5px] text-lab-muted">{timeAgo(r.startedAt)}</span>
          <span className="w-[72px] shrink-0 text-right text-[10.5px] font-bold">{r.tokens ? `${fmtCompact(r.tokens)} tokens` : '—'}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
export function LiveLogs({ max = 6 }: { max?: number }) {
  const logs = useSimulationStore((s) => s.logs)
  const list = logs.slice(-max)
  return (
    <div className="h-full overflow-hidden rounded-[4px] bg-[#050913] p-2 font-mono text-[10.5px] leading-[1.55]" aria-live="off">
      {list.length === 0 && <p className="text-lab-muted">Aguardando eventos da simulação…</p>}
      {list.map((l) => (
        <p key={l.id} className="truncate">
          <span className="text-lab-muted">[{fmtClock(l.ts)}]</span>{' '}
          <span className={l.level === 'warn' ? 'text-neon-gold' : l.level === 'error' ? 'text-neon-pink' : 'text-neon-green'}>›</span> {l.message}
        </p>
      ))}
    </div>
  )
}

