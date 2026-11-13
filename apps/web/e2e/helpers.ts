import type { Page } from '@playwright/test'

/** Aponta o app para a API de teste (online) ou para uma porta sem servidor (offline). */
export async function useBackend(page: Page, online: boolean) {
  const baseUrl = online ? 'http://127.0.0.1:8010' : 'http://127.0.0.1:9'
  await page.addInitScript((url) => {
    localStorage.setItem('agentslab:backend:v1', JSON.stringify({ state: { baseUrl: url }, version: 0 }))
  }, baseUrl)
}
