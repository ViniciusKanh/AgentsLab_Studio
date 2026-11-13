import Phaser from 'phaser'
import type { Agent } from '@/types/domain'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { STATE_META } from '@/simulation/states'
import { appConfig } from '@/services/config'
import { AmbientWorld, type Actor } from '../ambient/AmbientWorld'
import { personalityFor } from '../ambient/personality'
import { getWorldMap, WORLD_META, castIndex } from '../maps'
import { worldBus } from '../events/bus'
import type { AnimKey, EmoteKey, WorldMapData, WorldProp } from '../types'
import type { WorldOverlay, OverlayActor } from './WorldOverlay'

const ASSET = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`
const EMOTE_INDEX = (k: EmoteKey) => Math.max(0, WORLD_META.emotes.indexOf(k))

export interface WorldBridge {
  envId: string
  overlay: WorldOverlay
  onReady?: () => void
}

interface ActorView {
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  ring: Phaser.GameObjects.Ellipse
  badge: Phaser.GameObjects.Image
  badgeBg: Phaser.GameObjects.Rectangle
  bar: Phaser.GameObjects.Graphics
  charKey: string
  lastAnim: string
}

const ANIMS: Record<AnimKey, { frames: number[]; rate: number }> = {
  idle: { frames: [0, 0, 0, 1], rate: 3 },
  idleb: { frames: [17], rate: 1 },
  walkf: { frames: [2, 3, 4, 5], rate: 8 },
  walks: { frames: [6, 7, 8, 9], rate: 8 },
  walkb: { frames: [17, 18, 19, 20], rate: 8 },
  work: { frames: [10, 11], rate: 6 },
  sitb: { frames: [21, 22], rate: 5 },
  talk: { frames: [12, 13, 12, 0], rate: 4 },
  think: { frames: [14, 15], rate: 1.5 },
  cheer: { frames: [16, 0], rate: 3 },
  coffee: { frames: [23, 23, 24, 23], rate: 1.5 },
  read: { frames: [25, 26], rate: 1 },
}

/**
 * Cena genérica de ambiente: renderiza o mapa (tilemap de chão + atlas de props)
 * e espelha a AmbientWorld. Câmera com arraste, zoom e foco em personagem.
 */
export class WorldScene extends Phaser.Scene {
  private bridge!: WorldBridge
  private map!: WorldMapData
  private world!: AmbientWorld
  private views = new Map<string, ActorView>()
  private unsubs: (() => void)[] = []
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null
  private fitZoom = 1
  private userZoomed = false
  private lastClick = { id: '', t: 0 }
  private following: string | null = null

  constructor() {
    super('WorldScene')
  }

  preload() {
    this.bridge = this.registry.get('bridge') as WorldBridge
    this.map = getWorldMap(this.bridge.envId)
    const m = this.map
    this.load.image(m.ground, ASSET(`world/${m.ground}.png`))
    this.load.atlas(m.atlas, ASSET(`world/${m.atlas}.png`), ASSET(`world/${m.atlas}.json`))
    this.load.spritesheet('chars', ASSET('sprites/characters.png'), { frameWidth: WORLD_META.frameW, frameHeight: WORLD_META.frameH })
    this.load.spritesheet('state-icons', ASSET('sprites/state_icons.png'), { frameWidth: 8, frameHeight: 8 })
    this.load.spritesheet('emotes', ASSET('sprites/emotes.png'), { frameWidth: 8, frameHeight: 8 })
    this.load.spritesheet('globe', ASSET('sprites/globe.png'), { frameWidth: 32, frameHeight: 32 })
    this.load.spritesheet('cat', ASSET('sprites/cat.png'), { frameWidth: 16, frameHeight: 12 })
    this.load.spritesheet('brainholo', ASSET('world/brain_holo.png'), { frameWidth: 72, frameHeight: 56 })
    for (const c of ['cyan', 'pink', 'gold', 'purple', 'green', 'magenta', 'warm']) this.load.image(`light_${c}`, ASSET(`world/light_${c}.png`))
  }

  create() {
    const m = this.map
    const W = m.width * m.tile, H = m.height * m.tile
    this.add.image(0, 0, m.ground).setOrigin(0, 0).setDepth(-1000)
    this.createAnims()
    this.createProps()
    this.createAmbience()

    this.world = new AmbientWorld(m, {
      speech: (id, text, kind) => this.bridge.overlay.say(id, text, kind),
      feed: (text, kind, agentId) => useWorldStore.getState().pushFeed({ id: `${Date.now()}-${Math.random()}`, ts: new Date().toISOString(), text, kind, agentId }),
    })
    this.syncAgents(useLabStore.getState().agents, true)
    this.applyOperational()
    this.unsubs.push(
      useLabStore.subscribe((s, p) => { if (s.agents !== p.agents) this.syncAgents(s.agents, false) }),
      useSimulationStore.subscribe((s, p) => {
        if (s.runtime !== p.runtime) this.applyOperational()
        if (s.selectedAgentId !== p.selectedAgentId) this.applySelection()
      }),
      worldBus.on('camera:focus', ({ agentId }) => this.focus(agentId)),
      worldBus.on('camera:fit', () => this.fit()),
      worldBus.on('camera:zoom', ({ factor }) => this.zoomBy(factor)),
      worldBus.on('agent:message', (m) => this.showMessage(m)),
    )

    // câmera
    const cam = this.cameras.main
    cam.setBounds(0, 0, W, H)
    cam.setBackgroundColor('#080e1a')
    cam.roundPixels = true
    this.fit()
    this.scale.on('resize', this.onResize, this)

    // entrada: arrastar, zoom, seleção
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false } })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y
      if (!this.drag.moved && Math.hypot(dx, dy) > 5) { this.drag.moved = true; this.stopFollow() }
      if (this.drag.moved) { cam.scrollX = this.drag.sx - dx / cam.zoom; cam.scrollY = this.drag.sy - dy / cam.zoom }
    })
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const moved = this.drag?.moved
      this.drag = null
      if (moved) return
      const actorObj = over.find((o) => o.getData('actorId'))
      const propObj = over.find((o) => o.getData('propId'))
      if (actorObj) {
        const id = actorObj.getData('actorId') as string
        const now = this.time.now
        if (this.lastClick.id === id && now - this.lastClick.t < 350) this.focus(id)
        this.lastClick = { id, t: now }
        useSimulationStore.getState().select(id)
        useWorldStore.getState().selectProp(null)
      } else if (propObj) {
        const prop = propObj.getData('prop') as WorldProp
        useWorldStore.getState().selectProp({ prop, envId: m.id })
        useSimulationStore.getState().select(null)
      } else {
        useSimulationStore.getState().select(null)
        useWorldStore.getState().selectProp(null)
      }
    })
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 1 / 1.15 : 1.15, p))

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup())
    this.applySelection()
    this.bridge.onReady?.()
  }

  private cleanup() {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.scale.off('resize', this.onResize, this)
    this.views.forEach((v) => { v.sprite.destroy(); v.shadow.destroy(); v.ring.destroy(); v.badge.destroy(); v.badgeBg.destroy(); v.bar.destroy() })
    this.views.clear()
  }

  // ---------------------------------------------------------------- câmera
  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height)
    const prev = this.fitZoom
    this.computeFit()
    if (!this.userZoomed || this.cameras.main.zoom < this.fitZoom) this.fit()
    else this.cameras.main.setZoom(this.cameras.main.zoom * (this.fitZoom / prev))
  }

  private computeFit() {
    const cam = this.cameras.main
    const W = this.map.width * this.map.tile, H = this.map.height * this.map.tile
    this.fitZoom = Math.max(0.5, Math.min(cam.width / W, cam.height / H))
  }

  fit() {
    this.computeFit()
    this.userZoomed = false
    this.stopFollow()
    const cam = this.cameras.main
    cam.setZoom(this.fitZoom)
    this.updateBounds()
    cam.centerOn((this.map.width * this.map.tile) / 2, (this.map.height * this.map.tile) / 2)
  }

  private zoomBy(f: number, p?: Phaser.Input.Pointer) {
    const cam = this.cameras.main
    const before = p ? cam.getWorldPoint(p.x, p.y) : null
    const z = Phaser.Math.Clamp(cam.zoom * f, this.fitZoom, this.fitZoom * 4)
    cam.setZoom(z)
    this.userZoomed = z > this.fitZoom + 0.001
    if (p && before && !this.following) {
      const after = cam.getWorldPoint(p.x, p.y)
      cam.scrollX += before.x - after.x
      cam.scrollY += before.y - after.y
    }
  }

  private focus(agentId: string) {
    const v = this.views.get(agentId)
    if (!v) return
    const cam = this.cameras.main
    this.following = agentId
    cam.startFollow(v.sprite, true, 0.12, 0.12, 0, 12)
    if (cam.zoom < this.fitZoom * 2.2) { cam.zoomTo(this.fitZoom * 2.4, 400); this.userZoomed = true }
  }

  private stopFollow() {
    if (this.following) { this.cameras.main.stopFollow(); this.following = null }
  }

  // ---------------------------------------------------------------- cenário
  private createAnims() {
    const fpc = WORLD_META.framesPerChar
    WORLD_META.cast.forEach((cid, row) => {
      for (const [key, def] of Object.entries(ANIMS)) {
        const k = `${cid}-${key}`
        if (!this.anims.exists(k)) this.anims.create({ key: k, frames: def.frames.map((f) => ({ key: 'chars', frame: row * fpc + f })), frameRate: def.rate, repeat: -1 })
      }
    })
    const once = (key: string, cfg: Phaser.Types.Animations.Animation) => { if (!this.anims.exists(key)) this.anims.create(cfg) }
    once('globe-spin', { key: 'globe-spin', frames: this.anims.generateFrameNumbers('globe', { start: 0, end: 7 }), frameRate: 6, repeat: -1 })
    once('cat-sleep', { key: 'cat-sleep', frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 1 }), frameRate: 1, repeat: -1 })
    once('brain-pulse', { key: 'brain-pulse', frames: this.anims.generateFrameNumbers('brainholo', { start: 0, end: 1 }), frameRate: 2, repeat: -1 })
  }

  private createProps() {
    for (const p of this.map.props) {
      const img = this.add.image(p.x, p.y, this.map.atlas, p.frame).setOrigin(0, 0).setDepth(p.depth)
      if (p.interactive) {
        img.setInteractive(new Phaser.Geom.Rectangle(0, Math.max(0, p.h - p.tile.h * 16 - 16), p.w, Math.min(p.h, p.tile.h * 16 + 16)), Phaser.Geom.Rectangle.Contains)
        img.setData('propId', p.id).setData('prop', p)
        img.on('pointerover', () => { img.setTint(0xd9fbff); this.input.setDefaultCursor('pointer') })
        img.on('pointerout', () => { img.clearTint(); this.input.setDefaultCursor('grab') })
      }
    }
    this.input.setDefaultCursor('grab')
  }

  private createAmbience() {
    const colorKey: Record<string, string> = { '#39d6ff': 'cyan', '#ff537a': 'pink', '#ffb800': 'gold', '#9d62ff': 'purple', '#00f5a0': 'green', '#ff7ac1': 'magenta', '#ffd36b': 'warm' }
    for (const l of this.map.lights) {
      const img = this.add.image(l.x, l.y, `light_${colorKey[l.color] ?? 'cyan'}`).setDepth(5000).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.38).setScale(l.r / 32)
      if (l.flicker) this.tweens.add({ targets: img, alpha: { from: 0.25, to: 0.5 }, duration: 1400 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    for (const a of this.map.anims) {
      if (a.type === 'globe') this.add.sprite(a.x, a.y, 'globe').setOrigin(0, 0).setDepth(a.y + 60).play('globe-spin')
      if (a.type === 'cat') this.add.sprite(a.x, a.y, 'cat').setOrigin(0, 0).setDepth(a.y + 14).play('cat-sleep')
      if (a.type === 'brain') {
        const b = this.add.sprite(a.x, a.y, 'brainholo').setOrigin(0, 0).setDepth(a.y + 400).setBlendMode(Phaser.BlendModes.ADD).play('brain-pulse')
        this.tweens.add({ targets: b, y: a.y - 4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
      if (a.type === 'holo') {
        const g = this.add.sprite(a.x, a.y, 'globe').setOrigin(0, 0).setDepth(9000).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD).play('globe-spin')
        this.tweens.add({ targets: g, alpha: { from: 0.45, to: 0.85 }, duration: 900, yoyo: true, repeat: -1 })
      }
      if (a.type === 'bubbles') {
        for (let i = 0; i < 5; i++) {
          const r = this.add.rectangle(a.x + Math.random() * (a.w ?? 16), a.y + (a.h ?? 30), 1, 1, 0xd9fbff).setDepth(9000)
          this.tweens.add({ targets: r, y: a.y, duration: 1600 + Math.random() * 1500, repeat: -1, delay: i * 350 })
        }
      }
    }
    for (const led of this.map.leds) {
      const r = this.add.rectangle(led.x, led.y, 1, 1, Phaser.Display.Color.HexStringToColor(led.color).color).setOrigin(0, 0).setDepth(9000)
      this.tweens.add({ targets: r, alpha: { from: 1, to: 0.15 }, duration: 300 + Math.random() * 1400, yoyo: true, repeat: -1, delay: Math.random() * 900 })
    }
  }

  // ---------------------------------------------------------------- agentes
  private roomAgents(all: Agent[]) {
    return all.filter((a) => (a.environmentId === this.map.id || (this.map.id === 'office' && !['office', 'research'].includes(a.environmentId))) && a.status !== 'archived')
  }

  private syncAgents(all: Agent[], initial: boolean) {
    const list = this.roomAgents(all)
    this.world.setActors(list.map((a) => ({
      id: a.id, name: a.name, role: a.role, characterId: a.appearance.characterId,
      robot: ['ops', 'robo2'].includes(a.appearance.characterId), stationId: a.stationId,
      personality: a.personality ?? personalityFor(a.department, ['ops', 'robo2'].includes(a.appearance.characterId)),
    })))
    if (initial) this.world.list().forEach((a, i) => { if (i % 3 !== 2) this.world.snapToHome(a.id) })
    const ids = new Set(list.map((a) => a.id))
    for (const [id, v] of this.views) if (!ids.has(id)) { v.sprite.destroy(); v.shadow.destroy(); v.ring.destroy(); v.badge.destroy(); v.badgeBg.destroy(); v.bar.destroy(); this.views.delete(id) }
    for (const actor of this.world.list()) {
      const charKey = WORLD_META.cast[castIndex(actor.characterId)]
      const v = this.views.get(actor.id)
      if (v && v.charKey === charKey) continue
      if (v) { v.sprite.destroy(); v.shadow.destroy(); v.ring.destroy(); v.badge.destroy(); v.badgeBg.destroy(); v.bar.destroy() }
      const sprite = this.add.sprite(actor.x, actor.y, 'chars').setOrigin(0.5, 1)
      sprite.setInteractive(new Phaser.Geom.Rectangle(2, 0, 12, 24), Phaser.Geom.Rectangle.Contains).setData('actorId', actor.id)
      sprite.on('pointerover', () => this.input.setDefaultCursor('pointer'))
      sprite.on('pointerout', () => this.input.setDefaultCursor('grab'))
      this.views.set(actor.id, {
        sprite, charKey, lastAnim: '',
        shadow: this.add.ellipse(actor.x, actor.y, 11, 4, 0x000000, 0.35),
        ring: this.add.ellipse(actor.x, actor.y, 18, 7).setStrokeStyle(1, 0x39d6ff, 1).setVisible(false),
        badgeBg: this.add.rectangle(0, 0, 10, 10, 0x0b1228, 0.92).setStrokeStyle(1, 0xffffff).setVisible(false),
        badge: this.add.image(0, 0, 'state-icons', 0).setVisible(false),
        bar: this.add.graphics(),
      })
    }
    this.applySelection()
  }

  private applyOperational() {
    const rt = useSimulationStore.getState().runtime
    for (const a of this.world.list()) {
      const r = rt[a.id]
      if (!r) continue
      this.world.setOperational(a.id, { state: r.state, taskTitle: r.taskTitle, partnerId: r.partnerId, progress: r.progress, origin: appConfig.mode === 'real' ? 'real' : 'demo' })
    }
  }

  /** Balões e caminhadas a partir de mensagens reais (texto resumido; íntegra no projeto). */
  private showMessage(m: { fromAgentId: string | null; toAgentId: string | null; type: string; content: string }) {
    if (!m.fromAgentId) return
    const text = m.content.replace(/\s+/g, ' ').slice(0, 90) + (m.content.length > 90 ? '…' : '')
    if (m.type === 'entrega' && m.toAgentId) this.world.deliver(m.fromAgentId, m.toAgentId, text)
    else this.world.say(m.fromAgentId, text)
  }

  private applySelection() {
    const sel = useSimulationStore.getState().selectedAgentId
    for (const [id, v] of this.views) v.ring.setVisible(id === sel)
  }

  /** Mantém o mundo centralizado quando a área visível é maior que o mapa (letterbox simétrico). */
  private updateBounds() {
    const cam = this.cameras.main
    const W = this.map.width * this.map.tile, H = this.map.height * this.map.tile
    const ex = Math.max(0, (cam.width / cam.zoom - W) / 2)
    const ey = Math.max(0, (cam.height / cam.zoom - H) / 2)
    const b = cam.getBounds()
    if (Math.abs(b.x + ex) > 0.5 || Math.abs(b.y + ey) > 0.5 || Math.abs(b.width - (W + 2 * ex)) > 0.5) cam.setBounds(-ex, -ey, W + 2 * ex, H + 2 * ey)
  }

  update(_t: number, dt: number) {
    this.updateBounds()
    const speed = useWorldStore.getState().ambientSpeed
    if (speed > 0) this.world.tick(dt * speed)
    const cam = this.cameras.main
    const sel = useSimulationStore.getState().selectedAgentId
    const overlay: OverlayActor[] = []
    const view = cam.worldView
    for (const a of this.world.list()) {
      const v = this.views.get(a.id)
      if (!v) continue
      this.syncView(a, v)
      const sx = (a.x - view.x) * cam.zoom
      const sy = (a.y - view.y) * cam.zoom
      overlay.push({
        id: a.id, sx, sy, zoom: cam.zoom, name: a.name, role: a.role.split(/[ (]/)[0], selected: a.id === sel,
        color: STATE_META[a.op.state]?.color ?? '#9aa6bf', visible: sx > -40 && sy > -40 && sx < cam.width + 40 && sy < cam.height + 60,
      })
    }
    this.bridge.overlay.sync(overlay)
  }

  private syncView(a: Actor, v: ActorView) {
    const key = `${v.charKey}-${a.anim}`
    if (v.lastAnim !== key) { v.sprite.anims.play(key, true); v.lastAnim = key }
    v.sprite.setPosition(Math.round(a.x), Math.round(a.y))
    v.sprite.setFlipX(a.anim === 'walks' && a.facing === 'left')
    // sentados: um pouco à frente da cadeira de costas / atrás da mesa
    v.sprite.setDepth(a.y + (a.seated && a.facing === 'up' ? -1 : 0))
    v.sprite.setAlpha(a.op.state === 'paused' ? 0.7 : 1)
    if (a.op.state === 'failed') v.sprite.setTint(0xffa0b0); else v.sprite.clearTint()
    v.shadow.setPosition(a.x, a.y).setDepth(a.y - 2).setVisible(!a.seated)
    v.ring.setPosition(a.x, a.y).setDepth(a.y - 1)
    const by = a.y - 31 + (Math.floor(this.time.now / 400) % 2)
    // prioridade: emote ambiental; senão ícone do estado operacional
    if (a.emote) {
      v.badge.setTexture('emotes', EMOTE_INDEX(a.emote.key)).setVisible(true).setPosition(a.x, by).setDepth(9500)
      v.badgeBg.setVisible(true).setPosition(a.x, by).setDepth(9499).setStrokeStyle(1, 0xffffff)
    } else if (a.op.state !== 'idle') {
      const m = STATE_META[a.op.state]
      v.badge.setTexture('state-icons', m.icon).setVisible(true).setPosition(a.x, by).setDepth(9500)
      v.badgeBg.setVisible(true).setPosition(a.x, by).setDepth(9499).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(m.color).color)
    } else {
      v.badge.setVisible(false); v.badgeBg.setVisible(false)
    }
    v.bar.clear()
    if (a.op.state === 'working' && a.op.progress > 0 && !a.path.length) {
      v.bar.setDepth(9501)
      v.bar.fillStyle(0x070c1c, 1).fillRect(a.x - 8, by - 9, 16, 3)
      v.bar.fillStyle(0x00f5a0, 1).fillRect(a.x - 7, by - 8, Math.max(1, Math.round(14 * a.op.progress)), 1)
    }
  }
}
