import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { authEnabled, authErrorMessage, setRemember, siteUrl, supabase } from '@/services/supabase'

/**
 * Sessão do usuário (Supabase Auth). Nenhuma senha ou token é gerado aqui:
 * o SDK cuida de PKCE, renovação do token e armazenamento da sessão.
 */
interface AuthState {
  enabled: boolean
  ready: boolean
  session: Session | null
  user: User | null
  /** true quando o usuário chegou por um link de recuperação (pode definir nova senha) */
  recovery: boolean
  init: () => Promise<void>
  signIn: (email: string, password: string, remember: boolean) => Promise<string | null>
  signUp: (fullName: string, email: string, password: string) => Promise<{ error: string | null; alreadyRegistered?: boolean }>
  resendConfirmation: (email: string) => Promise<string | null>
  sendPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  confirmFromEmail: (tokenHash: string, type: 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change') => Promise<string | null>
  updateProfile: (fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
}

let initialized = false

export const useAuthStore = create<AuthState>((set, get) => ({
  enabled: authEnabled,
  ready: !authEnabled,
  session: null,
  user: null,
  recovery: false,
  async init() {
    if (!supabase || initialized) return
    initialized = true
    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null, ready: true, recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : get().recovery })
    })
    const { data } = await supabase.auth.getSession()
    set({ session: data.session, user: data.session?.user ?? null, ready: true })
  },
  async signIn(email, password, remember) {
    if (!supabase) return 'Autenticação não configurada.'
    setRemember(remember)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    return error ? authErrorMessage(error) : null
  },
  async signUp(fullName, email, password) {
    if (!supabase) return { error: 'Autenticação não configurada.' }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${siteUrl()}/auth/confirm` },
    })
    if (error) return { error: authErrorMessage(error) }
    // e-mail já confirmado: o Supabase devolve usuário sem identidades (não revela a existência da conta)
    const alreadyRegistered = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    // segurança: nunca entrar automaticamente antes da confirmação do e-mail
    if (data.session) await supabase.auth.signOut({ scope: 'local' })
    return { error: null, alreadyRegistered }
  },
  async resendConfirmation(email) {
    if (!supabase) return 'Autenticação não configurada.'
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${siteUrl()}/auth/confirm` } })
    return error ? authErrorMessage(error) : null
  },
  async sendPasswordReset(email) {
    if (!supabase) return 'Autenticação não configurada.'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${siteUrl()}/auth/confirm?next=/redefinir-senha` })
    return error ? authErrorMessage(error) : null
  },
  async updatePassword(password) {
    if (!supabase) return 'Autenticação não configurada.'
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) set({ recovery: false })
    return error ? authErrorMessage(error) : null
  },
  async confirmFromEmail(tokenHash, type) {
    if (!supabase) return 'Autenticação não configurada.'
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error && type === 'recovery') set({ recovery: true })
    return error ? authErrorMessage(error) : null
  },
  async updateProfile(fullName) {
    if (!supabase) return 'Autenticação não configurada.'
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
    return error ? authErrorMessage(error) : null
  },
  async signOut() {
    if (supabase) await supabase.auth.signOut()
    set({ session: null, user: null, recovery: false })
  },
}))

/** Access token atual (renovado automaticamente pelo SDK) para chamar o backend. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export const displayName = (u: User | null) => (u?.user_metadata?.full_name as string | undefined) || u?.email?.split('@')[0] || 'Usuário'
