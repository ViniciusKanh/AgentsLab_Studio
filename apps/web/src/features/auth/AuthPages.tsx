import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, Lock, LogIn, Mail, MailCheck, User, UserPlus } from 'lucide-react'
import { LogoEmblem } from '@/components/brand/Logo'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { getRemember } from '@/services/supabase'
import { AuthAlert, AuthField, AuthLayout, AuthTitle, EMAIL_RE, PasswordStrength, passwordOk } from './AuthLayout'

function NotConfigured() {
  return (
    <AuthAlert tone="info">
      Contas de usuário não estão configuradas nesta instalação (modo local de usuário único). Defina <code>VITE_SUPABASE_URL</code> e{' '}
      <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> — veja <b>docs/SUPABASE.md</b>. <Link to="/" className="auth-link">Abrir o app</Link>
    </AuthAlert>
  )
}

// ---------------------------------------------------------------------------- Login
export function LoginPage() {
  const { enabled, signIn, resendConfirmation } = useAuthStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(getRemember())
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState('')
  const [info, setInfo] = useState(params.get('motivo') === 'senha' ? 'Senha alterada. Entre com a nova senha.' : '')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) v.email = 'Informe um e-mail válido.'
    if (!password) v.password = 'Informe sua senha.'
    setErrors(v)
    setError('')
    setUnconfirmed(false)
    if (Object.keys(v).length) return
    setBusy(true)
    const err = await signIn(email, password, remember)
    setBusy(false)
    if (err) {
      setError(err)
      setUnconfirmed(err.startsWith('Confirme seu e-mail'))
      return
    }
    nav(from, { replace: true })
  }

  const resend = async () => {
    const err = await resendConfirmation(email)
    setError(err ?? '')
    setInfo(err ? '' : `Enviamos um novo link de confirmação para ${email.trim()}.`)
    setUnconfirmed(false)
  }

  return (
    <AuthLayout variant="login">
      <AuthTitle subtitle="Acesse o AgentsLab_Studio e orquestre seus agentes de IA.">Entrar</AuthTitle>
      {!enabled && <NotConfigured />}
      {info && <AuthAlert tone="success">{info}</AuthAlert>}
      {error && (
        <AuthAlert>
          {error}
          {unconfirmed && <button type="button" className="auth-link ml-1" onClick={() => void resend()}>Reenviar e-mail de confirmação</button>}
        </AuthAlert>
      )}
      <form onSubmit={submit} noValidate>
        <AuthField label="E-mail" icon={Mail} type="email" autoComplete="email" placeholder="Seu e-mail profissional" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} data-testid="login-email" />
        <AuthField label="Senha" icon={Lock} password autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} data-testid="login-password" />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-[14px]">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[#00f5a0]" checked={remember} onChange={(e) => setRemember(e.target.checked)} data-testid="login-remember" />
            Lembrar de mim
          </label>
          <Link to={`/recuperar-senha${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="auth-link">Esqueci minha senha</Link>
        </div>
        <button className="auth-btn" disabled={busy || !enabled} data-testid="login-submit"><LogIn size={22} /> {busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="mt-2 text-[11.5px] text-lab-muted">{remember ? 'A sessão continuará ativa neste dispositivo.' : 'A sessão será encerrada ao fechar o navegador.'}</p>
      <div className="my-6 h-px bg-white/10" />
      <p className="text-center text-[15px]">Ainda não tem conta? <Link to="/cadastro" className="auth-link" data-testid="go-register">Criar conta</Link></p>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Cadastro
export function RegisterPage() {
  const { enabled, signUp } = useAuthStore()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', email2: '', password: '', terms: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (f.name.trim().split(/\s+/).length < 2 || f.name.trim().length < 5) v.name = 'Informe nome e sobrenome.'
    if (!EMAIL_RE.test(f.email.trim())) v.email = 'Informe um e-mail válido.'
    if (f.email2.trim().toLowerCase() !== f.email.trim().toLowerCase()) v.email2 = 'Os e-mails não conferem.'
    if (!passwordOk(f.password)) v.password = 'A senha não atende aos requisitos abaixo.'
    if (!f.terms) v.terms = 'É preciso aceitar os Termos de Uso e a Política de Privacidade.'
    setErrors(v)
    setError('')
    if (Object.keys(v).length) return
    setBusy(true)
    const r = await signUp(f.name, f.email, f.password)
    setBusy(false)
    if (r.error) return setError(r.error)
    nav(`/verificar-email?email=${encodeURIComponent(f.email.trim().toLowerCase())}${r.alreadyRegistered ? '&existente=1' : ''}`)
  }

  return (
    <AuthLayout variant="register">
      <div className="mb-6 flex flex-col items-center">
        <div className="flex w-full items-center gap-3">
          <span className="hidden h-px flex-1 bg-neon-green/40 sm:block" />
          <LogoEmblem size={40} />
          <span className="leading-tight">
            <span className="block text-[20px] font-extrabold sm:text-[24px]">AgentsLab<span className="text-neon-purple">_Studio</span></span>
            <span className="block text-[9.5px] font-bold tracking-[0.12em] text-lab-muted">PLATAFORMA PROFISSIONAL DE AGENTES DE IA</span>
          </span>
          <span className="hidden h-px flex-1 bg-neon-green/40 sm:block" />
        </div>
      </div>
      <div className="mb-6 flex items-center gap-4">
        <div className="hidden h-20 w-20 shrink-0 place-items-center rounded-[12px] border-2 border-neon-purple/70 bg-[#120f33] shadow-[0_0_16px_-4px_#9d62ff] sm:grid"><LogoEmblem size={52} /></div>
        <div>
          <h1 className="title-pixel text-[22px] sm:text-[30px]">Criar <span className="text-neon-green">conta</span></h1>
          <p className="mt-1 text-[13.5px] text-lab-muted">Crie sua conta e comece a orquestrar, avaliar e escalar equipes de agentes de IA no <b className="text-neon-green">AgentsLab_Studio</b>.</p>
        </div>
      </div>
      {!enabled && <NotConfigured />}
      {error && <AuthAlert>{error}</AuthAlert>}
      <form onSubmit={submit} noValidate>
        <AuthField label="Nome" required icon={User} autoComplete="name" placeholder="Seu nome completo" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} data-testid="reg-name" />
        <AuthField label="E-mail" required icon={Mail} type="email" autoComplete="email" placeholder="Seu e-mail profissional" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} data-testid="reg-email" />
        <AuthField label="Confirmar e-mail" required icon={MailCheck} type="email" autoComplete="off" placeholder="Confirme seu e-mail" value={f.email2} onChange={(e) => set('email2', e.target.value)} onPaste={(e) => e.preventDefault()} error={errors.email2} data-testid="reg-email2" />
        <AuthField label="Senha" required icon={Lock} password autoComplete="new-password" placeholder="Crie uma senha segura" value={f.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint={<PasswordStrength value={f.password} />} data-testid="reg-password" />
        <label className="mb-1 flex cursor-pointer items-start gap-3 text-[13.5px]">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#00f5a0]" checked={f.terms} onChange={(e) => set('terms', e.target.checked)} aria-invalid={errors.terms ? true : undefined} data-testid="reg-terms" />
          <span>Li e concordo com os <Link to="/termos" target="_blank" className="auth-link">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" className="auth-link">Política de Privacidade</Link> do AgentsLab_Studio. <span className="text-neon-pink">*</span></span>
        </label>
        {errors.terms && <p role="alert" className="mb-2 text-[12px] text-neon-pink">{errors.terms}</p>}
        <button className="auth-btn mt-4" disabled={busy || !enabled} data-testid="reg-submit"><UserPlus size={22} /> {busy ? 'Criando conta…' : 'Criar conta'}</button>
      </form>
      <div className="my-6 h-px bg-white/10" />
      <p className="text-center text-[15px]">Já tem conta? <Link to="/entrar" className="auth-link">Entrar</Link></p>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Verifique seu e-mail
export function CheckEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const { resendConfirmation } = useAuthStore()
  const [cool, setCool] = useState(0)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  useEffect(() => {
    if (!cool) return
    const t = setTimeout(() => setCool(cool - 1), 1000)
    return () => clearTimeout(t)
  }, [cool])
  return (
    <AuthLayout variant="register">
      <AuthTitle subtitle={<>Enviamos um link de confirmação para <b className="text-lab-text">{email || 'o seu e-mail'}</b>. Abra-o para ativar a conta — só depois disso o acesso é liberado.</>}>Verifique seu e-mail</AuthTitle>
      {params.get('existente') && <AuthAlert tone="info">Se este e-mail já tiver uma conta confirmada, use “Entrar” ou “Esqueci minha senha”.</AuthAlert>}
      {msg && <AuthAlert tone={msg.tone}>{msg.text}</AuthAlert>}
      <ul className="mb-6 list-disc space-y-1 pl-5 text-[13.5px] text-lab-muted">
        <li>O link vale por tempo limitado e só pode ser usado uma vez.</li>
        <li>Não chegou? Confira a pasta de spam ou reenvie abaixo.</li>
      </ul>
      <button className="auth-btn" disabled={!email || cool > 0} onClick={async () => {
        const err = await resendConfirmation(email)
        setMsg(err ? { tone: 'error', text: err } : { tone: 'success', text: 'Novo link enviado.' })
        setCool(60)
      }} data-testid="resend-confirmation"><MailCheck size={20} /> {cool ? `Reenviar em ${cool}s` : 'Reenviar e-mail'}</button>
      <p className="mt-6 text-center text-[15px]"><Link to={`/entrar?email=${encodeURIComponent(email)}`} className="auth-link"><ArrowLeft size={14} className="mr-1 inline" />Voltar para Entrar</Link></p>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Esqueci minha senha
export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const { enabled, sendPasswordReset } = useAuthStore()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setError('Informe um e-mail válido.')
    setBusy(true)
    const err = await sendPasswordReset(email)
    setBusy(false)
    setError(err ?? '')
    setSent(!err)
  }
  return (
    <AuthLayout variant="login">
      <AuthTitle subtitle="Informe o e-mail da sua conta. Enviaremos um link para definir uma nova senha.">Recuperar senha</AuthTitle>
      {!enabled && <NotConfigured />}
      {sent && <AuthAlert tone="success">Se houver uma conta com este e-mail, você receberá o link em instantes. Ele expira em pouco tempo.</AuthAlert>}
      {error && <AuthAlert>{error}</AuthAlert>}
      <form onSubmit={submit} noValidate>
        <AuthField label="E-mail" icon={Mail} type="email" autoComplete="email" placeholder="Seu e-mail profissional" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
        <button className="auth-btn" disabled={busy || !enabled} data-testid="forgot-submit"><KeyRound size={20} /> {busy ? 'Enviando…' : 'Enviar link de recuperação'}</button>
      </form>
      <p className="mt-6 text-center text-[15px]"><Link to="/entrar" className="auth-link"><ArrowLeft size={14} className="mr-1 inline" />Voltar para Entrar</Link></p>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Redefinir senha
export function ResetPasswordPage() {
  const { session, recovery, ready, updatePassword, signOut } = useAuthStore()
  const nav = useNavigate()
  const toast = useUiStore((s) => s.toast)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (ready && !session) {
    return (
      <AuthLayout variant="login">
        <AuthTitle subtitle="Para definir uma nova senha, abra o link enviado ao seu e-mail.">Link necessário</AuthTitle>
        <AuthAlert>O link de recuperação é inválido, expirou ou já foi usado.</AuthAlert>
        <Link to="/recuperar-senha" className="auth-btn">Solicitar novo link</Link>
      </AuthLayout>
    )
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (!passwordOk(pw)) v.pw = 'A senha não atende aos requisitos.'
    if (pw2 !== pw) v.pw2 = 'As senhas não conferem.'
    setErrors(v)
    if (Object.keys(v).length) return
    setBusy(true)
    const err = await updatePassword(pw)
    setBusy(false)
    if (err) return setError(err)
    toast('Senha alterada com sucesso', 'success')
    // encerra as sessões e pede login com a nova senha
    await signOut()
    nav('/entrar?motivo=senha', { replace: true })
  }
  return (
    <AuthLayout variant="login">
      <AuthTitle subtitle={recovery ? 'Escolha uma nova senha para a sua conta.' : 'Altere a senha da sua conta.'}>Nova senha</AuthTitle>
      {error && <AuthAlert>{error}</AuthAlert>}
      <form onSubmit={submit} noValidate>
        <AuthField label="Nova senha" required icon={Lock} password autoComplete="new-password" placeholder="Crie uma senha segura" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} hint={<PasswordStrength value={pw} />} data-testid="reset-password" />
        <AuthField label="Confirmar nova senha" required icon={Lock} password autoComplete="new-password" placeholder="Repita a nova senha" value={pw2} onChange={(e) => setPw2(e.target.value)} error={errors.pw2} data-testid="reset-password2" />
        <button className="auth-btn" disabled={busy} data-testid="reset-submit"><KeyRound size={20} /> {busy ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Retorno dos links de e-mail
type OtpType = 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change'

export function AuthConfirmPage() {
  const [params] = useSearchParams()
  const { confirmFromEmail, session, ready } = useAuthStore()
  const toast = useUiStore((s) => s.toast)
  const nav = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const urlError = params.get('error_description') || hash.get('error_description')
  const tokenHash = params.get('token_hash')
  const type = (params.get('type') ?? 'email') as OtpType
  const next = params.get('next') || (type === 'recovery' ? '/redefinir-senha' : '/')

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (urlError) return setError(/expired|invalid/i.test(urlError) ? 'Este link é inválido ou expirou. Solicite um novo.' : urlError)
    if (!tokenHash) return
    void confirmFromEmail(tokenHash, type).then((err) => {
      if (err) return setError(err)
      toast(type === 'recovery' ? 'Link validado: defina sua nova senha' : 'E-mail confirmado! Bem-vindo(a).', 'success')
      nav(next, { replace: true })
    })
  }, [confirmFromEmail, nav, next, tokenHash, toast, type, urlError])

  // links no formato padrão do Supabase (?code=...) são trocados automaticamente pelo SDK (PKCE)
  useEffect(() => {
    if (!tokenHash && !urlError && ready && session) nav(next, { replace: true })
  }, [tokenHash, urlError, ready, session, nav, next])

  if (!error && (tokenHash || params.get('code'))) {
    return <AuthLayout variant="login"><AuthTitle subtitle="Validando o link…">Confirmando</AuthTitle></AuthLayout>
  }
  return (
    <AuthLayout variant="login">
      <AuthTitle subtitle="Não foi possível validar o link.">Link inválido</AuthTitle>
      <AuthAlert>{error || 'O link está incompleto. Abra novamente o link do e-mail.'}</AuthAlert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/recuperar-senha" className="auth-btn text-[15px]">Novo link de senha</Link>
        <Link to="/entrar" className="auth-btn text-[15px]" style={{ background: '#39d6ff' }}>Ir para Entrar</Link>
      </div>
      <p className="mt-4 text-[12.5px] text-lab-muted">Se o problema for na confirmação do cadastro, tente entrar: a tela permite reenviar o e-mail de confirmação.</p>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------- Termos e privacidade
export function LegalPage({ kind }: { kind: 'termos' | 'privacidade' }) {
  return (
    <div className="auth-page min-h-full overflow-y-auto p-4 sm:p-8">
      <article className="mx-auto max-w-3xl space-y-3 rounded-[10px] border border-lab-line/60 bg-[#0b1230]/90 p-5 text-[14px] leading-relaxed sm:p-8">
        <Link to="/cadastro" className="auth-link text-[13px]"><ArrowLeft size={14} className="mr-1 inline" />Voltar</Link>
        {kind === 'termos' ? (
          <>
            <h1 className="title-pixel text-[18px]">Termos de Uso</h1>
            <p className="text-lab-muted">Modelo inicial — revise com assessoria jurídica antes da publicação.</p>
            <p>O AgentsLab_Studio permite configurar agentes de IA que executam tarefas usando provedores de modelos escolhidos por você. Você é responsável pelas chaves de API cadastradas, pelos custos gerados nos provedores e pelo uso dos resultados.</p>
            <p>Resultados produzidos por modelos de IA podem conter erros; revise as entregas antes de utilizá-las. Operações sensíveis exigem integração configurada e aprovação humana.</p>
            <p>É proibido usar a plataforma para atividades ilegais ou que violem as políticas dos provedores de IA.</p>
          </>
        ) : (
          <>
            <h1 className="title-pixel text-[18px]">Política de Privacidade</h1>
            <p className="text-lab-muted">Modelo inicial — adequar à LGPD com assessoria jurídica antes da publicação.</p>
            <p>Coletamos nome e e-mail para autenticação (Supabase Auth). Senhas são gerenciadas pelo Supabase e nunca armazenadas pelo AgentsLab_Studio.</p>
            <p>Chaves de API são criptografadas e usadas apenas para executar as tarefas que você solicitar; nunca são exibidas novamente nem compartilhadas com outros usuários.</p>
            <p>Projetos, documentos e registros de uso ficam associados à sua conta e isolados dos demais usuários. Você pode solicitar a exclusão da conta e dos dados.</p>
          </>
        )}
      </article>
    </div>
  )
}

// ---------------------------------------------------------------------------- Guardas de rota
export function RequireAuth({ children }: { children: ReactElement }) {
  const { enabled, ready, session, user, signOut } = useAuthStore()
  const loc = useLocation()
  if (!enabled) return children
  if (!ready) return <p className="title-pixel animate-blink p-6 text-[10px] text-lab-muted">Verificando sessão…</p>
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname + loc.search }} />
  if (user && !user.email_confirmed_at) {
    void signOut()
    return <Navigate to={`/verificar-email?email=${encodeURIComponent(user.email ?? '')}`} replace />
  }
  return children
}

export function PublicOnly({ children }: { children: ReactElement }) {
  const { enabled, ready, session, recovery } = useAuthStore()
  if (enabled && ready && session && !recovery) return <Navigate to="/" replace />
  return children
}
