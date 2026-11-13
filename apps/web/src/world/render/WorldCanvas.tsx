import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { useWorldStore } from '@/stores/worldStore'
import { useLabStore } from '@/stores/labStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { activityLabel, STATE_META } from '@/simulation/states'
import { Avatar } from '@/components/ui/primitives'
import { WorldOverlay } from './WorldOverlay'
import type { WorldBridge } from './WorldScene'

/**
 * Host React do motor Phaser do mundo. Uma instância de jogo por ambiente,
 * destruída no unmount. Se o WebGL/Canvas falhar, mostra a sala em modo lista
 * (a simulação operacional continua funcionando).
 */
export function WorldCanvas({ envId }: { envId: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const labels = useWorldStore((s) => s.labels)
  const overlayRef = useRef<WorldOverlay | null>(null)

  useEffect(() => {
    overlayRef.current?.setLabels(labels)
  }, [labels])

  useEffect(() => {
    let disposed = false
    let game: Phaser.Game | null = null
    setReady(false)
    setFailed(null)
    const overlay = new WorldOverlay(wrapRef.current!)
    overlay.setLabels(useWorldStore.getState().labels)
    overlayRef.current = overlay
    const bridge: WorldBridge = { envId, overlay, onReady: () => !disposed && setReady(true) }
    ;(async () => {
      try {
        const PhaserMod = (await import('phaser')).default
        const { WorldScene } = await import('./WorldScene')
        if (disposed || !hostRef.current) return
        game = new PhaserMod.Game({
          type: PhaserMod.AUTO,
          parent: hostRef.current,
          pixelArt: true,
          roundPixels: true,
          backgroundColor: '#080e1a',
          banner: false,
          audio: { noAudio: true },
          fps: { target: 60, limit: 60 },
          scale: { mode: PhaserMod.Scale.RESIZE, width: hostRef.current.clientWidth || 960, height: hostRef.current.clientHeight || 540 },
          callbacks: { preBoot: (g) => g.registry.set('bridge', bridge) },
          scene: [WorldScene],
        })
      } catch (err) {
        console.error('[AgentsLab] renderizador indisponível', err)
        if (!disposed) setFailed((err as Error).message || 'renderizador indisponível')
      }
    })()
    return () => {
      disposed = true
      game?.destroy(true)
      overlay.destroy()
      overlayRef.current = null
    }
  }, [envId])

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-lab-bg" data-testid="world-canvas">
      <div ref={hostRef} className="absolute inset-0" />
      {!ready && !failed && <div className="absolute inset-0 grid place-items-center"><span className="title-pixel animate-blink text-[10px] text-lab-muted">Carregando ambiente…</span></div>}
      {failed && <FallbackWorld envId={envId} reason={failed} />}
    </div>
  )
}

function FallbackWorld({ envId, reason }: { envId: string; reason: string }) {
  const agents = useLabStore((s) => s.agents).filter((a) => a.environmentId === envId)
  const runtime = useSimulationStore((s) => s.runtime)
  const select = useSimulationStore((s) => s.select)
  return (
    <div className="absolute inset-0 overflow-auto bg-[#0a1126] p-4" data-testid="fallback-world">
      <p className="mb-3 text-[11px] text-neon-gold">Renderizador gráfico indisponível ({reason}). A simulação continua em modo lista.</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {agents.map((a) => {
          const m = STATE_META[runtime[a.id]?.state ?? 'idle']
          return (
            <button key={a.id} onClick={() => select(a.id)} className="px-inset flex items-center gap-2 p-2 text-left">
              <Avatar characterId={a.appearance.characterId} size={32} ring={m.color} />
              <span><b className="block text-[12px]">{a.name}</b><span className="text-[10.5px]" style={{ color: m.color }}>{activityLabel(runtime[a.id]?.state ?? 'idle', runtime[a.id]?.taskKind)}</span></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
