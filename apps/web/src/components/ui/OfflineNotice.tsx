import { Link } from 'react-router-dom'
import { WifiOff } from 'lucide-react'

/** Aviso padrão para telas que dependem do backend real. */
export function OfflineNotice({ what }: { what: string }) {
  return (
    <div className="px-panel c-gold flex flex-col items-center gap-2 p-6 text-center" data-testid="offline-notice">
      <WifiOff size={30} className="text-neon-gold" />
      <p className="text-[13px] font-extrabold">Backend desconectado</p>
      <p className="max-w-lg text-[12px] text-lab-muted">{what} dependem do servidor local (FastAPI), onde os agentes executam de verdade e as chaves ficam no cofre do sistema. Nada aqui é simulado.</p>
      <Link to="/configuracoes" className="px-btn solid">Configurar conexão</Link>
    </div>
  )
}
