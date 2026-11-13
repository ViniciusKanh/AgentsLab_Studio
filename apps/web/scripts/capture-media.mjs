/**
 * Captura de mídia do AgentsLab_Studio (screenshots, vídeo e GIF) para o README.
 *
 * Uso:  npm run media   (sobe preview, Supabase Auth falso e API de teste automaticamente)
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

const PY = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const SECRET = 'segredo-e2e-com-pelo-menos-32-caracteres!!'
const AUTH = 'http://127.0.0.1:8020'
const API = 'http://127.0.0.1:8010'
const up = async (url) => { try { return (await fetch(url)).ok } catch { return false } }
const wait = async (url) => { for (let i = 0; i < 80 && !(await up(url)); i++) await new Promise((r) => setTimeout(r, 500)) }
const procs = []

// build com o Supabase Auth FALSO dos testes (somente para as capturas)
if (!(await up(BASE))) {
  const env = { ...process.env, VITE_SUPABASE_URL: AUTH, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_midia', VITE_SITE_URL: BASE }
  spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', 'dist-e2e'], { stdio: 'inherit', env, shell: process.platform === 'win32' })
  procs.push(spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' }))
  await wait(BASE)
}
if (!(await up(AUTH + '/__mail'))) {
  procs.push(spawn(PY, ['tests/fake_supabase.py'], { cwd: resolve('../api'), stdio: 'ignore', env: { ...process.env, FAKE_SUPABASE_SECRET: SECRET } }))
  await wait(AUTH + '/__mail')
}
if (!(await up(API + '/health'))) {
  procs.push(spawn(PY, ['tests/e2e_server.py'], { cwd: resolve('../api'), stdio: 'ignore', env: { ...process.env, FAKE_SUPABASE_SECRET: SECRET, E2E_LLM_DELAY: '1.2' } }))
  await wait(API + '/health')
}

// usuário de demonstração confirmado + token para chamadas diretas à API
const EMAIL = `midia-${Date.now()}@agentslab.dev`, PASS = 'Senha#Midia123'
const jpost = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then((r) => r.json())
await jpost(`${AUTH}/auth/v1/signup`, { email: EMAIL, password: PASS, data: { full_name: 'Vinicius Santos' } })
const mails = await (await fetch(`${AUTH}/__mail?to=${EMAIL}`)).json()
await jpost(`${AUTH}/auth/v1/verify`, { token_hash: new URL(mails.at(-1).link).searchParams.get('token_hash'), type: 'signup' })
const { access_token: TOKEN } = await jpost(`${AUTH}/auth/v1/token?grant_type=password`, { email: EMAIL, password: PASS })
const AUTHZ = { Authorization: `Bearer ${TOKEN}` }

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const browser = await chromium.launch()
const shots = []
// sessão logada reutilizada em todas as capturas
let storageState
{
  const ctx = await browser.newContext({ viewport: VIEW })
  await ctx.addInitScript((url) => localStorage.setItem('agentslab:backend:v1', JSON.stringify({ state: { baseUrl: url }, version: 0 })), API)
  const p = await ctx.newPage()
  await p.goto(BASE + '/entrar')
  await p.getByTestId('login-email').fill(EMAIL)
  await p.getByTestId('login-password').fill(PASS)
  await p.getByTestId('login-submit').click()
  await p.getByTestId('topbar').waitFor()
  storageState = await ctx.storageState()
  await ctx.close()
}

async function page(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, storageState: ctxOpts.anon ? undefined : storageState, ...ctxOpts, anon: undefined })
  await ctx.addInitScript((url) => localStorage.setItem('agentslab:backend:v1', JSON.stringify({ state: { baseUrl: url }, version: 0 })), API)
  const p = await ctx.newPage()
  return { ctx, p }
}

async function shot(path, name, waitMs = 2500, action, opts = {}) {
  const { ctx, p } = await page(opts)
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
  const post = (path, body) => jpost(API + '/api/v1' + path, body, AUTHZ)
  const creds = await fetch(API + '/api/v1/credentials', { headers: AUTHZ }).then((r) => r.json())
  if (!creds.length) await post('/credentials', { provider: 'gemini', alias: 'Gemini · chave de teste', api_key: 'chave-de-teste-0000' })
  const orgs = await fetch(API + '/api/v1/organizations', { headers: AUTHZ }).then((r) => r.json())
  const p = await post('/projects', { organizationId: orgs.find((o) => o.name === 'Laboratório de Pesquisa em IA').id, title: 'IA na aeronáutica', request: 'Pesquise aplicações de inteligência artificial na aeronáutica e entregue um relatório técnico com fontes verificáveis.' })
  for (let i = 0; i < 60; i++) {
    const s = await fetch(API + '/api/v1/projects/' + p.id, { headers: AUTHZ }).then((r) => r.json())
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
  await shot('/entrar', 'login', 1200, null, { anon: true, viewport: { width: 1672, height: 941 } })
  await shot('/cadastro', 'cadastro', 1200, null, { anon: true, viewport: { width: 1672, height: 941 } })
  await shot('/entrar', 'login-celular', 1200, null, { anon: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
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
    await jpost(`${API}/api/v1/projects/${pid}/plan/decision`, { approve: true }, AUTHZ)
  })
  await shot(`/projetos/${pid}?area=revisao`, 'projeto-revisao', 8000)
  await shot(`/projetos/${pid}?area=execucao`, 'projeto-execucao', 1500)
  await shot(`/projetos/${pid}?area=documentos`, 'projeto-entrega', 1500)
  await shot(`/projetos/${pid}?area=custos`, 'projeto-custos', 1500)
  await shot('/organizacoes', 'organizacoes', 1500)
  await shot('/agentes/novo', 'agent-studio', 1500)
  await shot('/provedores?tab=chaves', 'chaves-api', 1500)
  await shot('/provedores?tab=custos', 'custos', 1500)
  await record('/escritorio', 'demo-escritorio', 12)
  console.log(`Mídia gerada em ${OUT}:\n` + shots.map((s) => ' - ' + s).join('\n') + (hasFfmpeg ? '\n(+ GIF e MP4)' : '\n(ffmpeg ausente: sem GIF/MP4)'))
} finally {
  await browser.close()
  procs.forEach((p) => p.kill())
}
if (!existsSync(OUT)) process.exit(1)
