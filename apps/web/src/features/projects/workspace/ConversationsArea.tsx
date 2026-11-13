import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { MESSAGE_TYPE } from '@/services/platform'
import { Chip, Panel, cx } from '@/components/ui/primitives'
import { fmtClock } from '@/lib/format'
import { Empty, useAgentName, useTeam, type Nav, type WorkspaceData } from './shared'

/** Conversas reais entre agentes e gestor, com filtros por participante, tarefa e tipo. */
export function ConversationsArea({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, messages, artifacts } = data
  const name = useAgentName()
  const team = useTeam(project)
  const tasks = project.tasks ?? []
  const [who, setWho] = useState('')
  const [task, setTask] = useState('')
  const [type, setType] = useState('')
  const participants = useMemo(() => {
    const ids = new Set<string>()
    for (const m of messages) { if (m.fromAgentId) ids.add(m.fromAgentId); if (m.toAgentId) ids.add(m.toAgentId) }
    return team.filter((a) => ids.has(a.id))
  }, [messages, team])
  const types = [...new Set(messages.map((m) => m.type))]
  const list = messages.filter((m) =>
    (!who || (who === 'user' ? m.fromKind === 'user' || m.toKind === 'user' : m.fromAgentId === who || m.toAgentId === who)) &&
    (!task || m.taskId === task) && (!type || m.type === type))
  const code = (id: string) => artifacts.find((a) => a.id === id)
  return (
    <Panel accent="cyan" title={`Conversas (${list.length} de ${messages.length})`} bodyClassName="space-y-3">
      <div className="flex flex-wrap gap-2 text-[13px]">
        <label className="flex items-center gap-1.5">Participante
          <select className="px-input w-auto py-1" value={who} onChange={(e) => setWho(e.target.value)} data-testid="filter-participant">
            <option value="">Todos</option><option value="user">Gestor (você)</option>
            {participants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">Tarefa
          <select className="px-input w-auto py-1" value={task} onChange={(e) => setTask(e.target.value)} data-testid="filter-task">
            <option value="">Todas</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.key} — {t.title.slice(0, 40)}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1">
          <button className={cx('px-chip', !type && 'brightness-150')} onClick={() => setType('')}>todos os tipos</button>
          {types.map((t) => <button key={t} onClick={() => setType(type === t ? '' : t)} className={cx('px-chip', type === t && 'ring-1 ring-white')} style={{ ['--c' as string]: MESSAGE_TYPE[t]?.color }}>{MESSAGE_TYPE[t]?.label ?? t}</button>)}
        </div>
      </div>
      {list.length === 0 ? <Empty>Nenhuma mensagem com esses filtros.</Empty> : (
        <ol className="max-h-[640px] space-y-2 overflow-auto pr-1" data-testid="message-timeline">
          {list.map((m) => {
            const t = MESSAGE_TYPE[m.type]
            const tk = tasks.find((x) => x.id === m.taskId)
            const mine = m.fromKind === 'user'
            return (
              <li key={m.id} className={cx('rounded-[8px] p-3 text-[13.5px]', mine ? 'ml-8 bg-neon-purple/10' : 'mr-8 bg-white/[0.04]', m.needsDecision && m.status === 'pending' && 'ring-1 ring-neon-gold')}>
                <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px] text-lab-muted">
                  <Chip color={t?.color}>{t?.label ?? m.type}</Chip>
                  <b className="text-lab-text">{name(m.fromAgentId, m.fromKind)}</b> → {m.toKind === 'user' ? 'Gestor (você)' : m.toAgentId ? name(m.toAgentId) : 'equipe'}
                  <span>· {fmtClock(m.createdAt)}</span>
                  {tk && <button className="font-mono text-neon-cyan hover:underline" onClick={() => nav.go('execucao', { taskId: tk.id })}>{tk.key}</button>}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.artifactIds.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                    {m.artifactIds.map((id) => { const a = code(id); return a ? <button key={id} className="inline-flex items-center gap-1 text-neon-green hover:underline" onClick={() => nav.go('documentos', { artifactId: id })}><FileText size={12} /> {a.code} {a.title}</button> : null })}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
