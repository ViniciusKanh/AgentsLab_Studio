import type { SimulationEvent } from '@/types/domain'
import { appConfig } from './config'

/**
 * Fluxo de eventos em tempo real.
 * - Modo demo: eventos produzidos pelo DemoSimulator (src/simulation/demoSimulator.ts).
 * - Modo real: Server-Sent Events do backend em GET /api/v1/events (Fase 4/5).
 */
export interface EventStream {
  connect(onEvent: (e: SimulationEvent) => void): () => void
}

export function createSseEventStream(baseUrl = appConfig.apiBaseUrl): EventStream {
  return {
    connect(onEvent) {
      if (!baseUrl || typeof EventSource === 'undefined') return () => {}
      const es = new EventSource(`${baseUrl}/api/v1/events`, { withCredentials: true })
      es.onmessage = (msg) => {
        try {
          onEvent(JSON.parse(msg.data) as SimulationEvent)
        } catch (err) {
          console.error('[AgentsLab] evento inválido', err)
        }
      }
      return () => es.close()
    },
  }
}
