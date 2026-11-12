import office from './data/office.json'
import research from './data/research.json'
import meta from './data/meta.json'
import type { InteractionPoint, Tile, WorldMapData } from './types'

/** Mapas gerados por tools/pixelart/world_maps.py. Adicionar ambientes = novo JSON aqui. */
export const WORLD_MAPS: Record<string, WorldMapData> = {
  office: office as unknown as WorldMapData,
  research: research as unknown as WorldMapData,
}

export const WORLD_META = meta as { frameW: number; frameH: number; framesPerChar: number; cast: string[]; stateIcons: string[]; emotes: string[] }

export const ENV_ROUTES: Record<string, string> = { office: '/escritorio', research: '/laboratorio' }
export const envPath = (envId: string) => ENV_ROUTES[envId] ?? '/escritorio'
export const isWorldEnv = (envId: string) => envId in WORLD_MAPS

export function getWorldMap(id: string): WorldMapData {
  return WORLD_MAPS[id] ?? WORLD_MAPS.office
}

export function castIndex(characterId: string): number {
  const i = WORLD_META.cast.indexOf(characterId)
  return i < 0 ? 1 : i
}

export const AGENT_CHARACTERS = WORLD_META.cast.filter((c) => c !== 'vinicius')

export function isWalkable(map: WorldMapData, x: number, y: number): boolean {
  if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false
  return map.nav[y][x] !== '#'
}

/** Pés do personagem (px) para um tile. */
export const tileToPx = (map: WorldMapData, t: Tile) => ({ x: t.x * map.tile + map.tile / 2, y: t.y * map.tile + 13 })

export const pointPx = (map: WorldMapData, p: InteractionPoint) => ({ x: p.x * map.tile + map.tile / 2 + p.dx, y: p.y * map.tile + 13 + p.dy })

export const pxToTile = (map: WorldMapData, x: number, y: number): Tile => ({ x: Math.floor(x / map.tile), y: Math.floor((y - 1) / map.tile) })

export function zoneAt(map: WorldMapData, t: Tile) {
  return map.zones.find((z) => t.x >= z.x0 && t.x <= z.x1 && t.y >= z.y0 && t.y <= z.y1) ?? null
}

export function walkableTiles(map: WorldMapData): Tile[] {
  const out: Tile[] = []
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isWalkable(map, x, y)) out.push({ x, y })
  return out
}
