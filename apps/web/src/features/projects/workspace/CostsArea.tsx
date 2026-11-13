import { useMemo, useState } from 'react'
import type { Execution } from '@/types/platform'
import { platform } from '@/services/platform'
import { useUiStore } from '@/stores/uiStore'
import { Panel, ProgressBar, Tabs } from '@/components/ui/primitives'
import { fmtClock, fmtCost, fmtInt } from '@/lib/format'
import { Empty, useAgentName, type WorkspaceData } from './shared'

type Row = { key: string; label: string; calls: number; tokens: number; cost: number; errors: number }

function groupBy(exes: Execution[], key: (e: Execution) => string, label: (k: string) => string): Row[] {
  const m = new Map<string, Row>()
  for (const e of exes) {
    const k = key(e)
    const r = m.get(k) ?? { key: k, label: label(k), calls: 0, tokens: 0, cost: 0, errors: 0 }
    if (e.status === 'ok') { r.calls++; r.tokens += e.inputTokens + e.outputTokens; r.cost += e.costUsd } else r.errors++
    m.set(k, r)
  }
  return [...m.values()].sort((a, b) => b.cost - a.cost || b.tokens - a.tokens)
}

/** Custos reais por agente, tarefa, modelo e projeto (tarifas do LiteLLM: estimativa). */
export function CostsArea({ data }: { data: WorkspaceData }) {
  const { project, executions } = data
  const name = useAgentName()
  const [by, setBy] = useState<'agente' | 'tarefa' | 'modelo'>('agente')
  const tasks = project.tasks ?? []
  const ok = executions.filter((e) => e.status === 'ok')
  const tokens = ok.reduce((n, e) => n + e.inputTokens + e.outputTokens, 0)
  const rows = useMemo(() => {
    if (by === 'agente') return groupBy(executions, (e) => e.agentId ?? '—', (k) => name(k))
    if (by === 'tarefa') return groupBy(executions, (e) => e.taskId ?? 'plano', (k) => { const t = tasks.find((x) => x.id === k); return t ? `${t.key} — ${t.title}` : 'Planejamento (coordenador)' })
    return groupBy(executions, (e) => `${e.provider}/${e.model}`, (k) => k)
  }, [by, executions, tasks, name])
  const max = Math.max(...rows.map((r) => r.cost || r.tokens / 1e6), 1e-9)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Custo do projeto" value={fmtCost(project.costUsd)} sub={`de ${fmtCost(project.budgetUsd)} de orçamento`} bar={project.costUsd / project.budgetUsd} />
        <Tile label="Chamadas de modelo" value={fmtInt(project.llmCalls)} sub={`${executions.filter((e) => e.status === 'retry').length} retentativas · ${executions.filter((e) => e.status === 'error').length} erros`} />
        <Tile label="Tokens" value={fmtInt(tokens)} sub={`${fmtInt(ok.reduce((n, e) => n + e.inputTokens, 0))} entrada · ${fmtInt(ok.reduce((n, e) => n + e.outputTokens, 0))} saída`} />
        <BudgetTile projectId={project.id} budget={project.budgetUsd} cost={project.costUsd} onSaved={data.reload} />
      </div>
      <Panel accent="gold" title="Distribuição" actions={<Tabs value={by} onChange={setBy} items={[{ id: 'agente', label: 'Por agente' }, { id: 'tarefa', label: 'Por tarefa' }, { id: 'modelo', label: 'Por modelo' }]} />}>
        {rows.length === 0 ? <Empty>Nenhuma chamada registrada.</Empty> : (
          <table className="w-full text-[13px]" data-testid="costs-breakdown">
            <thead className="text-left text-[11.5px] uppercase tracking-wide text-lab-muted"><tr><th className="pb-2">{by === 'agente' ? 'Agente' : by === 'tarefa' ? 'Tarefa' : 'Provedor/modelo'}</th><th>Chamadas</th><th>Tokens</th><th className="w-[30%]" /><th className="text-right">Custo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-white/5">
                  <td className="py-2 pr-2">{r.label}</td>
                  <td>{r.calls}{r.errors ? <span className="text-neon-pink"> +{r.errors} falha(s)</span> : ''}</td>
                  <td>{fmtInt(r.tokens)}</td>
                  <td className="pr-3"><ProgressBar value={(r.cost || r.tokens / 1e6) / max} height={8} color="#ffb800" /></td>
                  <td className="text-right font-mono">{fmtCost(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[12px] text-lab-muted">Custos calculados com as tarifas conhecidas pelo LiteLLM (estimativa; provedores gratuitos ou sem tarifa aparecem como US$ 0). Tokens são os informados pelo provedor.</p>
      </Panel>
      <Panel accent="purple" title={`Chamadas de modelo (${executions.length})`}>
        {executions.length === 0 ? <Empty>Nenhuma chamada registrada.</Empty> : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-[12.5px]" data-testid="executions-table">
              <thead className="sticky top-0 bg-[#0c1530] text-left text-[11.5px] uppercase tracking-wide text-lab-muted"><tr><th className="py-1.5">Hora</th><th>Agente</th><th>Tarefa</th><th>Finalidade</th><th>Modelo</th><th>Tokens (in/out)</th><th>Latência</th><th className="text-right">Custo</th></tr></thead>
              <tbody>
                {executions.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 align-top">
                    <td className="py-1.5">{fmtClock(e.createdAt)}</td>
                    <td>{name(e.agentId)}</td>
                    <td className="font-mono">{tasks.find((t) => t.id === e.taskId)?.key ?? '—'}</td>
                    <td className={e.status !== 'ok' ? 'text-neon-pink' : ''}>{e.purpose}{e.status === 'retry' && ' (retentativa)'}{e.status !== 'ok' && <span className="block max-w-[320px] text-[11.5px]">{e.error.slice(0, 160)}</span>}</td>
                    <td className="font-mono text-[12px]">{e.provider}/{e.model}</td>
                    <td>{fmtInt(e.inputTokens)} / {fmtInt(e.outputTokens)}</td>
                    <td>{(e.latencyMs / 1000).toFixed(1)} s</td>
                    <td className="text-right">{fmtCost(e.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function Tile({ label, value, sub, bar }: { label: string; value: string; sub: string; bar?: number }) {
  return (
    <div className="px-panel c-cyan flex flex-col gap-1 p-3">
      <span className="px-label">{label}</span>
      <b className="text-[20px]">{value}</b>
      {bar !== undefined && <ProgressBar value={bar} height={6} color={bar > 0.85 ? '#ff537a' : '#00f5a0'} />}
      <span className="text-[12px] text-lab-muted">{sub}</span>
    </div>
  )
}

function BudgetTile({ projectId, budget, cost, onSaved }: { projectId: string; budget: number; cost: number; onSaved: () => Promise<void> }) {
  const toast = useUiStore((s) => s.toast)
  const [v, setV] = useState(Math.max(budget, +(cost + 0.5).toFixed(2)))
  return (
    <div className="px-panel c-gold flex flex-col gap-1.5 p-3">
      <span className="px-label">Orçamento do projeto (US$)</span>
      <div className="flex gap-2">
        <input type="number" step={0.5} min={0.01} className="px-input py-1" value={v} onChange={(e) => setV(+e.target.value)} aria-label="Novo orçamento" />
        <button className="px-btn sm" disabled={v === budget || v <= 0} onClick={() => void platform.setBudget(projectId, v).then(() => { toast('Orçamento atualizado', 'success'); return onSaved() }).catch((e: Error) => toast(e.message, 'error'))}>Salvar</button>
      </div>
      <span className="text-[12px] text-lab-muted">Ao atingir o limite a execução pausa e o coordenador pede sua decisão.</span>
    </div>
  )
}
