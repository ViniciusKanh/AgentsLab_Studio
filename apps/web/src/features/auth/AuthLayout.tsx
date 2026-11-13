import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Eye, EyeOff, Layers, Zap, type LucideIcon } from 'lucide-react'
import { LogoEmblem } from '@/components/brand/Logo'
import { cx } from '@/components/ui/primitives'

const scene = (name: string) => `${import.meta.env.BASE_URL}auth/${name}`

/**
 * Moldura das telas de autenticação (protótipos): cenário pixel art à esquerda e formulário à direita.
 * No celular o cenário vira uma faixa no topo e o formulário ocupa a largura toda.
 */
export function AuthLayout({ variant, children }: { variant: 'login' | 'register'; children: ReactNode }) {
  const img = variant === 'login' ? 'login-scene.webp' : 'register-scene.webp'
  return (
    <div className="auth-page min-h-full w-full overflow-y-auto text-lab-text" data-testid={`auth-${variant}`}>
      <div className="mx-auto flex min-h-full max-w-[1500px] flex-col px-3 py-4 sm:px-6 lg:py-6">
        {variant === 'login' && (
          <header className="mb-4 flex items-center justify-center gap-4">
            <span className="hidden h-px w-24 bg-neon-green/60 sm:block" />
            <Link to="/" className="flex items-center gap-3" aria-label="AgentsLab_Studio">
              <LogoEmblem size={44} />
              <span className="title-pixel text-[15px] sm:text-[22px]">AgentsLab<span className="text-neon-green">_Studio</span></span>
            </Link>
            <span className="hidden h-px w-24 bg-neon-green/60 sm:block" />
          </header>
        )}
        <div className={cx('grid flex-1 items-stretch gap-4 lg:gap-6', variant === 'login' ? 'lg:grid-cols-[1.05fr_0.95fr]' : 'lg:grid-cols-[1fr_1fr]')}>
          <section className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-[10px] border border-neon-purple/50 shadow-[0_0_24px_-8px_#9d62ff] lg:min-h-[460px] lg:flex-1">
              <img src={scene(img)} alt="Laboratório pixel art com agentes de IA trabalhando" className="pixel h-40 w-full object-cover sm:h-64 lg:absolute lg:inset-0 lg:h-full lg:min-h-[420px]" />
              <span className="auth-pixels pointer-events-none absolute left-2 top-2 h-8 w-16 opacity-60" />
            </div>
            {variant === 'login' && <FeatureStrip />}
          </section>
          <section className="flex items-center justify-center">
            <div className="auth-card-frame w-full max-w-[640px]">
              <div className="auth-card px-5 py-6 sm:px-9 sm:py-8">{children}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function FeatureStrip() {
  const items: [LucideIcon, string, string, string][] = [
    [Layers, 'Multi-Agentes', 'Crie e coordene equipes de IA', '#9d62ff'],
    [Zap, 'Orquestração', 'Automatize fluxos complexos', '#39d6ff'],
    [BarChart3, 'Produtividade', 'Transforme ideias em resultados', '#00f5a0'],
  ]
  return (
    <div className="hidden grid-cols-3 divide-x divide-white/10 rounded-[10px] border border-neon-purple/50 bg-[#0b1230]/80 py-3 sm:grid">
      {items.map(([Icon, t, d, c]) => (
        <div key={t} className="flex items-center gap-3 px-4">
          <Icon size={30} style={{ color: c }} className="shrink-0" />
          <span><b className="block text-[13px]">{t}</b><span className="text-[11px] text-lab-muted">{d}</span></span>
        </div>
      ))}
    </div>
  )
}

export function AuthTitle({ children, subtitle }: { children: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-4 title-pixel text-[24px] sm:text-[34px]"><span className="h-10 w-1.5 shrink-0 bg-neon-green shadow-[0_0_10px_#00f5a0]" />{children}</h1>
      <p className="mt-3 text-[14px] text-lab-muted sm:text-[15px]">{subtitle}</p>
    </div>
  )
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
  required?: boolean
  password?: boolean
  hint?: ReactNode
}

/** Campo com ícone, rótulo, erro acessível e (opcional) mostrar/ocultar senha. */
export function AuthField({ label, icon: Icon, error, required, password, hint, className, ...rest }: AuthFieldProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div className={cx('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-[14px] font-bold">
        {label}{required && <span className="text-neon-pink">*</span>}
      </label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lab-muted" />
        <input id={id} className={cx('auth-input', password && 'pr-11')} type={password && !show ? 'password' : password ? 'text' : rest.type} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined} {...rest} />
        {password && (
          <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-lab-muted hover:text-white"
            onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-[12px] text-neon-pink">{error}</p>}
      {hint}
    </div>
  )
}

export function AuthAlert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = tone === 'error' ? 'border-neon-pink/60 bg-neon-pink/10 text-neon-pink' : tone === 'success' ? 'border-neon-green/60 bg-neon-green/10 text-neon-green' : 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('mb-4 rounded-[6px] border px-3 py-2 text-[13px]', c)} data-testid={`auth-alert-${tone}`}>{children}</div>
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['8+ caracteres', (p) => p.length >= 8],
  ['maiúscula', (p) => /[A-Z]/.test(p)],
  ['minúscula', (p) => /[a-z]/.test(p)],
  ['número', (p) => /\d/.test(p)],
  ['símbolo', (p) => /[^A-Za-z0-9]/.test(p)],
]

export const passwordOk = (p: string) => PASSWORD_RULES.every(([, f]) => f(p))

export function PasswordStrength({ value }: { value: string }) {
  const passed = PASSWORD_RULES.filter(([, f]) => f(value)).length
  const color = passed <= 2 ? '#ff537a' : passed < 5 ? '#ffb800' : '#00f5a0'
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">{PASSWORD_RULES.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i < passed ? color : '#26335e' }} />)}</div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
        {PASSWORD_RULES.map(([l, f]) => <span key={l} className={f(value) ? 'text-neon-green' : 'text-lab-muted'}>{f(value) ? '✓' : '·'} {l}</span>)}
      </p>
    </div>
  )
}
