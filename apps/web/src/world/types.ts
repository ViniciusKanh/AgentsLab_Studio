/** Tipos do mundo virtual (camada de simulação ambiental). Independentes do Phaser. */

export type Facing = 'up' | 'down' | 'left' | 'right'

export type PointType = 'work' | 'meet' | 'coffee' | 'rest' | 'read' | 'observe' | 'window'

export interface InteractionPoint {
  id: string
  type: PointType
  x: number
  y: number
  facing: Facing
  sit: boolean
  prop: string | null
  zone: string | null
  dx: number
  dy: number
}

export interface WorldProp {
  id: string
  frame: string
  x: number
  y: number
  w: number
  h: number
  depth: number
  label: string
  desc: string
  kind: string
  interactive: boolean
  tile: { x: number; y: number; w: number; h: number }
}

export interface WorldZone { id: string; name: string; x0: number; y0: number; x1: number; y1: number }

export interface WorldMapData {
  id: string
  name: string
  tile: number
  width: number
  height: number
  ground: string
  atlas: string
  /** tilemap de navegação: '.', 'm' (mezanino), 's' (escada) = caminhável; '#' = bloqueado */
  nav: string[]
  props: WorldProp[]
  points: InteractionPoint[]
  zones: WorldZone[]
  lights: { x: number; y: number; r: number; color: string; flicker: boolean }[]
  anims: { type: string; x: number; y: number; w?: number; h?: number }[]
  leds: { x: number; y: number; color: string }[]
}

export interface Tile { x: number; y: number }

/** Atividades ambientais (não consomem tokens; não representam execução real). */
export type AmbientActivity =
  | 'idle' | 'walk' | 'work' | 'chat' | 'coffee' | 'read' | 'observe' | 'rest' | 'celebrate' | 'think' | 'wave' | 'paused'

/** Animações disponíveis por personagem (ver tools/pixelart/characters.py). */
export type AnimKey = 'idle' | 'idleb' | 'walkf' | 'walks' | 'walkb' | 'work' | 'sitb' | 'talk' | 'think' | 'cheer' | 'coffee' | 'read'

export type EmoteKey = 'heart' | 'question' | 'exclaim' | 'music' | 'coffee' | 'idea' | 'zzz' | 'check' | 'wave'

export interface Personality {
  sociability: number
  creativity: number
  organization: number
  curiosity: number
  collaboration: number
  initiative: number
  preference: 'individual' | 'duplas' | 'grupos'
}
