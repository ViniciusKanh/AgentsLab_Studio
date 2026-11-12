import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Home, Plus, Crown, Bot, Zap, ScrollText, FlaskConical, Server, Play, BarChart3 } from 'lucide-react'
import type { DashboardPeriod } from '@/types/domain'
import { dataSource } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { DemoTag, Panel, type Accent } from '@/components/ui/primitives'
import { StatCard } from '@/components/ui/StatCard'
import { AgentsGrid, ExperimentsTable, LabActivity, LiveLogs, MissionsPanel, ProvidersPanel, QuickActions, RecentRuns, TokenUsageChart, TopAgents } from './widgets'

const KPI_STYLE: Record<string, [string, Accent]> = {
  agents: ['bot', 'green'], tasks: ['layers', 'purple'], runs: ['bolt', 'cyan'], tokens: ['coin', 'gold'], latency: ['clock', 'pink'], success: ['target', 'cyan'],
}

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: '24h', label: 'Últimas 24 horas' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('7d')
  const agentsCount = useLabStore((s) => s.agents.length)
  const workflowsCount = useLabStore((s) => s.workflows.length)
  const providers = useLabStore((s) => s.providers)
  const sessionRuns = useSimulationStore((s) => s.sessionRuns)
  const { data, loading } = useAsync(() => dataSource.getDashboard(period), [period, agentsCount, workflowsCount])
  const nav = useNavigate()

  const runs = useMemo(() => [...sessionRuns, ...(data?.recentRuns ?? [])].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)), [sessionRuns, data])
  const demo = data?.origin === 'demo'

  return (
    <div className="flex flex-col gap-2.5" data-testid="dashboard-page">
      {/* cabeçalho da página */}
      <div className="px-panel c-purple flex flex-wrap items-center gap-3 px-3 py-2">
        <Home size={34} className="text-neon-pink drop-shadow-[0_0_6px_#ff537a]" />
        <div className="min-w-0">
          <h1 className="title-pixel text-[15px] text-white">Dashboard do Laboratório</h1>
          <p className="text-[12px] text-lab-muted">Visão geral dos seus agentes, execuções, consumo e produtividade. {demo && <DemoTag className="ml-1 align-middle" label="DADOS DEMO" />}</p>
        </div>
        <label className="relative ml-auto flex items-center">
          <CalendarDays size={15} className="pointer-events-none absolute left-2.5 text-lab-muted" />
          <select aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)} className="px-input w-[230px] cursor-pointer py-1.5 pl-8 font-bold">
            {PERIODS.map((p) => <option key={p.id} value={p.id}>Período: {p.label}</option>)}
          </select>
        </label>
        <button className="px-btn solid px-5 text-[13px]" onClick={() => nav('/agentes/novo')}><Plus size={16} strokeWidth={3} /> Novo Agente</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {(data?.kpis ?? []).map((k) => <StatCard key={k.key} kpi={k} icon={KPI_STYLE[k.key][0]} accent={KPI_STYLE[k.key][1]} compact />)}
        {loading && !data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="px-panel h-[70px] animate-pulse" />)}
      </div>

      {/* gráficos e rankings */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel className="lg:col-span-5" accent="purple" icon={<BarChart3 size={18} />} title="Uso de Tokens por Provedor" demo={demo}>
          {data && <TokenUsageChart data={data.tokenSeries} height={170} />}
        </Panel>
        <Panel className="lg:col-span-4" accent="purple" icon={<Crown size={18} className="text-neon-gold" />} title="Agentes Mais Utilizados" demo={demo}>
          {data && <TopAgents data={data.topAgents} />}
        </Panel>
        <Panel className="lg:col-span-3" accent="purple" icon={<Server size={18} className="text-neon-gold" />} title="Provedores de Modelos (LLMs)">
          <ProvidersPanel providers={providers} compact />
        </Panel>
      </div>

      {/* agentes + execuções */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" accent="purple" icon={<Bot size={18} className="text-neon-cyan" />} title={`Seus Agentes (${agentsCount})`}>
          <AgentsGrid limit={4} />
        </Panel>
        <Panel className="lg:col-span-4" accent="purple" icon={<Play size={16} className="text-neon-gold" />} title="Execuções Recentes" demo={demo}
          actions={<button className="text-[11px] font-bold text-lab-muted hover:text-neon-cyan" onClick={() => nav('/execucoes')}>Ver todas →</button>}>
          <RecentRuns runs={runs} max={5} />
        </Panel>
      </div>

      {/* missões, ações e atividade */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel className="lg:col-span-5" accent="gold" icon={<ScrollText size={18} className="text-neon-gold" />} title="Missões do Laboratório">
          <MissionsPanel />
        </Panel>
        <Panel className="lg:col-span-4" accent="green" icon={<Zap size={18} />} title="Ações Rápidas">
          <QuickActions />
        </Panel>
        <Panel className="lg:col-span-3" accent="cyan" icon={<BarChart3 size={18} />} title="Atividade do Lab" demo={demo}>
          {data && <LabActivity counters={data.counters} />}
        </Panel>
      </div>

      {/* experimentos e logs */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" accent="cyan" icon={<FlaskConical size={18} />} title="Experimentos Recentes" demo={demo}>
          {data && <ExperimentsTable data={data.experiments} />}
        </Panel>
        <Panel className="lg:col-span-5" accent="green" icon={<ScrollText size={18} />} title="Logs em Tempo Real" demo bodyClassName="h-[150px]">
          <LiveLogs max={8} />
        </Panel>
      </div>
    </div>
  )
}
