import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Plus, Search } from 'lucide-react'
import { useLabStore } from '@/stores/labStore'
import { Panel, Tabs } from '@/components/ui/primitives'
import { AgentMiniCard } from '@/features/agents/widgets'

type F = 'all' | 'active' | 'paused' | 'archived'

export default function AgentsPage() {
  const agents = useLabStore((s) => s.agents)
  const [f, setF] = useState<F>('all')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const depts = useMemo(() => [...new Set(agents.map((a) => a.department))].sort(), [agents])
  const list = agents.filter((a) => (f === 'all' || a.status === f) && (!dept || a.department === dept) && (!q || `${a.name} ${a.role} ${a.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="flex flex-col gap-2.5" data-testid="agents-page">
      <div className="px-panel c-cyan flex flex-wrap items-center gap-3 px-3 py-2">
        <Bot size={30} className="text-neon-cyan" />
        <div>
          <h1 className="title-pixel text-[15px]">Agentes de IA</h1>
          <p className="text-[12px] text-lab-muted">{agents.length} agentes configurados · criar, editar, duplicar, pausar e excluir</p>
        </div>
        <Link to="/agentes/novo" className="px-btn solid ml-auto"><Plus size={15} /> Novo Agente</Link>
      </div>
      <Panel accent="purple" title="Equipe" actions={
        <div className="flex items-center gap-2">
          <select className="px-input w-44 py-1" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Departamento"><option value="">Todos os departamentos</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          <label className="relative w-52"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-lab-muted" /><input className="px-input py-1 pl-7" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar agentes" /></label>
        </div>
      }>
        <Tabs value={f} onChange={setF} className="mb-3" items={[
          { id: 'all', label: `Todos (${agents.length})` }, { id: 'active', label: `Ativos (${agents.filter((a) => a.status === 'active').length})` },
          { id: 'paused', label: `Pausados (${agents.filter((a) => a.status === 'paused').length})` }, { id: 'archived', label: `Arquivados (${agents.filter((a) => a.status === 'archived').length})` },
        ]} />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {list.map((a) => <AgentMiniCard key={a.id} agent={a} />)}
          <Link to="/agentes/novo" className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-lab-line text-[12px] font-bold text-lab-muted hover:border-neon-green hover:text-neon-green"><Plus size={22} /> Criar Novo Agente</Link>
        </div>
        {list.length === 0 && <p className="mt-3 text-[12px] text-lab-muted">Nenhum agente corresponde aos filtros.</p>}
      </Panel>
    </div>
  )
}
