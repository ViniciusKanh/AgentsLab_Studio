import { appConfig } from '@/services/config'
import { createSseEventStream } from '@/services/realtime'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { demoSimulator } from '@/simulation/demoSimulator'

let started = false

/** Inicializa dados e a fonte de eventos (demo ou real). Idempotente. */
export async function bootstrap() {
  if (started) return
  started = true
  await useLabStore.getState().load()
  if (appConfig.mode === 'demo') {
    demoSimulator.start()
  } else {
    useSimulationStore.getState().ensure(useLabStore.getState().agents.map((a) => a.id))
    createSseEventStream().connect((e) => useSimulationStore.getState().ingest(e))
  }
}
