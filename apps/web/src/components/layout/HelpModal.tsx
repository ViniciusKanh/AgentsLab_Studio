import { Modal } from '../ui/Modal'
import { useUiStore } from '@/stores/uiStore'
import { STATE_META } from '@/simulation/states'

export function HelpModal() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Guia rápido" accent="cyan" width={620}>
      <div className="space-y-3 text-[12px] leading-relaxed">
        <p><b className="text-neon-cyan">Ambiente:</b> arraste para mover a câmera, use a roda do mouse para zoom, clique em um personagem para abrir o painel e dê <b>duplo clique</b> para centralizar. Objetos com brilho ao passar o mouse são interativos.</p>
        <p><b className="text-neon-green">Duas camadas:</b> a vida no ambiente (andar, café, conversas, leitura) é local e não consome tokens. As tarefas (estados abaixo) vêm do motor operacional — no modo demo são simuladas e marcadas como <b>DEMO</b>.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(STATE_META).map(([k, v]) => (
            <span key={k} className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: v.color }} /> <b>{v.label}</b> <span className="text-lab-muted">({k})</span></span>
          ))}
        </div>
        <p><b className="text-neon-gold">Atalhos:</b> Esc sai do modo observador ou fecha a seleção. A velocidade (pausa/normal/acelerada) altera só a simulação ambiental.</p>
      </div>
    </Modal>
  )
}
