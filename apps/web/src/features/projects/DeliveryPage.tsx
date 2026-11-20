import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, FileText, MessageSquareWarning, Printer } from 'lucide-react'
import type { Artifact, ArtifactContent, Project } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform, PROJECT_STATUS } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'
import { useUiStore } from '@/stores/uiStore'
import { Chip, Panel, cx } from '@/components/ui/primitives'
import { Markdown, extractHeadings } from '@/components/ui/Markdown'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtDate } from '@/lib/format'
import { DOC_KIND, useAgentName } from './workspace/shared'

const PRINT_CSS = `
@page { size: A4; margin: 2.5cm 2cm 2cm 3cm; }
body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #111; }
h1 { font-size: 18pt; text-align: center; margin: 0 0 18pt; }
h2 { font-size: 14pt; margin: 20pt 0 8pt; page-break-after: avoid; border-bottom: 1px solid #999; padding-bottom: 3pt; }
h3 { font-size: 12.5pt; margin: 14pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 12pt; font-style: italic; }
p { text-align: justify; margin: 0 0 8pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 8pt 18pt; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt; page-break-inside: avoid; }
th, td { border: 1px solid #888; padding: 4pt 6pt; vertical-align: top; }
th { background: #eee; }
blockquote { margin: 8pt 0 8pt 24pt; font-size: 11pt; color: #333; }
pre { font-size: 9pt; background: #f4f4f4; padding: 6pt; white-space: pre-wrap; }
a { color: #0645ad; word-break: break-all; }
.md-cite { font-weight: bold; } .md-pending { background: #ffe9a8; }
hr { border: 0; border-top: 1px solid #aaa; }
.rodape { margin-top: 24pt; font-size: 9pt; color: #555; border-top: 1px solid #ccc; padding-top: 6pt; }
`

/** Abre a caixa de impressão do navegador com o documento formatado em A4 (opção “Salvar como PDF”). */
function exportPdf(title: string, html: string, footer: string) {
  const frame = document.createElement('iframe')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>${PRINT_CSS}</style></head><body>${html}<p class="rodape">${footer.replace(/</g, '&lt;')}</p></body></html>`)
  doc.close()
  setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1500)
  }, 250)
}

/** Tela de entrega: leitura do documento final (sumário navegável), parecer do revisor, versões e exportação .md/PDF. */
export default function DeliveryPage() {
  const { projectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const toast = useUiStore((s) => s.toast)
  const name = useAgentName()
  const [project, setProject] = useState<Project | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [content, setContent] = useState<ArtifactContent | null>(null)
  const [review, setReview] = useState<string>('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)
  const real = appConfig.mode === 'real'

  const load = async () => {
    const [p, a] = await Promise.all([platform.project(projectId), platform.artifacts(projectId)])
    setProject(p)
    setArtifacts(a)
  }
  useEffect(() => {
    if (!real) return
    void load().catch(() => undefined)
    return onPlatformEvent((e) => { if (e.projectId === projectId && (e.type === 'artifact.version' || e.type === 'project.updated')) void load().catch(() => undefined) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, projectId])

  const art = artifacts.find((a) => a.id === params.get('doc')) ?? artifacts.find((a) => a.kind === 'report') ?? artifacts[0]
  const version = Number(params.get('v')) || art?.currentVersion
  const reviewArt = [...artifacts].reverse().find((a) => a.kind === 'review')
  useEffect(() => {
    if (!art) return
    platform.artifact(projectId, art.id, version).then(setContent).catch(() => setContent(null))
  }, [projectId, art?.id, version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reviewArt) return
    platform.artifact(projectId, reviewArt.id).then((c) => setReview(c.content)).catch(() => setReview(''))
  }, [projectId, reviewArt?.id, reviewArt?.currentVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const headings = useMemo(() => extractHeadings(content?.content ?? '').filter((h) => h.level === 2 || h.level === 3), [content])
  const words = useMemo(() => (content?.content.match(/[\p{L}\p{N}]+/gu) ?? []).length, [content])

  if (!real) return <OfflineNotice what="Entregas dos projetos" />
  if (!project) return <p className="title-pixel animate-blink p-6 text-[10px] text-lab-muted">Carregando…</p>
  const st = PROJECT_STATUS[project.status]
  const b = project.plan?.briefing
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }
  const decide = async (approve: boolean) => {
    if (!approve && feedback.trim().length < 3) return toast('Escreva o que deve ser ajustado.', 'error')
    setBusy(true)
    try {
      if (approve) await platform.decideDelivery(project.id, true)
      else await platform.feedback(project.id, { artifactId: art!.id }, feedback.trim())
      toast(approve ? 'Entrega aprovada' : 'Feedback enviado — o responsável vai gerar uma nova versão e o revisor reavalia', 'success')
      setFeedback('')
      await load()
    } catch (err) { toast((err as Error).message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-3 text-[13.5px]" data-testid="delivery-page">
      <header className="px-panel c-green flex flex-wrap items-center gap-3 px-4 py-3">
        <Link to={`/projetos/${project.id}`} className="text-lab-muted hover:text-white" aria-label="Voltar ao projeto"><ArrowLeft size={20} /></Link>
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[18px] font-extrabold leading-tight">{project.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-lab-muted">
            {b && <Chip color="#00f5a0">{b.tipo_nome}</Chip>}<Chip color={st?.color}>{st?.label}</Chip>
            {art && <span>{art.code} · v{version} de {art.currentVersion} · ~{words.toLocaleString('pt-BR')} palavras · leitura ~{Math.max(1, Math.round(words / 230))} min</span>}
          </p>
        </div>
        {art && (
          <div className="flex flex-wrap items-center gap-1.5">
            <select className="px-input w-auto py-1 text-[12px]" value={version} onChange={(e) => set('v', e.target.value)} aria-label="Versão">
              {art.versions.map((x) => <option key={x.version} value={x.version}>v{x.version} · {fmtDate(x.createdAt)}</option>)}
            </select>
            <button className="px-btn sm" onClick={() => void platform.download(project.id, art.id, version).catch((e: Error) => toast(e.message, 'error'))} data-testid="delivery-md"><Download size={13} /> Markdown</button>
            <button className="px-btn sm solid" disabled={!content} onClick={() => paperRef.current && exportPdf(project.title, paperRef.current.innerHTML,
              `AgentsLab_Studio · ${art.code} v${version} · ${fmtDate(content?.createdAt ?? art.createdAt)} · produzido por agentes de IA — revise antes de usar`)} data-testid="delivery-pdf"><Printer size={13} /> PDF</button>
          </div>
        )}
      </header>

      {!art ? <Panel title="Entrega"><p className="py-6 text-center text-lab-muted">Ainda não há documentos. A entrega aparece aqui assim que o redator concluir a primeira versão.</p></Panel> : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
          <aside className="flex flex-col gap-3 xl:sticky xl:top-2 xl:max-h-[calc(100vh-110px)] xl:self-start xl:overflow-auto">
            <Panel accent="cyan" title="Sumário" bodyClassName="text-[12.5px]">
              {headings.length === 0 ? <p className="text-lab-muted">—</p> : (
                <nav className="space-y-0.5">
                  {headings.map((h) => (
                    <a key={h.id + h.text} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }) }}
                      className={cx('block truncate rounded px-1.5 py-0.5 hover:bg-white/5 hover:text-neon-cyan', h.level === 3 && 'pl-4 text-lab-muted')} title={h.text}>{h.text}</a>
                  ))}
                </nav>
              )}
            </Panel>
            <Panel accent="purple" title="Documentos" bodyClassName="space-y-1 text-[12.5px]">
              {artifacts.map((a) => (
                <button key={a.id} onClick={() => setParams({ doc: a.id }, { replace: true })} className={cx('w-full rounded px-2 py-1 text-left', a.id === art.id ? 'bg-neon-purple/20 ring-1 ring-neon-purple/60' : 'hover:bg-white/5')}>
                  <span className="flex items-center gap-1"><FileText size={12} /><span className="font-mono text-neon-cyan">{a.code}</span> <span className="truncate">{a.title}</span></span>
                  <span className="block text-[11.5px] text-lab-muted">{DOC_KIND[a.kind]?.label ?? a.kind} · {name(a.agentId)} · v{a.currentVersion}</span>
                </button>
              ))}
            </Panel>
          </aside>

          <main className="min-w-0">
            {content ? <div ref={paperRef}><Markdown source={content.content} size="lg" variant="paper" /></div> : <p className="p-6 text-lab-muted">Carregando documento…</p>}
          </main>

          <aside className="flex flex-col gap-3">
            {project.status === 'delivered' && art.kind === 'report' && (
              <Panel accent="gold" title="Sua decisão" bodyClassName="space-y-2 text-[12.5px]">
                <p className="text-lab-muted">Aprove a entrega ou descreva o que mudar: o autor gera uma nova versão (as anteriores ficam no histórico) e o revisor reavalia.</p>
                <textarea className="px-input h-24 text-[13px]" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Ex.: aprofunde a seção de metodologia e inclua mais estudos de 2023+" />
                <div className="flex gap-1.5">
                  <button className="px-btn sm flex-1" style={{ ['--c' as string]: '#ff537a' }} disabled={busy} onClick={() => void decide(false)}><MessageSquareWarning size={13} /> Pedir ajustes</button>
                  <button className="px-btn sm solid flex-1" disabled={busy} onClick={() => void decide(true)} data-testid="delivery-approve"><Check size={13} /> Aprovar</button>
                </div>
              </Panel>
            )}
            {review && (
              <Panel accent="purple" title="Parecer do revisor" bodyClassName="max-h-[70vh] overflow-auto">
                <Markdown source={review} />
              </Panel>
            )}
            {content?.note && <p className="px-1 text-[11.5px] text-lab-muted">Nota da versão: {content.note}</p>}
          </aside>
        </div>
      )}
    </div>
  )
}
