import { defineConfig, devices } from '@playwright/test'

/** Fluxos críticos + screenshots para comparação visual com os protótipos (docs/SCREENS.md). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  outputDir: './e2e/.results',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 180_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
