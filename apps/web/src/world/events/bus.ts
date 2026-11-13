import type { WorldProp } from '../types'

/** Itens da faixa de eventos (diferencia ambiente × operacional demo × operacional real). */
export interface FeedItem {
  id: string
  ts: string
  text: string
  kind: 'ambiente' | 'operacional-demo' | 'operacional-real'
  agentId?: string
}

export interface WorldEvents {
  'agent:selected': { agentId: string | null }
  'object:selected': { prop: WorldProp | null; envId: string }
  'camera:focus': { agentId: string }
  'camera:fit': undefined
  'camera:zoom': { factor: number }
  'speech': { agentId: string; text: string; kind: 'ambiente' | 'operacional-demo' | 'operacional-real'; ttl: number }
  'feed': FeedItem
  /** Mensagem REAL registrada no backend (balões e entregas no mundo). */
  'agent:message': { fromAgentId: string | null; toAgentId: string | null; type: string; content: string }
}

type Handler<T> = (payload: T) => void

/** Barramento tipado React ↔ Phaser (sem dependências). */
export class EventBus<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<Handler<never>>>()
  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(fn as Handler<never>)
    return () => this.off(type, fn)
  }
  off<K extends keyof E>(type: K, fn: Handler<E[K]>) {
    this.handlers.get(type)?.delete(fn as Handler<never>)
  }
  emit<K extends keyof E>(type: K, payload: E[K]) {
    this.handlers.get(type)?.forEach((fn) => (fn as Handler<E[K]>)(payload))
  }
  clear() {
    this.handlers.clear()
  }
}

export const worldBus = new EventBus<WorldEvents & Record<string, unknown>>()
