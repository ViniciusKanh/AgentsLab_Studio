import type { Tile } from '../types'

/**
 * A* em grade 4-direções com heap binário.
 * `walkable(x,y)` define obstáculos (paredes, mesas, equipamentos).
 * Retorna a lista de tiles do início (exclusivo) ao destino (inclusivo), ou null.
 */
export function findPath(start: Tile, goal: Tile, width: number, height: number, walkable: (x: number, y: number) => boolean, maxNodes = 4000): Tile[] | null {
  if (start.x === goal.x && start.y === goal.y) return []
  if (!walkable(goal.x, goal.y)) return null
  const key = (x: number, y: number) => y * width + x
  const g = new Map<number, number>()
  const came = new Map<number, number>()
  const open: [number, number][] = [] // [f, key]
  const push = (item: [number, number]) => {
    open.push(item)
    let i = open.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (open[p][0] <= open[i][0]) break
      ;[open[p], open[i]] = [open[i], open[p]]
      i = p
    }
  }
  const pop = () => {
    const top = open[0]
    const last = open.pop()!
    if (open.length) {
      open[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < open.length && open[l][0] < open[m][0]) m = l
        if (r < open.length && open[r][0] < open[m][0]) m = r
        if (m === i) break
        ;[open[m], open[i]] = [open[i], open[m]]
        i = m
      }
    }
    return top
  }
  const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y)
  const sk = key(start.x, start.y)
  g.set(sk, 0)
  push([h(start.x, start.y), sk])
  const closed = new Set<number>()
  let expanded = 0
  while (open.length) {
    const [, cur] = pop()
    if (closed.has(cur)) continue
    closed.add(cur)
    const cx = cur % width, cy = Math.floor(cur / width)
    if (cx === goal.x && cy === goal.y) {
      const path: Tile[] = []
      let k: number | undefined = cur
      while (k !== undefined && k !== sk) {
        path.push({ x: k % width, y: Math.floor(k / width) })
        k = came.get(k)
      }
      return path.reverse()
    }
    if (++expanded > maxNodes) return null
    const cg = g.get(cur)!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !walkable(nx, ny)) continue
      const nk = key(nx, ny)
      if (closed.has(nk)) continue
      const ng = cg + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        came.set(nk, cur)
        push([ng + h(nx, ny), nk])
      }
    }
  }
  return null
}
