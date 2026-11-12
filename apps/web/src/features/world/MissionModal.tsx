import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useLabStore } from '@/stores/labStore'
import { useMissionStore } from '@/stores/missionStore'
import { Avatar, DemoTag, Field, cx } from '@/components/ui/primitives'
import { appConfig } from '@/services/config'

const TEMPLATES = [
  { title: 'Gerar relatório de insights (Q4)', description: 'Consolidar vendas, identificar tendências e produzir resumo executivo.' },
  { title: 'Indexar novos documentos', description: 'Ler PDFs recebidos e atualizar a base RAG.' },
  { title: 'Revisar código do pipeline ETL', description: 'Revisão de qualidade, testes e sugestões.' },
  { title: 'Comparar modelos no benchmark', description: 'Rodar avaliação A/B entre dois modelos e reportar métricas.' },
]

/** Criação de missão e associação de agentes (demo: executada pelo simulador local). */
export function MissionModal({ envId, preselected, onClose }: { envId: string; preselected: string[]; onClose: () => void }) {
  const agents = useLabStore((s) => s.agents)
  const create = useMissionStore((s) => s.create)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ids, setIds] = useState<string[]>(preselected)
  const [error, setError] = useState('')
  const pool = useMemo(() => agents.filter((a) => a.status === 'active').sort((a, b) => (a.environmentId === envId ? -1 : 1) - (b.environmentId === envId ? -1 : 1)), [agents, envId])

  const submit = () => {
    if (title.trim().length < 4) return setError('Dê um título com pelo menos 4 caracteres.')
    if (!ids.length) return setError('Selecione ao menos um agente.')
    const m = create({ title: title.trim(), description: description.trim(), agentIds: ids, envId })
    if (m) onClose()
  }

  return (
    <Modal open onClose={onClose} title="Nova missão" accent="green" width={620}
      footer={<><button className="px-btn ghost" style={{ ['--c' as string]: '#39d6ff' }} onClick={onClose}>Cancelar</button><button className="px-btn solid" onClick={submit} data-testid="mission-submit">Atribuir missão</button></>}>
      <div className="space-y-3">
        {appConfig.mode === 'demo' && <p className="flex items-center gap-2 text-[11px] text-neon-gold"><DemoTag /> No modo demonstrativo a execução é simulada localmente (sem LLM) e marcada como demo.</p>}
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => <button key={t.title} className="rounded-[4px] border border-lab-line px-2 py-0.5 text-[10.5px] text-lab-muted hover:border-neon-green hover:text-white" onClick={() => { setTitle(t.title); setDescription(t.description) }}>{t.title}</button>)}
        </div>
        <Field label="Título" required><input className="px-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Analisar churn de novembro" data-testid="mission-title" /></Field>
        <Field label="Descrição"><textarea className="px-input h-16" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div>
          <p className="px-label">Agentes responsáveis</p>
          <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto md:grid-cols-3">
            {pool.map((a) => {
              const on = ids.includes(a.id)
              return (
                <button key={a.id} onClick={() => setIds(on ? ids.filter((x) => x !== a.id) : [...ids, a.id])} aria-pressed={on} className={cx('flex items-center gap-2 rounded-[6px] border p-1.5 text-left', on ? 'border-neon-green bg-neon-green/10' : 'border-lab-line hover:border-white/30')}>
                  <Avatar characterId={a.appearance.characterId} size={26} />
                  <span className="min-w-0"><b className="block truncate text-[11px]">{a.name}</b><span className="text-[9.5px] text-lab-muted">{a.environmentId === 'research' ? 'Laboratório' : 'Escritório'}</span></span>
                </button>
              )
            })}
          </div>
        </div>
        {error && <p className="text-[11px] text-neon-pink">{error}</p>}
      </div>
    </Modal>
  )
}
