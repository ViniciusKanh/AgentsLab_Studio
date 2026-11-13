import { defineConfig, devices } from '@playwright/test'

/**
 * E2E: frontend (build de produção em dist-e2e) + API real em MODO DE TESTE + Supabase Auth FALSO:
 *  - apps/api/tests/fake_supabase.py  (porta 8020): cadastro, e-mails, login, recuperação — sem rede
 *  - apps/api/tests/e2e_server.py      (porta 8010): banco temporário, LLM/ferramentas determinísticos,
 *    validando os JWT do Supabase falso
 * PYTHON: interpretador com as dependências de apps/api (padrão: python3 / python no Windows).
 */
const PY = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const SECRET = 'segredo-e2e-com-pelo-menos-32-caracteres!!'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  outputDir: './e2e/.results',
  workers: 1,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      command: 'npx tsc -b && npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
      port: 4173, reuseExistingServer: true, timeout: 180_000,
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:8020', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste_e2e', VITE_SITE_URL: 'http://localhost:4173' },
    },
    { command: `${PY} tests/fake_supabase.py`, cwd: '../api', url: 'http://127.0.0.1:8020/__mail', reuseExistingServer: true, timeout: 60_000, env: { FAKE_SUPABASE_SECRET: SECRET } },
    { command: `${PY} tests/e2e_server.py`, cwd: '../api', url: 'http://127.0.0.1:8010/health', reuseExistingServer: true, timeout: 60_000, env: { FAKE_SUPABASE_SECRET: SECRET } },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
