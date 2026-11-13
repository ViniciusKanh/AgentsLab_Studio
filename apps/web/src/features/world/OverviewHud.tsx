import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Overview } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useBackendStore } from '@/services/backend'
import { fmtCost, fmtInt } from '@/lib/format'

/** Visão geral sobre o ambiente: números REAIS do backend (sem backend, apenas aviso). */
export function OverviewHud() {
  const status = useBackendStore((s) => s.status)
  const [ov, setOv] = useState<Overview | null>(null)
  useEffect(() => {
    if (status !== 'online') return setOv(null)
    let alive = true
    let t: ReturnType<typeof setTimeout> | null = null
    const load = () => platform.overview().then((o) => { if (alive) setOv(o) }).catch(() => undefined)
    void load()
    const off = onPlatformEvent((e) => {
      if (!['project.updated', 'task.finished', 'execution'].includes(e.type) || t) return
      t = setTimeout(() => { t = null; void load() }, 600)
    })
    return () => { alive = false; off(); if (t) clearTimeout(t) }
  }, [status])

  if (appConfig.mode !== 'real') {
    return (
      <div className="absolute bottom-3 left-3 right-3 max-w-[300px] rounded-[8px] border border-neon-gold/50 bg-[#070b17]/92 p-3 text-[11px]" data-testid="overview-offline">
        <p className="font-extrabold text-neon-gold">Backend desconectado</p>
        <p className="mt-1 text-lab-muted">Você está vendo agentes de exemplo. Nada é executado até o servidor local ser iniciado.</p>
        <Link to="/configuracoes" className="mt-1.5 inline-block font-bold text-neon-cyan">Configurar conexão →</Link>
      </div>
    )
  }
  if (!ov) return null
  const active = ov.projects.running + ov.projects.revising + ov.projects.planning
  return (
    <div className="absolute bottom-3 left-3 hidden w-[300px] rounded-[8px] sm:block border border-lab-line/70 bg-[#070b17]/92 p-3 text-[11px]" data-testid="overview-hud">
      <p className="mb-2 font-extrabold">Visão geral</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Stat label="Projetos ativos" value={fmtInt(active)} />
        <Stat label="Aguardando você" value={fmtInt(ov.pendingApprovals)} hot={ov.pendingApprovals > 0} />
        <Stat label="Custo total" value={fmtCost(ov.costUsd)} />
      </div>
      {ov.runningTasks.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {ov.runningTasks.slice(0, 3).map((t) => <li key={t.id} className="truncate text-lab-muted">▸ {t.title} <span className="text-neon-cyan">({t.step || 'iniciando'})</span></li>)}
        </ul>
      )}
      {ov.credentials === 0 && <p className="mt-2 text-neon-gold">Nenhuma chave cadastrada. <Link to="/provedores?tab=chaves" className="font-bold text-neon-cyan">Cadastrar →</Link></p>}
      <Link to="/projetos" className="mt-2 block text-right font-bold text-neon-cyan">Projetos →</Link>
    </div>
  )
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-[5px] bg-white/5 px-1 py-1.5">
      <p className={hot ? 'text-[13px] font-extrabold text-neon-gold' : 'text-[13px] font-extrabold'}>{value}</p>
      <p className="text-[9.5px] text-lab-muted">{label}</p>
    </div>
  )
}
