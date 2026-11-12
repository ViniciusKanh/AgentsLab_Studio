import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, Copy, Pencil, Trash2 } from 'lucide-react'
import { useLabStore } from '@/stores/labStore'
import { envPath } from '@/world/maps'
import { useSimulationStore } from '@/stores/simulationStore'
import { STATE_META } from '@/simulation/states'
import { Avatar, Chip, DemoTag, Panel, PlannedBadge, ProgressBar, Tabs, Toggle } from '@/components/ui/primitives'
import { ConfirmModal } from '@/components/ui/Modal'
import { RecentRuns } from '@/features/dashboard/widgets'
import { KNOWLEDGE_BASES, TOOLS_CATALOG } from '@/services/demo/demoData'
import { fmtClock, fmtCompact, fmtInt, fmtUsd } from '@/lib/format'
import { providerIconUrl } from '@/lib/assets'

type T = 'geral' | 'config' | 'memoria' | 'logs' | 'avaliacao'

export default function AgentProfilePage() {
  const { agentId } = useParams()
  const nav = useNavigate()
  const { agents, setAgentStatus, duplicateAgent, deleteAgent, loaded } = useLabStore()
  const a = agents.find((x) => x.id === agentId)
  const rt = useSimulationStore((s) => (agentId ? s.runtime[agentId] : undefined))
  const allRuns = useSimulationStore((s) => s.sessionRuns)
  const allLogs = useSimulationStore((s) => s.logs)
  const runs = useMemo(() => allRuns.filter((r) => r.agentId === agentId), [allRuns, agentId])
  const logs = useMemo(() => allLogs.filter((l) => l.agentId === agentId), [allLogs, agentId])
  const select = useSimulationStore((s) => s.select)
  const [tab, setTab] = useState<T>('geral')
  const [confirm, setConfirm] = useState(false)
  if (!a) return loaded ? <Panel title="Agente não encontrado"><Link to="/agentes" className="text-neon-cyan">← Voltar</Link></Panel> : null
  const meta = STATE_META[rt?.state ?? 'idle']
  const xpNext = a.level * 600
  const demo = a.origin === 'demo'
  return (
    <div className="flex flex-col gap-2.5" data-testid="agent-profile">
      <div className="px-panel flex flex-wrap items-center gap-3 px-3 py-2.5" style={{ ['--c' as string]: a.appearance.accentColor }}>
        <Avatar characterId={a.appearance.characterId} size={72} ring={a.appearance.accentColor} />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[18px] font-extrabold">› {a.name} <Chip color={a.status === 'active' ? '#00f5a0' : '#ffb800'}>{a.status === 'active' ? 'Ativo' : a.status === 'paused' ? 'Pausado' : 'Arquivado'}</Chip><Chip color="#8b97c4">v{a.version}</Chip></h1>
          <p className="text-[12px] text-lab-muted">{a.description || a.objective}</p>
          <p className="mt-1 text-[11px]">Estado atual: <b style={{ color: meta.color }}>{meta.label}</b>{rt?.taskTitle && <> · {rt.taskTitle}</>}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className="px-btn sm" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => { select(a.id); nav(envPath(a.environmentId)) }}><Activity size={13} /> Ver na sala</button>
          <button className="px-btn sm" onClick={() => nav(`/agentes/${a.id}/editar`)}><Pencil size={13} /> Editar</button>
          <button className="px-btn sm" style={{ ['--c' as string]: '#9d62ff' }} onClick={async () => { const c = await duplicateAgent(a.id); nav(`/agentes/${c.id}`) }}><Copy size={13} /> Duplicar</button>
          <button className="px-btn sm" style={{ ['--c' as string]: '#ff537a' }} onClick={() => setConfirm(true)}><Trash2 size={13} /> Excluir</button>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'geral', label: 'Visão Geral' }, { id: 'config', label: 'Configuração' }, { id: 'memoria', label: 'Memória' }, { id: 'logs', label: 'Logs' }, { id: 'avaliacao', label: 'Avaliação' }]} />

      {tab === 'geral' && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
          <Panel accent="cyan" title="Resumo" className="lg:col-span-2">
            <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[12px]">
              <dt className="text-lab-muted">Modelo</dt><dd className="flex items-center gap-1.5"><img src={providerIconUrl(a.intelligence.provider)} className="pixel h-4 w-4" alt="" /> {a.intelligence.model}</dd>
              <dt className="text-lab-muted">Papel</dt><dd>{a.role} · {a.department}</dd>
              <dt className="text-lab-muted">Ferramentas</dt><dd className="flex flex-wrap gap-1">{a.tools.length ? a.tools.map((t) => <Chip key={t} color="#9d62ff">{TOOLS_CATALOG.find((x) => x.id === t)?.name ?? t}</Chip>) : '—'}</dd>
              <dt className="text-lab-muted">Conhecimento</dt><dd>{a.knowledge.ragEnabled ? KNOWLEDGE_BASES.find((k) => k.id === a.knowledge.ragBaseId)?.name ?? a.knowledge.ragBaseId : 'Sem RAG'} · memória {a.knowledge.memory}</dd>
              <dt className="text-lab-muted">Tokens (30d)</dt><dd>{fmtCompact(a.stats.tokens30d)} {demo && <DemoTag />}</dd>
              <dt className="text-lab-muted">Execuções</dt><dd>{fmtInt(a.stats.runs)} · sucesso {(a.stats.successRate * 100).toFixed(1)}% {demo && <DemoTag />}</dd>
              <dt className="text-lab-muted">Custo (30d)</dt><dd>{fmtUsd(a.stats.costUsd30d)} <span className="text-[10px] text-lab-muted">(estimativa)</span> {demo && <DemoTag />}</dd>
            </dl>
          </Panel>
          <Panel accent="green" title="Status e Nível">
            <div className="flex items-center justify-between text-[12px]">Ativo<Toggle checked={a.status === 'active'} onChange={(v) => void setAgentStatus(a.id, v ? 'active' : 'paused')} label="Ativar agente" /></div>
            <div className="mt-2 flex items-center justify-between text-[12px]">Arquivado<Toggle checked={a.status === 'archived'} onChange={(v) => void setAgentStatus(a.id, v ? 'archived' : 'paused')} label="Arquivar agente" /></div>
            <p className="mt-3 text-[11px] text-lab-muted">Nível {a.level} · {fmtInt(a.xp)} / {fmtInt(xpNext)} XP</p>
            <ProgressBar value={a.xp / xpNext} color="#ffb800" />
            <p className="mt-3 text-[11px] text-lab-muted">Tokens nesta sessão: <b className="text-lab-text">{fmtInt(rt?.tokensSession ?? 0)}</b> (simulação)</p>
          </Panel>
        </div>
      )}
      {tab === 'config' && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <Panel accent="purple" title="Instruções de sistema"><pre className="whitespace-pre-wrap rounded-[4px] bg-[#050913] p-2 text-[11.5px]">{a.intelligence.instructions}</pre></Panel>
          <Panel accent="gold" title="Limites e regras">
            <dl className="grid grid-cols-[170px_1fr] gap-y-1.5 text-[12px]">
              <dt className="text-lab-muted">Tokens por execução</dt><dd>{fmtInt(a.limits.maxTokensPerRun)}</dd>
              <dt className="text-lab-muted">Custo diário máx.</dt><dd>{fmtUsd(a.limits.maxCostPerDayUsd)}</dd>
              <dt className="text-lab-muted">Timeout</dt><dd>{a.limits.timeoutSec} s</dd>
              <dt className="text-lab-muted">Retentativas</dt><dd>{a.limits.maxRetries}</dd>
              <dt className="text-lab-muted">Autonomia</dt><dd>{a.rules.autonomy}</dd>
              <dt className="text-lab-muted">Revisão humana</dt><dd>{a.rules.requireHumanReview ? 'Obrigatória' : 'Opcional'}</dd>
              <dt className="text-lab-muted">Delegação</dt><dd>{a.rules.allowDelegation ? 'Permitida' : 'Bloqueada'}</dd>
              <dt className="text-lab-muted">Restrições</dt><dd>{a.rules.restrictions || '—'}</dd>
            </dl>
          </Panel>
        </div>
      )}
      {tab === 'memoria' && (
        <Panel accent="cyan" title={<span className="flex items-center gap-2">Memória e contexto <PlannedBadge /></span>}>
          <p className="text-[12px] text-lab-muted">Modo configurado: <b className="text-lab-text">{a.knowledge.memory}</b>. A inspeção de memória persistente (resumos, vetores e histórico) será implementada com o backend (Fase 4).</p>
          <p className="mt-2 text-[12px]">Fontes: {a.knowledge.sources.join(', ') || '—'} · Documentos: {a.knowledge.documents.join(', ') || '—'}</p>
        </Panel>
      )}
      {tab === 'logs' && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <Panel accent="green" title="Execuções nesta sessão" demo>{runs.length ? <RecentRuns runs={runs} max={12} /> : <p className="text-[12px] text-lab-muted">Sem execuções registradas ainda.</p>}</Panel>
          <Panel accent="purple" title="Eventos" demo>
            <div className="max-h-[300px] overflow-auto font-mono text-[11px]">{logs.length ? logs.slice().reverse().map((l) => <p key={l.id}><span className="text-lab-muted">[{fmtClock(l.ts)}]</span> {l.message}</p>) : <p className="text-lab-muted">Sem eventos.</p>}</div>
          </Panel>
        </div>
      )}
      {tab === 'avaliacao' && (
        <Panel accent="gold" title={<span className="flex items-center gap-2">Avaliação <DemoTag /></span>}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[['Taxa de sucesso', `${(a.stats.successRate * 100).toFixed(1)}%`], ['Latência média', `${a.stats.avgLatencySec.toFixed(1)} s`], ['Execuções (30d)', fmtInt(a.stats.runs)], ['Custo/execução', a.stats.runs ? fmtUsd(a.stats.costUsd30d / a.stats.runs) : '—']].map(([k, v]) => (
              <div key={k} className="px-inset p-2 text-center"><p className="text-[10.5px] text-lab-muted">{k}</p><p className="title-pixel text-[13px]">{v}</p></div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-lab-muted">Benchmarks comparativos reais pertencem à Fase 6 (Experiments).</p>
        </Panel>
      )}
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={async () => { await deleteAgent(a.id); nav('/agentes') }} title="Excluir agente" message={<>Excluir <b>{a.name}</b> definitivamente do armazenamento local?</>} confirmLabel="Excluir" />
    </div>
  )
}
