import type { AgentRuntimeState } from '@/types/domain'
import type { AmbientActivity, AnimKey, EmoteKey, Facing, InteractionPoint, Personality, PointType, Tile, WorldMapData } from '../types'
import { isWalkable, pointPx, pxToTile, tileToPx, walkableTiles, zoneAt } from '../maps'
import { findPath } from '../nav/astar'
import { LINES, DEMO_PRO_LINES, pick } from './dialogues'
import { DEFAULT_PERSONALITY } from './personality'

/**
 * CAMADA 1 — SIMULAÇÃO AMBIENTAL.
 *
 * Movimento, navegação (A*), uso de objetos, conversas sociais e animações.
 * Roda localmente, sem LLM e sem Phaser (testável em Node). A camada operacional
 * (tarefas reais/demo) entra apenas por `setOperational`, e TEM PRIORIDADE:
 * um agente em execução larga a atividade ambiental e vai para sua estação.
 */

export interface ActorInput {
  id: string
  name: string
  role: string
  characterId: string
  robot: boolean
  stationId: string | null
  personality?: Personality
}

export interface OperationalInput {
  state: AgentRuntimeState
  taskTitle: string | null
  partnerId: string | null
  progress: number
  origin: 'demo' | 'real'
}

export interface Actor {
  id: string
  name: string
  role: string
  characterId: string
  robot: boolean
  personality: Personality
  homePointId: string | null
  x: number
  y: number
  facing: Facing
  path: Tile[]
  activity: AmbientActivity
  anim: AnimKey
  seated: boolean
  pointId: string | null
  /** destino pendente: o que fazer ao chegar */
  intent: { activity: AmbientActivity; pointId: string | null; duration: number; facing?: Facing } | null
  until: number
  lastActivity: AmbientActivity | null
  partnerId: string | null
  chatTurns: number
  emote: { key: EmoteKey; until: number } | null
  op: OperationalInput
  nextDecision: number
}

export interface AmbientEvents {
  speech: (actorId: string, text: string, kind: 'ambiente' | 'operacional-demo' | 'operacional-real') => void
  feed: (text: string, kind: 'ambiente' | 'operacional-demo' | 'operacional-real', actorId?: string) => void
}

const SPEED = 34 // px/s
const BUSY_STATES: AgentRuntimeState[] = ['planning', 'working', 'reviewing']

export class AmbientWorld {
  readonly map: WorldMapData
  private actors = new Map<string, Actor>()
  private reserved = new Map<string, string>() // pointId -> actorId
  private time = 0
  private rnd: () => number
  private walkCache: Tile[]
  private events: Partial<AmbientEvents>

  constructor(map: WorldMapData, events: Partial<AmbientEvents> = {}, rnd: () => number = Math.random) {
    this.map = map
    this.events = events
    this.rnd = rnd
    this.walkCache = walkableTiles(map)
  }

  get now() { return this.time }
  list(): Actor[] { return [...this.actors.values()] }
  get(id: string) { return this.actors.get(id) }
  pointById(id: string | null) { return id ? this.map.points.find((p) => p.id === id) ?? null : null }

  // -------------------------------------------------------------------------
  // Sincronização com os agentes cadastrados
  // -------------------------------------------------------------------------
  setActors(inputs: ActorInput[]) {
    const ids = new Set(inputs.map((i) => i.id))
    for (const id of [...this.actors.keys()]) if (!ids.has(id)) this.remove(id)
    const workPoints = this.map.points.filter((p) => p.type === 'work')
    const takenHomes = new Set([...this.actors.values()].map((a) => a.homePointId).filter(Boolean))
    for (const inp of inputs) {
      const existing = this.actors.get(inp.id)
      if (existing) {
        Object.assign(existing, { name: inp.name, role: inp.role, characterId: inp.characterId, robot: inp.robot, personality: inp.personality ?? existing.personality })
        continue
      }
      let home = workPoints.find((p) => p.id === inp.stationId && !takenHomes.has(p.id)) ?? null
      if (!home) home = workPoints.find((p) => !takenHomes.has(p.id)) ?? null
      if (home) takenHomes.add(home.id)
      const spawn = this.randomTile()
      const pos = tileToPx(this.map, spawn)
      this.actors.set(inp.id, {
        id: inp.id, name: inp.name, role: inp.role, characterId: inp.characterId, robot: inp.robot,
        personality: inp.personality ?? DEFAULT_PERSONALITY, homePointId: home?.id ?? null,
        x: pos.x, y: pos.y, facing: 'down', path: [], activity: 'idle', anim: 'idle', seated: false, pointId: null,
        intent: null, until: 0, lastActivity: null, partnerId: null, chatTurns: 0, emote: null,
        op: { state: 'idle', taskTitle: null, partnerId: null, progress: 0, origin: 'demo' },
        nextDecision: this.time + 300 + this.rnd() * 2500,
      })
    }
  }

  private remove(id: string) {
    const a = this.actors.get(id)
    if (a) this.release(a)
    this.actors.delete(id)
  }

  /** CAMADA 2 → CAMADA 1: estado operacional tem prioridade sobre o ambiental. */
  setOperational(id: string, op: OperationalInput) {
    const a = this.actors.get(id)
    if (!a) return
    const prev = a.op.state
    a.op = op
    if (prev === op.state) return
    const kind = op.origin === 'real' ? 'operacional-real' : 'operacional-demo'
    if (BUSY_STATES.includes(op.state) && !BUSY_STATES.includes(prev)) {
      this.endSocial(a)
      this.goToPoint(a, a.homePointId ?? this.findFreePoint(a, 'work')?.id ?? null, 'work', 1e9)
      if (op.taskTitle) this.events.feed?.(`${a.name} iniciou: ${op.taskTitle}`, kind, a.id)
    } else if (op.state === 'collaborating') {
      const partner = op.partnerId ? this.actors.get(op.partnerId) : undefined
      if (partner && a.id < partner.id) this.startChat(a, partner, true)
    } else if (op.state === 'completed') {
      a.emote = { key: 'check', until: this.time + 2500 }
      if (a.op.taskTitle || op.taskTitle) this.events.feed?.(`${a.name} concluiu: ${op.taskTitle ?? a.op.taskTitle}`, kind, a.id)
      this.speak(a, pick(LINES.done, this.rnd), kind)
      this.release(a)
      this.setActivity(a, 'celebrate', 2400)
    } else if (op.state === 'failed') {
      a.emote = { key: 'exclaim', until: this.time + 3000 }
      this.events.feed?.(`${a.name} encontrou um erro na tarefa`, kind, a.id)
      this.setActivity(a, 'think', 2500)
    } else if (op.state === 'paused') {
      this.endSocial(a)
      a.path = []
      this.setActivity(a, 'paused', 1e9)
    } else if (op.state === 'idle' && (prev === 'paused' || BUSY_STATES.includes(prev))) {
      this.release(a)
      this.setActivity(a, 'idle', 600)
    }
  }

  // -------------------------------------------------------------------------
  // Laço principal
  // -------------------------------------------------------------------------
  tick(dtMs: number) {
    const dt = Math.min(dtMs, 100)
    this.time += dt
    for (const a of this.actors.values()) {
      if (a.emote && a.emote.until < this.time) a.emote = null
      if (a.path.length) {
        this.move(a, dt)
        continue
      }
      if (a.intent) {
        this.arrive(a)
        continue
      }
      if (a.activity === 'chat') {
        this.updateChat(a)
        continue
      }
      if (this.time >= a.until && this.time >= a.nextDecision) this.decide(a)
    }
  }

  private move(a: Actor, dt: number) {
    const next = a.path[0]
    const target = a.path.length === 1 && a.intent?.pointId ? pointPx(this.map, this.pointById(a.intent.pointId)!) : tileToPx(this.map, next)
    const dx = target.x - a.x, dy = target.y - a.y
    const dist = Math.hypot(dx, dy)
    const step = (SPEED * dt) / 1000
    if (dist <= step) {
      a.x = target.x; a.y = target.y
      a.path.shift()
    } else {
      a.x += (dx / dist) * step; a.y += (dy / dist) * step
    }
    if (Math.abs(dx) > Math.abs(dy)) a.facing = dx < 0 ? 'left' : 'right'
    else if (Math.abs(dy) > 0.01) a.facing = dy < 0 ? 'up' : 'down'
    a.activity = 'walk'
    a.seated = false
    a.anim = a.facing === 'up' ? 'walkb' : a.facing === 'down' ? 'walkf' : 'walks'
  }

  private arrive(a: Actor) {
    const intent = a.intent!
    a.intent = null
    const p = this.pointById(intent.pointId)
    if (p) {
      const pos = pointPx(this.map, p)
      a.x = pos.x; a.y = pos.y
      a.facing = p.facing
      a.seated = p.sit
    }
    if (intent.facing) a.facing = intent.facing
    this.setActivity(a, intent.activity, intent.duration)
    if (intent.activity === 'coffee' && this.rnd() < 0.4) this.speak(a, pick(LINES.coffee, this.rnd), 'ambiente')
    if (intent.activity === 'observe') {
      a.emote = { key: this.rnd() < 0.5 ? 'idea' : 'question', until: this.time + 2200 }
      if (this.rnd() < 0.3) this.speak(a, pick(a.robot ? LINES.robot : LINES.observe, this.rnd), 'ambiente')
    }
    if (intent.activity === 'rest' && this.rnd() < 0.4) a.emote = { key: 'zzz', until: this.time + 4000 }
  }

  private setActivity(a: Actor, act: AmbientActivity, duration: number) {
    if (a.activity !== act) a.lastActivity = a.activity === 'walk' ? a.lastActivity : a.activity
    a.activity = act
    a.until = this.time + duration
    a.nextDecision = a.until
    a.anim = this.animFor(a)
  }

  animFor(a: Actor): AnimKey {
    switch (a.activity) {
      case 'work':
        if (BUSY_STATES.includes(a.op.state) && (a.op.state === 'planning' || a.op.state === 'reviewing')) return a.facing === 'up' ? 'sitb' : 'think'
        return a.facing === 'up' ? (a.seated ? 'sitb' : 'idleb') : 'work'
      case 'chat': return 'talk'
      case 'coffee': return 'coffee'
      case 'read': return a.seated ? 'read' : a.facing === 'up' ? 'idleb' : 'read'
      case 'observe': return a.facing === 'up' ? 'idleb' : 'idle'
      case 'celebrate': return 'cheer'
      case 'think': return 'think'
      case 'wave': return 'talk'
      default: return a.facing === 'up' ? 'idleb' : 'idle'
    }
  }

  // -------------------------------------------------------------------------
  // Decisão ambiental (limitada em frequência, ponderada pela personalidade)
  // -------------------------------------------------------------------------
  private decide(a: Actor) {
    a.nextDecision = this.time + 1500
    if (a.activity === 'paused') return
    if (BUSY_STATES.includes(a.op.state)) {
      if (a.pointId !== a.homePointId || a.activity !== 'work') this.goToPoint(a, a.homePointId ?? this.findFreePoint(a, 'work')?.id ?? null, 'work', 1e9)
      else a.anim = this.animFor(a)
      return
    }
    const p = a.personality
    const n = (v: number) => v / 100
    const weights: [string, number][] = [
      ['work', 0.35 + n(p.organization) * 0.5 + n(p.initiative) * 0.35],
      ['chat', 0.15 + n(p.sociability) * 0.8 + n(p.collaboration) * 0.25 - (p.preference === 'individual' ? 0.25 : 0)],
      ['coffee', 0.25 + n(p.sociability) * 0.2],
      ['read', 0.1 + n(p.curiosity) * 0.35 + n(p.creativity) * 0.25],
      ['observe', 0.1 + n(p.curiosity) * 0.55],
      ['rest', 0.12 + (1 - n(p.initiative)) * 0.35],
      ['wander', 0.25 + n(p.curiosity) * 0.2],
      ['fun', 0.05],
    ]
    if (a.robot) weights.push(['patrol', 0.9])
    const adjusted = weights.map(([k, w]) => [k, Math.max(0.01, k === a.lastActivity ? w * 0.25 : w)] as [string, number])
    const total = adjusted.reduce((s, [, w]) => s + w, 0)
    let r = this.rnd() * total
    let choice = adjusted[0][0]
    for (const [k, w] of adjusted) { r -= w; if (r <= 0) { choice = k; break } }

    this.release(a)
    switch (choice) {
      case 'work':
        return void this.goToPoint(a, a.homePointId && !this.isReservedByOther(a.homePointId, a) ? a.homePointId : this.findFreePoint(a, 'work')?.id ?? null, 'work', 8000 + this.rnd() * 14000)
      case 'chat': {
        const partner = this.findChatPartner(a)
        if (partner) return void this.startChat(a, partner, false)
        return void this.goToType(a, 'coffee', 'coffee', 6000 + this.rnd() * 5000)
      }
      case 'coffee': return void this.goToType(a, 'coffee', 'coffee', 6000 + this.rnd() * 6000)
      case 'read': return void this.goToType(a, 'read', 'read', 7000 + this.rnd() * 8000)
      case 'observe': return void this.goToType(a, this.rnd() < 0.5 ? 'observe' : 'window', 'observe', 4000 + this.rnd() * 5000)
      case 'rest': return void this.goToType(a, 'rest', 'rest', 7000 + this.rnd() * 9000)
      case 'fun':
        this.setActivity(a, 'celebrate', 1800)
        a.emote = { key: 'music', until: this.time + 2000 }
        if (this.rnd() < 0.5) this.speak(a, pick(LINES.fun, this.rnd), 'ambiente')
        return
      default: {
        const t = this.randomTile(true)
        this.walkTo(a, t, { activity: 'idle', pointId: null, duration: 1500 + this.rnd() * 2500 })
      }
    }
  }

  // -------------------------------------------------------------------------
  // Conversas
  // -------------------------------------------------------------------------
  private findChatPartner(a: Actor): Actor | null {
    const candidates = this.list().filter((b) => b.id !== a.id && !b.partnerId && !b.path.length && !b.intent &&
      !BUSY_STATES.includes(b.op.state) && b.activity !== 'paused' && b.op.state !== 'collaborating')
    if (!candidates.length) return null
    candidates.sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))
    const pool = candidates.slice(0, 3)
    const b = pick(pool, this.rnd)
    return this.rnd() < 0.25 + b.personality.sociability / 140 ? b : null
  }

  /** Dois agentes se encontram num ponto de reunião (ou adjacentes) e conversam. */
  startChat(a: Actor, b: Actor, professional: boolean) {
    this.release(a); this.release(b)
    const meetPts = this.map.points.filter((p) => p.type === 'meet' && !this.reserved.has(p.id))
    let pa: InteractionPoint | null = null, pb: InteractionPoint | null = null
    for (const p of meetPts) {
      const q = meetPts.find((o) => o.id !== p.id && o.prop === p.prop)
      if (q) { pa = p; pb = q; break }
    }
    a.partnerId = b.id; b.partnerId = a.id
    a.chatTurns = b.chatTurns = 2 + Math.floor(this.rnd() * 3)
    const dur = professional ? 1e9 : 20000
    if (pa && pb && this.rnd() < 0.6) {
      this.reserve(pa.id, a); this.reserve(pb.id, b)
      this.walkTo(a, pa, { activity: 'chat', pointId: pa.id, duration: dur })
      this.walkTo(b, pb, { activity: 'chat', pointId: pb.id, duration: dur })
    } else {
      // encontro no meio do caminho
      const ta = pxToTile(this.map, a.x, a.y)
      const tb = pxToTile(this.map, b.x, b.y)
      const mid = this.nearestWalkable({ x: Math.round((ta.x + tb.x) / 2), y: Math.round((ta.y + tb.y) / 2) })
      const side = this.nearestWalkable({ x: mid.x + 1, y: mid.y }, mid)
      this.walkTo(a, mid, { activity: 'chat', pointId: null, duration: dur, facing: side.x >= mid.x ? 'right' : 'left' })
      this.walkTo(b, side, { activity: 'chat', pointId: null, duration: dur, facing: side.x >= mid.x ? 'left' : 'right' })
    }
    a.nextDecision = b.nextDecision = this.time + 1200
    if (!professional) this.events.feed?.(`${a.name} e ${b.name} estão conversando`, 'ambiente', a.id)
  }

  private updateChat(a: Actor) {
    const b = a.partnerId ? this.actors.get(a.partnerId) : undefined
    if (!b || b.partnerId !== a.id) return this.endSocial(a)
    const bothThere = !a.path.length && !a.intent && !b.path.length && !b.intent
    if (!bothThere || this.time < a.nextDecision) return
    const professional = a.op.state === 'collaborating'
    if (a.id < b.id) {
      if (a.chatTurns <= 0 && !professional) {
        this.speak(a, pick(LINES.bye, this.rnd), 'ambiente')
        a.emote = { key: 'wave', until: this.time + 1500 }
        this.endSocial(a); this.endSocial(b)
        a.nextDecision = this.time + 1200; b.nextDecision = this.time + 1800
        return
      }
      const speaker = a.chatTurns % 2 === 0 ? a : b
      const listener = speaker === a ? b : a
      if (professional) {
        this.speak(speaker, pick(DEMO_PRO_LINES, this.rnd), a.op.origin === 'real' ? 'operacional-real' : 'operacional-demo')
      } else {
        const first = a.chatTurns >= 3
        const pool = first ? LINES.greet : speaker.personality.curiosity > 70 ? LINES.research : speaker === a ? LINES.work : LINES.workReply
        this.speak(speaker, pick(pool, this.rnd), 'ambiente')
        if (this.rnd() < 0.35) listener.emote = { key: pick(['heart', 'idea', 'question', 'exclaim'] as EmoteKey[], this.rnd), until: this.time + 1800 }
      }
      speaker.anim = 'talk'; listener.anim = 'idle'
      a.chatTurns--; b.chatTurns--
      a.nextDecision = b.nextDecision = this.time + 2600 + this.rnd() * 900
    }
  }

  private endSocial(a: Actor) {
    const b = a.partnerId ? this.actors.get(a.partnerId) : undefined
    a.partnerId = null
    if (b && b.partnerId === a.id) {
      b.partnerId = null
      if (b.activity === 'chat' || b.intent?.activity === 'chat') { b.intent = null; b.path = []; this.release(b); this.setActivity(b, 'idle', 800) }
    }
    if (a.activity === 'chat' || a.intent?.activity === 'chat') { a.intent = null; a.path = []; this.release(a); this.setActivity(a, 'idle', 600) }
  }

  // -------------------------------------------------------------------------
  // Navegação e reservas de pontos de interação
  // -------------------------------------------------------------------------
  private reserve(pointId: string, a: Actor) {
    this.reserved.set(pointId, a.id)
    a.pointId = pointId
  }

  private release(a: Actor) {
    if (a.pointId && this.reserved.get(a.pointId) === a.id) this.reserved.delete(a.pointId)
    a.pointId = null
    a.seated = false
  }

  private isReservedByOther(pointId: string, a: Actor) {
    const r = this.reserved.get(pointId)
    return !!r && r !== a.id
  }

  findFreePoint(a: Actor, type: PointType): InteractionPoint | null {
    const free = this.map.points.filter((p) => p.type === type && !this.isReservedByOther(p.id, a))
    if (!free.length) return null
    free.sort((p, q) => Math.hypot(p.x * 16 - a.x, p.y * 16 - a.y) - Math.hypot(q.x * 16 - a.x, q.y * 16 - a.y))
    return this.rnd() < 0.6 ? free[0] : pick(free, this.rnd)
  }

  private goToType(a: Actor, type: PointType, act: AmbientActivity, duration: number) {
    const p = this.findFreePoint(a, type)
    if (!p) return void this.setActivity(a, 'idle', 1500)
    this.goToPoint(a, p.id, act, duration)
  }

  goToPoint(a: Actor, pointId: string | null, act: AmbientActivity, duration: number) {
    const p = this.pointById(pointId)
    if (!p) return void this.setActivity(a, act === 'work' ? 'think' : 'idle', 2000)
    this.reserve(p.id, a)
    this.walkTo(a, p, { activity: act, pointId: p.id, duration })
  }

  private walkTo(a: Actor, target: Tile | InteractionPoint, intent: NonNullable<Actor['intent']>) {
    const from = pxToTile(this.map, a.x, a.y)
    const start = isWalkable(this.map, from.x, from.y) ? from : this.nearestWalkable(from)
    const goal = { x: target.x, y: target.y }
    const path = findPath(start, goal, this.map.width, this.map.height, (x, y) => isWalkable(this.map, x, y))
    a.seated = false
    a.intent = intent
    if (path === null) {
      // destino inalcançável: teleporte discreto não é permitido — permanece e tenta outra coisa
      a.intent = null
      if ('id' in target) this.release(a)
      this.setActivity(a, 'think', 1500)
      return
    }
    a.path = path.length ? path : [goal]
  }

  private nearestWalkable(t: Tile, avoid?: Tile): Tile {
    for (let r = 0; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = t.x + dx, y = t.y + dy
        if (avoid && avoid.x === x && avoid.y === y) continue
        if (isWalkable(this.map, x, y)) return { x, y }
      }
    }
    return this.walkCache[0]
  }

  private randomTile(otherZone = false): Tile {
    const t = this.walkCache[Math.floor(this.rnd() * this.walkCache.length)]
    if (!otherZone) return t
    return zoneAt(this.map, t) ? t : this.walkCache[Math.floor(this.rnd() * this.walkCache.length)]
  }

  private speak(a: Actor, text: string, kind: 'ambiente' | 'operacional-demo' | 'operacional-real') {
    this.events.speech?.(a.id, text, kind)
  }

  /** Coloca o ator imediatamente no destino (usado em testes e ao abrir a sala). */
  snapToHome(id: string) {
    const a = this.actors.get(id)
    const p = this.pointById(a?.homePointId ?? null)
    if (!a || !p) return
    const pos = pointPx(this.map, p)
    a.x = pos.x; a.y = pos.y; a.facing = p.facing; a.seated = p.sit
    this.reserve(p.id, a)
    this.setActivity(a, 'work', 3000 + this.rnd() * 8000)
  }
}
