import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const AUTH = 'http://127.0.0.1:8020'
export const PASSWORD = 'Senha#Forte123'

/** Aponta o app para a API de teste (online) ou para uma porta sem servidor (offline). */
export async function useBackend(page: Page, online: boolean) {
  const baseUrl = online ? 'http://127.0.0.1:8010' : 'http://127.0.0.1:9'
  await page.addInitScript((url) => {
    localStorage.setItem('agentslab:backend:v1', JSON.stringify({ state: { baseUrl: url }, version: 0 }))
  }, baseUrl)
}

/** Último link enviado por e-mail (caixa de saída do Supabase falso). */
export async function lastMail(request: APIRequestContext, email: string, type?: string) {
  const list = (await (await request.get(`${AUTH}/__mail?to=${encodeURIComponent(email)}`)).json()) as { type: string; link: string }[]
  const m = list.filter((x) => !type || x.type === type).at(-1)
  expect(m, `e-mail ${type ?? ''} para ${email}`).toBeTruthy()
  return m!.link
}

const created = new Set<string>()

/** Garante um usuário confirmado (cadastro + link de verificação) via API do Supabase falso. */
export async function ensureUser(request: APIRequestContext, email: string, password = PASSWORD) {
  if (created.has(email)) return
  await request.post(`${AUTH}/auth/v1/signup`, { data: { email, password, data: { full_name: 'Gestor de Teste' } } })
  const link = await lastMail(request, email, 'signup')
  const th = new URL(link).searchParams.get('token_hash')
  await request.post(`${AUTH}/auth/v1/verify`, { data: { token_hash: th, type: 'signup' } })
  created.add(email)
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/entrar')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('topbar')).toBeVisible()
}
