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

const EXAMPLE = 'quero entender como a inteligência artificial ajuda na manutenção de aviões, tipo prever falha de motor e inspecionar a fuselagem. queria algo completo pra usar no meu mestrado'

const TYPES: { id: string; label: string; hint: string }[] = [
  { id: '', label: 'Automático', hint: 'O coordenador escolhe o formato a partir do pedido' },
  { id: 'pesquisa', label: 'Estudo de pesquisa', hint: '~5 mil palavras' },
  { id: 'monografia', label: 'Monografia', hint: '~9 mil palavras' },
  { id: 'tese', label: 'Tese / dissertação', hint: '~14 mil palavras (texto-base)' },
  { id: 'estudo_de_caso', label: 'Estudo de caso', hint: '~6 mil palavras' },
  { id: 'artigo', label: 'Artigo científico', hint: '~6 mil palavras' },
  { id: 'revisao_literatura', label: 'Revisão da literatura', hint: '~7 mil palavras' },
  { id: 'relatorio_tecnico', label: 'Relatório técnico', hint: '~4 mil palavras' },
]
const LENGTHS = [{ id: 'padrao', label: 'Padrão' }, { id: 'extensa', label: 'Extensa (~1,5×)' }, { id: 'maxima', label: 'Máxima (~2×)' }]

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
  const [kind, setKind] = useState('')
  const [length, setLength] = useState('padrao')
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
      const p = await platform.createProject({ request: request.trim(), title: title.trim(), organizationId: orgId || null, budgetUsd: budget, deliverableType: kind, length })
      toast('Projeto criado: o coordenador está interpretando o pedido e montando o plano', 'success')
      nav(`/projetos/${p.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 text-[13.5px]" data-testid="projects-page">
      <div className="px-panel c-green flex flex-wrap items-center gap-4 px-4 py-3">
        <FolderKanban size={30} className="text-neon-green" />
        <div className="min-w-0 flex-1"><h1 className="title-pixel text-[16px]">Projetos</h1><p className="mt-1 text-[13.5px] text-lab-muted">Descreva o trabalho; o coordenador propõe o plano, você aprova e a equipe executa.</p></div>
        <button className="px-btn solid" onClick={() => { setCreating(!creating); setParams({}) }} data-testid="new-project-toggle"><Plus size={14} /> Novo projeto</button>
      </div>

      {creating && (
        <Panel accent="green" title="Novo projeto">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="space-y-2.5">
              <Field label="O que você precisa?" required hint="Escreva do seu jeito, em linguagem simples. O coordenador transforma o pedido em uma especificação acadêmica (tipo de entrega, pergunta de pesquisa, objetivos e estrutura de seções), define o papel de cada agente e estima o tempo — você revisa tudo antes de aprovar.">
                <textarea className="px-input h-36 text-[14px] leading-relaxed" value={request} onChange={(e) => setRequest(e.target.value)} placeholder={EXAMPLE} data-testid="project-request" />
              </Field>
              <button className="text-[12.5px] font-bold text-neon-cyan" onClick={() => setRequest(EXAMPLE)}>Usar exemplo de pedido leigo</button>
            </div>
            <div className="space-y-2.5">
              <Field label="Organização" required>
                <select className="px-input" value={orgId} onChange={(e) => setOrgId(e.target.value)} data-testid="project-org">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </Field>
              <Field label="Tipo de entrega">
                <select className="px-input" value={kind} onChange={(e) => setKind(e.target.value)} data-testid="project-type">{TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                <span className="mt-1 block text-[12px] text-lab-muted">{TYPES.find((t) => t.id === kind)?.hint}</span>
              </Field>
              <Field label="Extensão do documento">
                <select className="px-input" value={length} onChange={(e) => setLength(e.target.value)} data-testid="project-length">{LENGTHS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              </Field>
              <Field label="Título (opcional — gerado pelo coordenador se vazio)"><input className="px-input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="Orçamento máximo (US$)" hint="A execução pausa ao atingir o limite."><input type="number" min={0.01} step={0.5} className="px-input" value={budget} onChange={(e) => setBudget(Math.max(0.01, +e.target.value))} /></Field>
              <button className="px-btn solid w-full" onClick={() => void submit()} disabled={busy} data-testid="project-submit"><Send size={14} /> {busy ? 'Enviando…' : 'Enviar ao coordenador'}</button>
              {error && <p className="text-[12.5px] text-neon-pink">{error}</p>}
            </div>
          </div>
        </Panel>
      )}

      <Panel accent="purple" title={`Projetos (${projects.length})`}>
        {projects.length === 0 ? <p className="py-4 text-[13.5px] text-lab-muted">Nenhum projeto ainda. Clique em “Novo projeto”.</p> : (
          <ul className="space-y-2">
            {projects.map((p) => {
              const st = PROJECT_STATUS[p.status]
              return (
                <li key={p.id}>
                  <Link to={`/projetos/${p.id}`} className="px-inset grid grid-cols-1 items-center gap-3 px-4 py-3 hover:border-neon-green/60 md:grid-cols-[1fr_200px_170px_140px]" data-testid="project-row">
                    <span className="min-w-0"><b className="block truncate text-[15px]">{p.title}</b><span className="mt-0.5 block truncate text-[12.5px] text-lab-muted">{orgs.find((o) => o.id === p.organizationId)?.name ?? '—'} · {timeAgo(p.createdAt)}</span></span>
                    <span><Chip color={st?.color}>{st?.label ?? p.status}</Chip></span>
                    <span className="space-y-1 text-[12.5px] text-lab-muted"><span className="block">{p.tasksDone}/{p.tasksTotal} tarefas</span><ProgressBar value={p.tasksTotal ? p.tasksDone / p.tasksTotal : 0} height={6} /></span>
                    <span className="text-right text-[13.5px] font-bold">{fmtCost(p.costUsd)}<span className="block text-[12px] font-normal text-lab-muted">de {fmtCost(p.budgetUsd)}</span></span>
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
