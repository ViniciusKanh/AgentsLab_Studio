/**
 * Captura de mídia do AgentsLab_Studio (screenshots, vídeo e GIF) para o README.
 *
 * Uso:  npm run build && npm run preview -- --port 4173 &   (ou deixe o script subir o preview)
 *       node scripts/capture-media.mjs [--out ../../docs/media] [--base http://localhost:4173]
 *
 * Requer: Playwright (chromium), Python com as dependências de apps/api e ffmpeg (opcional).
 *
 * A API é iniciada em MODO DE TESTE (apps/api/tests/e2e_server.py): banco temporário e
 * respostas determinísticas, sem LLM real. As capturas mostram o fluxo e a interface reais,
 * mas o CONTEÚDO dos documentos é de teste — o README identifica isso.
 */
import { chromium } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def }
const OUT = resolve(arg('out', '../../docs/media'))
const BASE = arg('base', 'http://localhost:4173')
const VIEW = { width: 1440, height: 900 }
mkdirSync(OUT, { recursive: true })

async function serverUp() {
  try { const r = await fetch(BASE); return r.ok } catch { return false }
}

let preview = null
if (!(await serverUp())) {
  preview = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500))
}

const API = 'http://127.0.0.1:8010'
async function apiUp() {
  try { const r = await fetch(API + '/health'); return r.ok } catch { return false }
}
let api = null
if (!(await apiUp())) {
  const py = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
  api = spawn(py, ['tests/e2e_server.py'], { cwd: resolve('../api'), stdio: 'ignore', env: { ...process.env, E2E_LLM_DELAY: '1.2' } })
  for (let i = 0; i < 60 && !(await apiUp()); i++) await new Promise((r) => setTimeout(r, 500))
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const browser = await chromium.launch()
const shots = []

async function page(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, ...ctxOpts })
  await ctx.addInitScript((url) => localStorage.setItem('agentslab:backend:v1', JSON.stringify({ state: { baseUrl: url }, version: 0 })), API)
  const p = await ctx.newPage()
  return { ctx, p }
}

async function shot(path, name, waitMs = 2500, action) {
  const { ctx, p } = await page()
  await p.goto(BASE + path, { waitUntil: 'networkidle' })
  await p.waitForTimeout(waitMs)
  if (action) await action(p)
  const file = join(OUT, `${name}.png`)
  await p.screenshot({ path: file })
  shots.push(file)
  await ctx.close()
}

/** Cria um projeto pela API (o mesmo endpoint que a interface usa) e aprova o plano. */
async function startProject() {
  const post = (path, body) => fetch(API + '/api/v1' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
  const creds = await fetch(API + '/api/v1/credentials').then((r) => r.json())
  if (!creds.length) await post('/credentials', { provider: 'gemini', alias: 'Gemini · chave de teste', api_key: 'chave-de-teste-0000' })
  const p = await post('/projects', { organizationId: 'org-pesquisa-ia', title: 'IA na aeronáutica', request: 'Pesquise aplicações de inteligência artificial na aeronáutica e entregue um relatório técnico com fontes verificáveis.' })
  for (let i = 0; i < 60; i++) {
    const s = await fetch(API + '/api/v1/projects/' + p.id).then((r) => r.json())
    if (s.status === 'awaiting_approval') break
    await new Promise((r) => setTimeout(r, 300))
  }
  return p.id
}

async function record(path, name, seconds, action) {
  const dir = join(OUT, '.video-tmp')
  rmSync(dir, { recursive: true, force: true })
  const { ctx, p } = await page({ recordVideo: { dir, size: VIEW } })
  await p.goto(BASE + path, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  if (action) await action(p)
  await p.waitForTimeout(seconds * 1000)
  await ctx.close()
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'))
  const target = join(OUT, `${name}.webm`)
  renameSync(join(dir, webm), target)
  rmSync(dir, { recursive: true, force: true })
  if (hasFfmpeg) {
    // GIF leve (paleta otimizada) e MP4 para o README / redes
    spawnSync('ffmpeg', ['-y', '-ss', '1.5', '-t', String(Math.min(seconds, 10)), '-i', target, '-vf', 'fps=10,scale=800:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', join(OUT, `${name}.gif`)], { stdio: 'ignore' })
    spawnSync('ffmpeg', ['-y', '-i', target, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart', join(OUT, `${name}.mp4`)], { stdio: 'ignore' })
  }
  shots.push(target)
}

try {
  await shot('/escritorio', 'escritorio', 9000)
  await shot('/laboratorio', 'laboratorio', 9000)
  await shot('/escritorio', 'escritorio-zoom', 6000, async (p) => {
    await p.mouse.move(820, 480)
    for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(80) }
    await p.waitForTimeout(800)
  })
  await shot('/laboratorio', 'agente-selecionado', 6000, async (p) => {
    await p.getByRole('button', { name: 'Modo gerenciamento' }).click()
    await p.locator('[data-testid="management-panel"] li button').first().click()
    await p.waitForTimeout(1200)
  })
  const pid = await startProject()
  await shot(`/projetos/${pid}`, 'projeto-plano', 1500)
  await record('/laboratorio', 'demo-laboratorio', 16, async () => {
    await fetch(`${API}/api/v1/projects/${pid}/plan/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approve: true }) })
  })
  await shot(`/projetos/${pid}`, 'projeto-entrega', 8000, async (p) => {
    await p.getByRole('tab', { name: /Documentos/ }).click()
    await p.waitForTimeout(800)
  })
  await shot('/organizacoes', 'organizacoes', 1500)
  await shot('/agentes/novo', 'agent-studio', 1500)
  await shot('/provedores?tab=chaves', 'chaves-api', 1500)
  await shot('/provedores?tab=custos', 'custos', 1500)
  await record('/escritorio', 'demo-escritorio', 12)
  console.log(`Mídia gerada em ${OUT}:\n` + shots.map((s) => ' - ' + s).join('\n') + (hasFfmpeg ? '\n(+ GIF e MP4)' : '\n(ffmpeg ausente: sem GIF/MP4)'))
} finally {
  await browser.close()
  preview?.kill()
  api?.kill()
}
if (!existsSync(OUT)) process.exit(1)
