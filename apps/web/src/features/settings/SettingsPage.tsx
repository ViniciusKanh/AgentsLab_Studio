import { useEffect, useState } from 'react'
import { Plug, RotateCcw, Settings, ShieldCheck } from 'lucide-react'
import { appConfig } from '@/services/config'
import { useBackendStore } from '@/services/backend'
import { platform } from '@/services/platform'
import { connectBackend } from '@/app/bootstrap'
import { useLabStore } from '@/stores/labStore'
import { useWorldStore } from '@/stores/worldStore'
import { useUiStore } from '@/stores/uiStore'
import { ConfirmModal } from '@/components/ui/Modal'
import { Chip, Field, Panel } from '@/components/ui/primitives'

export default function SettingsPage() {
  const resetDemo = useLabStore((s) => s.resetDemo)
  const { ambientSpeed, setAmbientSpeed } = useWorldStore()
  const { baseUrl, setBaseUrl, status, version, lastError } = useBackendStore()
  const toast = useUiStore((s) => s.toast)
  const [url, setUrl] = useState(baseUrl)
  const [confirm, setConfirm] = useState(false)
  const [vault, setVault] = useState<{ available: boolean; backend: string | null; error?: string } | null>(null)

  useEffect(() => {
    if (status === 'online') platform.vault().then(setVault).catch(() => setVault(null))
    else setVault(null)
  }, [status])

  const connect = async () => {
    setBaseUrl(url)
    const ok = await connectBackend()
    toast(ok ? 'Backend conectado' : 'Não foi possível conectar ao backend', ok ? 'success' : 'error')
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="settings-page">
      <div className="px-panel c-purple flex items-center gap-3 px-3 py-2">
        <Settings size={30} className="text-neon-purple" />
        <div><h1 className="title-pixel text-[15px]">Configurações</h1><p className="text-[12px] text-lab-muted">Conexão com o backend local, segurança e preferências.</p></div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Panel accent="green" title="Conexão com o backend">
          <div className="space-y-2 text-[12px]">
            <p>Status: {status === 'online' ? <Chip color="#00f5a0">Conectado{version ? ` · API ${version}` : ''}</Chip> : status === 'checking' ? <Chip color="#8b97c4">Verificando…</Chip> : <Chip color="#ffb800">Desconectado</Chip>}</p>
            <Field label="Endereço da API" hint="Servidor FastAPI local. Padrão: http://localhost:8000">
              <input className="px-input font-mono" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="backend-url" />
            </Field>
            <button className="px-btn solid" onClick={() => void connect()} data-testid="backend-connect"><Plug size={14} /> Conectar</button>
            {status === 'offline' && (
              <div className="rounded-[5px] bg-[#050913] p-2 text-[11px] text-lab-muted">
                <p className="mb-1">Para iniciar o backend (Windows / PowerShell):</p>
                <pre className="whitespace-pre-wrap font-mono text-[10.5px] text-lab-text">cd C:\dev\AgentsLab_Studio\apps\api{'\n'}.venv\Scripts\activate{'\n'}uvicorn app.main:app --port 8000</pre>
                {lastError && <p className="mt-1 text-neon-pink">Último erro: {lastError}</p>}
              </div>
            )}
          </div>
        </Panel>
        <Panel accent="cyan" title="Segurança das chaves">
          <ul className="space-y-1.5 text-[11.5px]">
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> As chaves são digitadas no app e enviadas uma única vez ao backend local, que as guarda no cofre do sistema operacional (Windows: Gerenciador de Credenciais).</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> O navegador nunca armazena nem recebe a chave de volta — apenas apelido e 4 últimos caracteres.</li>
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Conteúdo de fontes externas é tratado como dado não confiável nos prompts.</li>
          </ul>
          {vault && <p className="mt-2 text-[11.5px]">Cofre em uso: {vault.available ? <Chip color="#00f5a0">{vault.backend}</Chip> : <Chip color="#ff537a">indisponível</Chip>} {vault.error && <span className="text-neon-pink">{vault.error}</span>}</p>}
        </Panel>
        <Panel accent="purple" title="Ambiente visual">
          <p className="px-label">Velocidade da animação ambiental (não altera tarefas reais)</p>
          <div className="flex gap-1.5">
            {([0, 1, 3] as const).map((v) => <button key={v} className={`px-btn sm ${ambientSpeed === v ? 'solid' : 'ghost'}`} onClick={() => setAmbientSpeed(v)}>{v === 0 ? 'Pausada' : v === 1 ? 'Normal' : 'Acelerada'}</button>)}
          </div>
          <p className="mt-2 text-[10.5px] text-lab-muted">Caminhadas, café e conversas sociais são apenas ambientação. Estados de trabalho, mensagens e entregas vêm exclusivamente do backend.</p>
        </Panel>
        <Panel accent="pink" title="Exemplos offline">
          <p className="text-[11.5px] text-lab-muted">Sem backend, o app mostra agentes de exemplo guardados no navegador (somente visualização). Versão {appConfig.version}.</p>
          <button className="px-btn mt-3" style={{ ['--c' as string]: '#ff537a' }} onClick={() => setConfirm(true)} disabled={appConfig.mode === 'real'}><RotateCcw size={14} /> Restaurar exemplos</button>
        </Panel>
      </div>
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void resetDemo()} title="Restaurar exemplos" message="Os agentes de exemplo locais serão restaurados." confirmLabel="Restaurar" />
    </div>
  )
}
