/**
 * Captura de mídia do AgentsLab_Studio (screenshots, vídeo e GIF) para o README.
 *
 * Uso:  npm run build && npm run preview -- --port 4173 &   (ou deixe o script subir o preview)
 *       node scripts/capture-media.mjs [--out ../../docs/media] [--base http://localhost:4173]
 *
 * Requer: Playwright (chromium) e ffmpeg no PATH (opcional — sem ffmpeg gera só PNG/WebM).
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

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const browser = await chromium.launch()
const shots = []

async function page(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, ...ctxOpts })
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
  await shot('/agentes/novo', 'agent-studio', 1500)
  await shot('/workflows', 'workflow-studio', 2000)
  await shot('/modelos?tab=chaves', 'chaves-api', 1500)
  await shot('/painel', 'painel-metricas', 2500)
  await record('/escritorio', 'demo-escritorio', 14)
  await record('/laboratorio', 'demo-laboratorio', 14)
  console.log(`Mídia gerada em ${OUT}:\n` + shots.map((s) => ' - ' + s).join('\n') + (hasFfmpeg ? '\n(+ GIF e MP4)' : '\n(ffmpeg ausente: sem GIF/MP4)'))
} finally {
  await browser.close()
  preview?.kill()
}
if (!existsSync(OUT)) process.exit(1)
