import { defineConfig, devices } from '@playwright/test'

/**
 * E2E: frontend (build de produção) + API real em modo de TESTE (tests/e2e_server.py:
 * banco temporário e LLM/ferramentas determinísticos — sem rede e sem chaves reais).
 * PYTHON: interpretador com as dependências de apps/api (padrão: python3 / python no Windows).
 */
const PY = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  outputDir: './e2e/.results',
  workers: 1,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: [
    { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 180_000 },
    { command: `${PY} tests/e2e_server.py`, cwd: '../api', url: 'http://127.0.0.1:8010/health', reuseExistingServer: true, timeout: 60_000 },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
