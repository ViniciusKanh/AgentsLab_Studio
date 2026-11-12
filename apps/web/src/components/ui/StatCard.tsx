import type { Kpi } from '@/types/domain'
import { fmtCompact, fmtInt, fmtPct, fmtSec, fmtUsd } from '@/lib/format'
import { PixelIcon, cx, type Accent } from './primitives'

export function formatKpi(k: Pick<Kpi, 'value' | 'format'>) {
  switch (k.format) {
    case 'compact': return fmtCompact(k.value)
    case 'seconds': return fmtSec(k.value)
    case 'percent': return fmtPct(k.value)
    case 'currency': return fmtUsd(k.value)
    default: return fmtInt(k.value)
  }
}

export function StatCard({ kpi, icon, accent, compact }: { kpi: Kpi; icon: string; accent: Accent; compact?: boolean }) {
  const good = kpi.invert ? kpi.delta < 0 : kpi.delta >= 0
  const deltaTxt = kpi.deltaUnit === 'abs' ? `${kpi.delta >= 0 ? '+' : ''}${kpi.delta} vs. período anterior` : kpi.deltaUnit === 'pp' ? `${kpi.delta >= 0 ? '+' : ''}${kpi.delta.toLocaleString('pt-BR')} p.p.` : `${kpi.delta >= 0 ? '+' : ''}${kpi.delta.toLocaleString('pt-BR')}%`
  return (
    <div className={cx('px-panel flex items-center gap-3 px-3', compact ? 'py-1.5' : 'py-2', `c-${accent}`)} data-testid={`kpi-${kpi.key}`}>
      <PixelIcon name={icon} size={compact ? 28 : 34} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]" />
      <div className="min-w-0">
        <p className="truncate text-[11.5px] text-lab-muted">{kpi.label}</p>
        <p className={cx('title-pixel leading-none text-white', compact ? 'text-[14px]' : 'text-[17px]')}>{formatKpi(kpi)}</p>
        <p className={cx('mt-0.5 truncate text-[10.5px] font-bold', good ? 'text-neon-green' : 'text-neon-pink')}>
          {kpi.delta >= 0 ? '▲' : '▼'} {deltaTxt}
        </p>
      </div>
    </div>
  )
}
