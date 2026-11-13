import { accessToken, useAuthStore } from '@/stores/authStore'
import { apiBase } from './backend'

/**
 * Chamada ao backend com o access token do Supabase (Authorization: Bearer).
 * O backend valida o JWT e só devolve dados do próprio usuário.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((init.headers as Record<string, string>) ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers })
  if (res.status === 401 && useAuthStore.getState().enabled && useAuthStore.getState().session) {
    // token rejeitado (expirado/revogado): encerra a sessão local e volta ao login
    await useAuthStore.getState().signOut()
  }
  return res
}
