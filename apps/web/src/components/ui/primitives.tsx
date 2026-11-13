import type { CSSProperties, ReactNode } from 'react'
import { avatarUrl, iconUrl } from '@/lib/assets'

export type Accent = 'green' | 'purple' | 'cyan' | 'gold' | 'pink'

export const ACCENT_HEX: Record<Accent, string> = {
  green: '#00f5a0', purple: '#9d62ff', cyan: '#39d6ff', gold: '#ffb800', pink: '#ff537a',
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** Ícone pixel art gerado (public/assets/ui/icon-*.png). */
export function PixelIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return <img src={iconUrl(name)} width={size} height={size} alt="" aria-hidden className={cx('pixel inline-block shrink-0', className)} />
}

export function Avatar({ characterId, size = 40, ring, className, title }: { characterId: string; size?: number; ring?: string; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx('relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-[4px] bg-[#0a1126]', className)}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring ?? '#26335e'}, 0 0 10px -2px ${ring ?? 'transparent'}` }}
    >
      <img src={avatarUrl(characterId)} alt="" className="pixel h-full w-full" />
    </span>
  )
}

/** Selo obrigatório para dados fictícios (CLAUDE.md §9 e §11). */
export function DemoTag({ className, label = 'DEMO' }: { className?: string; label?: string }) {
  return (
    <span
      title="Dados demonstrativos (fictícios) — não representam consumo ou execuções reais"
      className={cx('hatch inline-flex items-center rounded-[3px] border border-neon-gold/70 px-1 py-px text-[9px] font-extrabold tracking-wider text-neon-gold', className)}
    >
      {label}
    </span>
  )
}

interface PanelProps {
  title?: ReactNode
  icon?: ReactNode
  accent?: Accent
  actions?: ReactNode
  demo?: boolean
  className?: string
  bodyClassName?: string
  children?: ReactNode
  style?: CSSProperties
  stripes?: boolean
  'data-testid'?: string
}

export function Panel({ title, icon, accent = 'purple', actions, demo, className, bodyClassName, children, style, stripes, 'data-testid': testId }: PanelProps) {
  return (
    <section className={cx('px-panel flex min-h-0 flex-col', `c-${accent}`, className)} style={style} data-testid={testId}>
      {title !== undefined && (
        <header className="flex items-center gap-2 border-b border-white/5 px-3 pb-1.5 pt-2">
          {icon && <span className="flex items-center" style={{ color: ACCENT_HEX[accent] }}>{icon}</span>}
          <h2 className="min-w-0 truncate text-[13px] font-extrabold tracking-wide text-lab-text">{title}</h2>
          {stripes && <span className="ml-1 hidden h-2 flex-1 bg-[repeating-linear-gradient(-60deg,rgb(255_255_255/0.25)_0_2px,transparent_2px_6px)] opacity-60 md:block" />}
          {demo && <DemoTag className={stripes ? '' : 'ml-1'} />}
          <div className={cx('flex shrink-0 items-center gap-2', !stripes && 'ml-auto')}>{actions}</div>
        </header>
      )}
      <div className={cx('min-h-0 flex-1 p-3', bodyClassName)}>{children}</div>
    </section>
  )
}

export function ProgressBar({ value, color = '#00f5a0', className, height = 10 }: { value: number; color?: string; className?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cx('px-bar', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%`, ['--c' as string]: color } as CSSProperties} />
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-[18px] w-9 shrink-0 items-center rounded-[3px] border-2 transition-colors disabled:opacity-40',
        checked ? 'border-neon-green bg-neon-green/80 shadow-[0_0_8px_#00f5a0]' : 'border-lab-line bg-[#0a1126]',
      )}
    >
      <span className={cx('absolute top-[1px] h-3 w-3 rounded-[2px] bg-white transition-all', checked ? 'left-[19px]' : 'left-[2px] bg-lab-muted')} />
    </button>
  )
}

export function Chip({ children, color = '#39d6ff', className, title }: { children: ReactNode; color?: string; className?: string; title?: string }) {
  return (
    <span className={cx('px-chip', className)} style={{ ['--c' as string]: color } as CSSProperties} title={title}>
      {children}
    </span>
  )
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex flex-wrap gap-1.5', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            'rounded-[4px] border px-3 py-1 text-[11px] font-bold transition-colors',
            value === it.id ? 'border-neon-green bg-neon-green text-[#04120c] shadow-[0_0_8px_-1px_#00f5a0]' : 'border-lab-line bg-[#0a1126] text-lab-muted hover:border-neon-green/60 hover:text-lab-text',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="px-label">
        {label} {required && <span className="text-neon-pink">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[10px] text-neon-pink">{error}</span> : hint ? <span className="mt-1 block text-[10px] text-lab-muted/80">{hint}</span> : null}
    </label>
  )
}

export function EmptyState({ title, children, icon = 'bot' }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-lab-muted">
      <PixelIcon name={icon} size={32} className="opacity-80" />
      <p className="font-bold text-lab-text">{title}</p>
      {children}
    </div>
  )
}

export function PlannedBadge({ className }: { className?: string }) {
  return (
    <span title="Funcionalidade planejada — ainda não implementada" className={cx('inline-flex items-center rounded-[3px] border border-neon-purple/70 bg-neon-purple/10 px-1.5 py-px text-[9px] font-extrabold tracking-wider text-neon-purple', className)}>
      PLANEJADO
    </span>
  )
}
