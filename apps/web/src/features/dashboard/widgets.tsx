import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Crown, Eye, FileUp, Loader2, MoreVertical, Pencil, Plus, Search, Settings2, Trash2, XCircle, Zap, Activity, FolderKanban, Workflow as WorkflowIcon, Database, Plug } from 'lucide-react'
import type { Agent, DashboardData, ExecutionRun, Provider, TokenPoint } from '@/types/domain'
import { Avatar, Chip, PixelIcon, ProgressBar, Tabs, Toggle, cx } from '@/components/ui/primitives'
import { PROVIDER_COLORS, asset, providerIconUrl } from '@/lib/assets'
import { fmtClock, fmtCompact, fmtInt, timeAgo } from '@/lib/format'
import { useLabStore } from '@/stores/labStore'
import { envPath } from '@/world/maps'
import { useSimulationStore } from '@/stores/simulationStore'
import { MISSIONS, useGameStore } from '@/stores/gameStore'
import { STATE_META } from '@/simulation/states'
import { ConfirmModal } from '@/components/ui/Modal'

// ---------------------------------------------------------------------------
export function TokenUsageChart({ data, height = 190 }: { data: TokenPoint[]; height?: number }) {
  const series = [
    { key: 'huggingface', name: 'Hugging Face' },
    { key: 'openai', name: 'OpenAI' },
    { key: 'groq', name: 'Groq' },
    { key: 'gemini', name: 'Gemini' },
  ] as const
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={height}>
          <AreaChart data={data} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PROVIDER_COLORS[s.key]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={PROVIDER_COLORS[s.key]} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#26335e" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#26335e' }} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={44} />
            <Tooltip formatter={(v) => fmtInt(Number(v))} labelStyle={{ color: '#e6ecff', fontWeight: 700 }} itemStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Area key={s.key} type="linear" dataKey={s.key} name={s.name} stackId="1" stroke={PROVIDER_COLORS[s.key]} strokeWidth={2} fill={`url(#g-${s.key})`} isAnimationActive={false} dot={s.key === 'gemini' ? { r: 2.5, fill: '#fff', stroke: '#3b82f6' } : false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-bold">
        {[...series].reverse().map((s) => (
          <span key={s.key} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: PROVIDER_COLORS[s.key] }} />{s.name}</span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
const RANK_COLORS = ['#ffb800', '#c9d3e6', '#ff8a3d', '#8b97c4']

export function TopAgents({ data }: { data: DashboardData['topAgents'] }) {
  const agents = useLabStore((s) => s.agents)
  const nav = useNavigate()
  return (
    <ol className="space-y-1.5">
      {data.map((t, i) => {
        const a = agents.find((x) => x.id === t.agentId)
        if (!a) return null
        return (
          <li key={t.agentId} className="flex items-center gap-2.5 border-b border-white/5 pb-1.5 last:border-0">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold text-[#04120c]" style={{ background: RANK_COLORS[i], borderColor: '#0b1228' }}>{i + 1}</span>
            <Avatar characterId={a.appearance.characterId} size={34} ring={a.appearance.accentColor} />
            <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/agentes/${a.id}`)}>
              <p className="truncate text-[12.5px] font-extrabold">{a.name}</p>
              <p className="truncate text-[10.5px] text-lab-muted">{a.description}</p>
            </button>
            <Chip color="#00f5a0" className="text-[10.5px]">{fmtInt(t.runs)} runs</Chip>
          </li>
        )
      })}
    </ol>
  )
}

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
          <button className="text-lab-muted hover:text-neon-cyan" aria-label={`Configurar ${p.name}`} onClick={() => nav(`/modelos?provider=${p.id}`)}><Settings2 size={15} /></button>
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
export function MissionsPanel() {
  const counters = useGameStore((s) => s.counters)
  const claimed = useGameStore((s) => s.claimed)
  const done = MISSIONS.filter((m) => claimed.includes(m.id) || m.progress(counters) >= m.target).length
  const current = MISSIONS.find((m) => !claimed.includes(m.id)) ?? MISSIONS[MISSIONS.length - 1]
  const prog = Math.min(current.target, current.progress(counters))
  return (
    <div className="flex h-full items-center gap-3">
      <img src={asset('ui/chest.png')} alt="" className="pixel hidden h-14 w-auto sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-lab-muted">Evolua seu lab completando desafios.</p>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={done / MISSIONS.length} className="flex-1" />
          <span className="text-[11px] font-extrabold">{done}/{MISSIONS.length}</span>
        </div>
      </div>
      <Link to="/gamificacao?tab=missoes" className="px-inset group block w-[46%] min-w-[170px] px-2.5 py-1.5 hover:border-neon-gold/70">
        <p className="flex items-center gap-1 text-[11px] font-extrabold text-neon-gold"><Crown size={12} /> Missão Atual</p>
        <p className="truncate text-[11.5px]">{current.title}</p>
        <p className="flex items-center justify-between text-[11px] font-bold">
          <span className="flex items-center gap-1"><PixelIcon name="star" size={14} /> +{current.rewardXp} XP · {prog}/{current.target}</span>
          <ChevronRight size={14} className="text-lab-muted group-hover:text-neon-gold" />
        </p>
      </Link>
    </div>
  )
}

export function QuickActions() {
  const nav = useNavigate()
  return (
    <div className="grid h-full grid-cols-2 gap-2 xl:grid-cols-4">
      <button className="px-btn c-green" onClick={() => nav('/agentes/novo')}><Plus size={14} /> Novo Agente</button>
      <button className="px-btn c-cyan" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => nav('/laboratorio')}><Zap size={14} /> Nova Tarefa</button>
      <button className="px-btn" style={{ ['--c' as string]: '#9d62ff' }} onClick={() => nav('/workflows?novo=1')}><WorkflowIcon size={14} /> Novo Fluxo</button>
      <button className="px-btn" style={{ ['--c' as string]: '#ffb800' }} onClick={() => nav('/conhecimento')}><FileUp size={14} /> Importar Docs</button>
    </div>
  )
}

export function LabActivity({ counters }: { counters: DashboardData['counters'] }) {
  const items = [
    { label: 'Projetos', value: counters.projects, to: '/projetos', icon: FolderKanban },
    { label: 'Fluxos', value: counters.workflows, to: '/workflows', icon: WorkflowIcon },
    { label: 'Bases (RAG)', value: counters.ragBases, to: '/conhecimento', icon: Database },
    { label: 'Integrações', value: counters.integrations, to: '/ferramentas', icon: Plug },
  ]
  return (
    <div className="grid h-full grid-cols-4 gap-1.5">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className="px-inset flex flex-col items-center justify-center py-1 text-center hover:border-neon-cyan/60">
          <span className="text-[10.5px] text-lab-muted">{it.label}</span>
          <span className="title-pixel text-[13px]">{it.value}</span>
        </Link>
      ))}
    </div>
  )
}

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

export function ExperimentsTable({ data }: { data: DashboardData['experiments'] }) {
  return (
    <table className="w-full text-[11px]">
      <thead className="text-left text-lab-muted">
        <tr><th className="pb-1 font-bold">Experimento</th><th className="pb-1 font-bold">Modelo</th><th className="pb-1 font-bold">Métrica (↑)</th><th className="pb-1 font-bold">Status</th><th className="pb-1 font-bold">Data</th></tr>
      </thead>
      <tbody>
        {data.map((e) => (
          <tr key={e.id} className="border-t border-white/5">
            <td className="py-1 pr-2 font-bold">{e.name}</td>
            <td className="py-1 pr-2"><span className="flex items-center gap-1.5"><img src={providerIconUrl(e.provider)} className="pixel h-4 w-4" alt="" />{e.model}</span></td>
            <td className="py-1 pr-2">{e.metric}: <b>{e.value.toLocaleString('pt-BR')}</b></td>
            <td className="py-1 pr-2">{e.status === 'done' ? <Chip color="#00f5a0">Concluído</Chip> : e.status === 'running' ? <Chip color="#39d6ff">Em execução</Chip> : <Chip color="#ff537a">Falhou</Chip>}</td>
            <td className="py-1 text-lab-muted">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

