import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Avatar, Field } from '@/components/ui/primitives'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'

const KINDS = [
  { id: 'general', label: 'Tarefa geral (texto)' },
  { id: 'research', label: 'Pesquisa com fontes (OpenAlex/arXiv)' },
  { id: 'analysis', label: 'Análise' },
]

/** Tarefa avulsa atribuída diretamente a um agente — executada de verdade pelo backend. */
export function AssignTaskModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const agent = useLabStore((s) => s.agents.find((a) => a.id === agentId))
  const toast = useUiStore((s) => s.toast)
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('general')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const online = appConfig.mode === 'real'

  const submit = async () => {
    if (title.trim().length < 3) return setError('Dê um título com pelo menos 3 caracteres.')
    setBusy(true)
    try {
      const r = await platform.assignTask(agentId, { title: title.trim(), description: description.trim(), kind })
      toast('Tarefa enviada ao agente', 'success')
      onClose()
      nav(`/projetos/${r.projectId}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Atribuir tarefa" accent="green" width={560}
      footer={<><button className="px-btn ghost" style={{ ['--c' as string]: '#39d6ff' }} onClick={onClose}>Cancelar</button><button className="px-btn solid" onClick={submit} disabled={!online || busy} data-testid="assign-submit">{busy ? 'Enviando…' : 'Atribuir'}</button></>}>
      <div className="space-y-3">
        {agent && <p className="flex items-center gap-2 text-[12px]"><Avatar characterId={agent.appearance.characterId} size={30} /> <b>{agent.name}</b> <span className="text-lab-muted">· {agent.role}</span></p>}
        {!online && <p className="rounded-[5px] border border-neon-gold/50 bg-neon-gold/10 p-2 text-[11px] text-neon-gold">Backend desconectado: tarefas só podem ser executadas com o servidor local ativo.</p>}
        <Field label="Título" required><input className="px-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Checklist de onboarding" data-testid="assign-title" /></Field>
        <Field label="Descrição"><textarea className="px-input h-20" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Tipo"><select className="px-input" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
        <p className="text-[10.5px] text-lab-muted">Para trabalhos com várias etapas e agentes, crie um projeto: o coordenador planeja e você aprova antes da execução.</p>
        {error && <p className="text-[11px] text-neon-pink">{error}</p>}
      </div>
    </Modal>
  )
}
