import { describe, expect, it } from 'vitest'
import { findPath } from '@/world/nav/astar'
import { AmbientWorld } from '@/world/ambient/AmbientWorld'
import { getWorldMap, isWalkable, pxToTile } from '@/world/maps'
import { seeded } from '@/services/demo/demoData'

const office = getWorldMap('office')
const lab = getWorldMap('research')

describe('A*', () => {
  it('contorna obstáculos em uma grade simples', () => {
    const grid = ['.....', '.###.', '.....']
    const walk = (x: number, y: number) => grid[y]?.[x] === '.'
    const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, 5, 3, walk)!
    expect(path.at(-1)).toEqual({ x: 4, y: 1 })
    expect(path.every((t) => walk(t.x, t.y))).toBe(true)
  })
  it('retorna null para destino bloqueado', () => {
    expect(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, 3, 3, (x, y) => !(x === 1 && y === 1))).toBeNull()
  })
  it('conecta o mezanino ao piso principal pela escada (escritório e laboratório)', () => {
    for (const m of [office, lab]) {
      const mez = m.nav.findIndex((row) => row.includes('m'))
      const top = { x: m.nav[mez].indexOf('m'), y: mez }
      const bottom = { x: 20, y: 21 }
      const p = findPath(top, bottom, m.width, m.height, (x, y) => isWalkable(m, x, y))
      expect(p).not.toBeNull()
      expect(p!.some((t) => m.nav[t.y][t.x] === 's')).toBe(true)
    }
  })
})

describe('mapas', () => {
  it('todos os pontos de interação são alcançáveis', () => {
    for (const m of [office, lab]) {
      for (const pt of m.points) expect(isWalkable(m, pt.x, pt.y), `${m.id}:${pt.id}`).toBe(true)
    }
  })
  it('possuem estações de trabalho, café, descanso e reunião', () => {
    for (const m of [office, lab]) {
      for (const t of ['work', 'meet', 'coffee', 'rest', 'observe']) expect(m.points.some((p) => p.type === t), `${m.id}:${t}`).toBe(true)
    }
  })
})

function makeWorld(n = 6, seed = 3) {
  const w = new AmbientWorld(office, {}, seeded(seed))
  w.setActors(Array.from({ length: n }, (_, i) => ({ id: `a${i}`, name: `Agente ${i}`, role: 'Teste', characterId: 'analista', robot: false, stationId: null })))
  return w
}

describe('AmbientWorld (camada ambiental)', () => {
  it('personagens se movem sem atravessar paredes ou móveis', () => {
    const w = makeWorld(8)
    let moved = false
    const start = w.list().map((a) => [a.x, a.y])
    for (let i = 0; i < 1500; i++) {
      w.tick(50)
      for (const a of w.list()) {
        const t = pxToTile(office, a.x, a.y)
        if (a.path.length || a.activity === 'walk') expect(isWalkable(office, t.x, t.y), `${a.id} em ${t.x},${t.y}`).toBe(true)
      }
    }
    w.list().forEach((a, i) => { if (Math.hypot(a.x - start[i][0], a.y - start[i][1]) > 16) moved = true })
    expect(moved).toBe(true)
  })

  it('gera comportamentos variados ao longo do tempo', () => {
    const w = makeWorld(8, 11)
    const seen = new Set<string>()
    for (let i = 0; i < 6000; i++) { w.tick(50); w.list().forEach((a) => seen.add(a.activity)) }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it('estado operacional tem prioridade: agente vai para a estação e trabalha', () => {
    const w = makeWorld(3, 5)
    const a = w.list()[0]
    w.setOperational(a.id, { state: 'working', taskTitle: 'Teste', partnerId: null, progress: 0.2, origin: 'demo' })
    for (let i = 0; i < 1200 && !(a.activity === 'work' && !a.path.length); i++) w.tick(50)
    expect(a.activity).toBe('work')
    const home = w.pointById(a.homePointId)!
    expect(pxToTile(office, a.x, a.y)).toEqual({ x: home.x, y: home.y })
  })

  it('agente pausado não circula', () => {
    const w = makeWorld(2, 9)
    const a = w.list()[0]
    w.setOperational(a.id, { state: 'paused', taskTitle: null, partnerId: null, progress: 0, origin: 'demo' })
    const p = [a.x, a.y]
    for (let i = 0; i < 400; i++) w.tick(50)
    expect([a.x, a.y]).toEqual(p)
    expect(a.activity).toBe('paused')
  })

  it('entrega real: remetente caminha até o colega e fala o texto da mensagem do backend', () => {
    const spoken: [string, string, string][] = []
    const w = new AmbientWorld(office, { speech: (id, text, kind) => spoken.push([id, text, kind]) }, seeded(4))
    w.setActors([0, 1].map((i) => ({ id: `a${i}`, name: `Agente ${i}`, role: 'T', characterId: 'analista', robot: false, stationId: null })))
    const [a, b] = w.list()
    w.deliver('a0', 'a1', 'Achados prontos')
    for (let i = 0; i < 2000 && !spoken.length; i++) w.tick(50)
    expect(spoken[0]).toEqual(['a0', 'Achados prontos', 'operacional-real'])
    const ta = pxToTile(office, a.x, a.y), tb = pxToTile(office, b.x, b.y)
    expect(Math.abs(ta.x - tb.x) + Math.abs(ta.y - tb.y)).toBeLessThanOrEqual(6)
  })

  it('conversas ambientais nunca afirmam progresso de trabalho', () => {
    const spoken: string[] = []
    const w = new AmbientWorld(office, { speech: (_id, text, kind) => { if (kind === 'ambiente') spoken.push(text) } }, seeded(21))
    w.setActors(Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, role: 'T', characterId: 'analista', robot: false, stationId: null })))
    for (let i = 0; i < 8000; i++) w.tick(50)
    expect(spoken.length).toBeGreaterThan(0)
    expect(spoken.join(' ')).not.toMatch(/conclu|entrega|relat|experimento|resultado|dados|modelo/i)
  })
})
