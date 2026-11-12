import { useState } from 'react'
import { Settings, RotateCcw, ShieldCheck } from 'lucide-react'
import { appConfig } from '@/services/config'
import { useLabStore } from '@/stores/labStore'
import { useGameStore } from '@/stores/gameStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { useWorldStore } from '@/stores/worldStore'
import { ConfirmModal } from '@/components/ui/Modal'
import { Chip, Panel, Toggle } from '@/components/ui/primitives'

export default function SettingsPage() {
  const resetDemo = useLabStore((s) => s.resetDemo)
  const resetGame = useGameStore((s) => s.reset)
  const { running, setRunning } = useSimulationStore()
  const { ambientSpeed, setAmbientSpeed } = useWorldStore()
  const [confirm, setConfirm] = useState<'demo' | 'game' | null>(null)
  return (
    <div className="flex flex-col gap-2.5" data-testid="settings-page">
      <div className="px-panel c-purple flex items-center gap-3 px-3 py-2">
        <Settings size={30} className="text-neon-purple" />
        <div><h1 className="title-pixel text-[15px]">Configurações</h1><p className="text-[12px] text-lab-muted">Preferências gerais, modo de execução e segurança.</p></div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel accent="gold" title="Modo de execução">
          <dl className="grid grid-cols-[180px_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-lab-muted">Modo atual</dt><dd>{appConfig.mode === 'demo' ? <Chip color="#ffb800">Demonstrativo</Chip> : <Chip color="#00f5a0">Real</Chip>}</dd>
            <dt className="text-lab-muted">VITE_APP_MODE</dt><dd className="font-mono">{appConfig.mode}</dd>
            <dt className="text-lab-muted">VITE_API_BASE_URL</dt><dd className="font-mono">{appConfig.apiBaseUrl || '(vazio)'}</dd>
            <dt className="text-lab-muted">Versão</dt><dd>{appConfig.version}</dd>
          </dl>
          <p className="mt-2 text-[10.5px] text-lab-muted">O modo é definido no build. O modo real requer o backend FastAPI (Fase 2+).</p>
        </Panel>
        <Panel accent="cyan" title="Simulação">
          <div className="flex items-center justify-between text-[12px]">Missões automáticas (autopiloto demo)<Toggle checked={running} onChange={setRunning} label="Missões automáticas" /></div>
          <p className="mt-3 px-label">Velocidade da simulação ambiental (não altera tarefas)</p>
          <div className="flex gap-1.5">
            {([0, 1, 3] as const).map((v) => <button key={v} className={`px-btn sm ${ambientSpeed === v ? 'solid' : 'ghost'}`} onClick={() => setAmbientSpeed(v)}>{v === 0 ? 'Pausada' : v === 1 ? 'Normal' : 'Acelerada'}</button>)}
          </div>
        </Panel>
        <Panel accent="pink" title="Dados locais">
          <p className="text-[11.5px] text-lab-muted">Agentes, workflows e preferências do modo demonstrativo ficam no armazenamento local do navegador.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-btn" style={{ ['--c' as string]: '#ff537a' }} onClick={() => setConfirm('demo')}><RotateCcw size={14} /> Restaurar dados demo</button>
            <button className="px-btn" style={{ ['--c' as string]: '#ffb800' }} onClick={() => setConfirm('game')}><RotateCcw size={14} /> Zerar progresso (XP)</button>
          </div>
        </Panel>
        <Panel accent="green" title="Segurança">
          <ul className="space-y-1.5 text-[11.5px]">
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Nenhuma chave de API é armazenada no frontend.</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Operações sensíveis exigem aprovação humana (configurável por agente).</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Dados demonstrativos são identificados com o selo DEMO.</li>
          </ul>
        </Panel>
      </div>
      <ConfirmModal open={confirm === 'demo'} onClose={() => setConfirm(null)} onConfirm={() => void resetDemo()} title="Restaurar dados" message="Os agentes e workflows locais serão substituídos pelo cenário de exemplo." confirmLabel="Restaurar" />
      <ConfirmModal open={confirm === 'game'} onClose={() => setConfirm(null)} onConfirm={resetGame} title="Zerar progresso" message="XP, créditos, missões e conquistas voltarão ao início." confirmLabel="Zerar" />
    </div>
  )
}
