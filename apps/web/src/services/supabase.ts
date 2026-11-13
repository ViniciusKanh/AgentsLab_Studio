import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'

/**
 * Cliente do Supabase Auth (somente chave PUBLICÁVEL no frontend — nunca service_role/secret).
 * - Fluxo PKCE; e-mails de confirmação/recuperação apontam para /auth/confirm (token_hash → verifyOtp),
 *   o que funciona mesmo se o link for aberto em outro navegador/dispositivo.
 * - "Lembrar de mim": sessão em localStorage (persiste); desmarcado: sessionStorage (encerra ao fechar a aba).
 *   O verificador PKCE fica sempre no localStorage para o link de e-mail funcionar em outra aba.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''

export const authEnabled = Boolean(url && key)
const REMEMBER = 'agentslab:remember'

export function setRemember(v: boolean) {
  try { localStorage.setItem(REMEMBER, v ? '1' : '0') } catch { /* storage indisponível */ }
}
export const getRemember = () => {
  try { return localStorage.getItem(REMEMBER) !== '0' } catch { return true }
}

const isVerifier = (k: string) => /code-verifier|pkce/i.test(k)

const rememberStorage: SupportedStorage = {
  getItem(k) {
    if (isVerifier(k)) return localStorage.getItem(k)
    return sessionStorage.getItem(k) ?? localStorage.getItem(k)
  },
  setItem(k, v) {
    if (isVerifier(k) || getRemember()) {
      localStorage.setItem(k, v)
      sessionStorage.removeItem(k)
    } else {
      sessionStorage.setItem(k, v)
      localStorage.removeItem(k)
    }
  },
  removeItem(k) {
    localStorage.removeItem(k)
    sessionStorage.removeItem(k)
  },
}

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: rememberStorage, storageKey: 'agentslab-auth' },
    })
  : null

/** URL base do site para os links de e-mail (localhost, Vercel ou Cloudflare Pages). */
export const siteUrl = () => (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin

/** Traduz erros do Supabase Auth para mensagens claras em português. */
export function authErrorMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!err) return ''
  const code = err.code ?? ''
  const msg = (err.message ?? '').toLowerCase()
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada (e o spam).'
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid or has expired')) return 'Este link é inválido ou expirou. Solicite um novo.'
  if (code === 'weak_password' || msg.includes('password should')) return 'Senha fraca: use ao menos 8 caracteres com letras maiúsculas, minúsculas, números e símbolo.'
  if (code === 'same_password') return 'A nova senha precisa ser diferente da anterior.'
  if (code === 'over_email_send_rate_limit' || err.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (code === 'user_already_exists') return 'Já existe uma conta com este e-mail.'
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão com o serviço de autenticação. Verifique sua internet.'
  return err.message || 'Não foi possível concluir a operação.'
}
