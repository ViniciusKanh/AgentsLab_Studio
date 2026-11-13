import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FolderKanban, Plus, Send } from 'lucide-react'
import type { Project } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform, PROJECT_STATUS } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { Chip, Field, Panel, ProgressBar } from '@/components/ui/primitives'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtCost, timeAgo } from '@/lib/format'

const EXAMPLE = 'Quero uma pesquisa sobre aplicações de inteligência artificial na aeronáutica, com foco em manutenção preditiva, inspeção visual e segurança operacional. Entregue um relatório técnico com tabela comparativa, limitações e referências verificáveis.'

/** Projetos: criados por prompt em linguagem natural e planejados pelo coordenador da organização. */
export default function ProjectsPage() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const orgs = useLabStore((s) => s.organizations)
  const toast = useUiStore((s) => s.toast)
  const [projects, setProjects] = useState<Project[]>([])
  const [creating, setCreating] = useState(params.get('novo') === '1')
  const [orgId, setOrgId] = useState('')
  const [title, setTitle] = useState('')
  const [request, setRequest] = useState('')
  const [budget, setBudget] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const real = appConfig.mode === 'real'

  useEffect(() => {
    if (!real) return
    const load = () => platform.projects().then(setProjects).catch(() => undefined)
    void load()
    return onPlatformEvent((e) => { if (e.type === 'project.updated') void load() })
  }, [real])
  useEffect(() => { if (!orgId && orgs.length) setOrgId(orgs[0].id) }, [orgs, orgId])

  if (!real) return <OfflineNotice what="Projetos, planos e entregas" />

  const submit = async () => {
    if (request.trim().length < 15) return setError('Descreva o que você precisa (mínimo 15 caracteres).')
    setBusy(true)
    setError('')
    try {
      const p = await platform.createProject({ request: request.trim(), title: title.trim(), organizationId: orgId || null, budgetUsd: budget })
      toast('Projeto criado: o coordenador está montando o plano', 'success')
      nav(`/projetos/${p.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="projects-page">
      <div className="px-panel c-green flex flex-wrap items-center gap-3 px-3 py-2">
        <FolderKanban size={30} className="text-neon-green" />
        <div className="min-w-0 flex-1"><h1 className="title-pixel text-[15px]">Projetos</h1><p className="text-[12px] text-lab-muted">Descreva o trabalho; o coordenador propõe o plano, você aprova e a equipe executa.</p></div>
        <button className="px-btn solid" onClick={() => { setCreating(!creating); setParams({}) }} data-testid="new-project-toggle"><Plus size={14} /> Novo projeto</button>
      </div>

      {creating && (
        <Panel accent="green" title="Novo projeto">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="space-y-2.5">
              <Field label="O que você precisa?" required hint="Linguagem natural. Seja específico sobre escopo, formato e critérios.">
                <textarea className="px-input h-32" value={request} onChange={(e) => setRequest(e.target.value)} placeholder={EXAMPLE} data-testid="project-request" />
              </Field>
              <button className="text-[11px] font-bold text-neon-cyan" onClick={() => { setRequest(EXAMPLE); setTitle('IA na aeronáutica') }}>Usar exemplo: pesquisa sobre IA na aeronáutica</button>
            </div>
            <div className="space-y-2.5">
              <Field label="Organização" required>
                <select className="px-input" value={orgId} onChange={(e) => setOrgId(e.target.value)} data-testid="project-org">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </Field>
              <Field label="Título (opcional)"><input className="px-input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="Orçamento máximo (US$)" hint="A execução pausa ao atingir o limite."><input type="number" min={0.01} step={0.5} className="px-input" value={budget} onChange={(e) => setBudget(Math.max(0.01, +e.target.value))} /></Field>
              <button className="px-btn solid w-full" onClick={() => void submit()} disabled={busy} data-testid="project-submit"><Send size={14} /> {busy ? 'Enviando…' : 'Enviar ao coordenador'}</button>
              {error && <p className="text-[11px] text-neon-pink">{error}</p>}
            </div>
          </div>
        </Panel>
      )}

      <Panel accent="purple" title={`Projetos (${projects.length})`}>
        {projects.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhum projeto ainda. Clique em “Novo projeto”.</p> : (
          <ul className="space-y-1.5">
            {projects.map((p) => {
              const st = PROJECT_STATUS[p.status]
              return (
                <li key={p.id}>
                  <Link to={`/projetos/${p.id}`} className="px-inset grid grid-cols-1 items-center gap-2 px-3 py-2 hover:border-neon-green/60 md:grid-cols-[1fr_180px_150px_120px]" data-testid="project-row">
                    <span className="min-w-0"><b className="block truncate text-[12.5px]">{p.title}</b><span className="block truncate text-[10.5px] text-lab-muted">{orgs.find((o) => o.id === p.organizationId)?.name ?? '—'} · {timeAgo(p.createdAt)}</span></span>
                    <span><Chip color={st?.color}>{st?.label ?? p.status}</Chip></span>
                    <span className="text-[10.5px] text-lab-muted">{p.tasksDone}/{p.tasksTotal} tarefas<ProgressBar value={p.tasksTotal ? p.tasksDone / p.tasksTotal : 0} height={5} /></span>
                    <span className="text-right text-[11px]">{fmtCost(p.costUsd)}<span className="block text-[9.5px] text-lab-muted">de {fmtCost(p.budgetUsd)}</span></span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
