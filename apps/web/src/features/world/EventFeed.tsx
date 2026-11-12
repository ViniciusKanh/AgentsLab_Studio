import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWorldStore } from '@/stores/worldStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { cx } from '@/components/ui/primitives'
import { fmtClock } from '@/lib/format'

const KIND: Record<string, [string, string]> = {
  ambiente: ['ambiente', '#9aa6bf'],
  'operacional-demo': ['operacional · demo', '#ffb800'],
  'operacional-real': ['operacional', '#00f5a0'],
}

/** Faixa inferior recolhível com eventos recentes. */
export function EventFeed() {
  const feed = useWorldStore((s) => s.feed)
  const open = useWorldStore((s) => s.feedOpen)
  const setOpen = useWorldStore((s) => s.setFeedOpen)
  const select = useSimulationStore((s) => s.select)
  const [filter, setFilter] = useState<'todos' | 'operacional' | 'ambiente'>('todos')
  const list = useMemo(() => feed.filter((f) => filter === 'todos' || (filter === 'ambiente' ? f.kind === 'ambiente' : f.kind !== 'ambiente')).slice(0, 12), [feed, filter])
  return (
    <section className={cx('shrink-0 border-t border-lab-line/60 bg-[#0a1023]/95 transition-[height]', open ? 'h-[118px]' : 'h-8')} data-testid="event-feed">
      <header className="flex h-8 items-center gap-3 px-3">
        <button className="flex items-center gap-1.5 text-[11.5px] font-extrabold" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />} Eventos recentes
        </button>
        {!open && list[0] && <span className="truncate text-[11px] text-lab-muted">{list[0].text}</span>}
        {open && (
          <div className="ml-auto flex gap-1">
            {(['todos', 'operacional', 'ambiente'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cx('rounded-[4px] px-2 py-0.5 text-[10.5px] font-bold capitalize', filter === f ? 'bg-white/10 text-white' : 'text-lab-muted hover:text-white')}>{f}</button>
            ))}
          </div>
        )}
      </header>
      {open && (
        <ul className="grid h-[86px] grid-cols-1 content-start gap-x-6 overflow-y-auto px-3 pb-2 md:grid-cols-2">
          {list.length === 0 && <li className="text-[11px] text-lab-muted">Observe o ambiente — os eventos aparecerão aqui.</li>}
          {list.map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-2 py-0.5 text-[11.5px]">
              <span className="font-mono text-[10px] text-lab-muted">{fmtClock(f.ts)}</span>
              <span className="shrink-0 rounded-[3px] px-1 text-[9px] font-extrabold uppercase" style={{ color: KIND[f.kind][1], border: `1px solid ${KIND[f.kind][1]}66` }}>{KIND[f.kind][0]}</span>
              <button className="truncate text-left hover:text-neon-cyan" onClick={() => f.agentId && select(f.agentId)}>{f.text}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
