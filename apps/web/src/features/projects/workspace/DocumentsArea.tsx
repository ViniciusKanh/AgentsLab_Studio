import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, GitCompare } from 'lucide-react'
import type { ArtifactContent, Evidence } from '@/types/platform'
import { platform, VERIFICATION } from '@/services/platform'
import { useUiStore } from '@/stores/uiStore'
import { Chip, Panel, Tabs, cx } from '@/components/ui/primitives'
import { Markdown } from '@/components/ui/Markdown'
import { fmtDate } from '@/lib/format'
import { DOC_KIND, Empty, useAgentName, type Nav, type WorkspaceData } from './shared'

const GROUPS: { id: 'final' | 'parcial' | 'revisao'; label: string }[] = [
  { id: 'final', label: 'Relatórios consolidados' },
  { id: 'parcial', label: 'Resultados parciais' },
  { id: 'revisao', label: 'Pareceres de revisão' },
]

/** Documentos versionados (com identificação) e evidências com verificação independente. */
export function DocumentsArea({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const [sub, setSub] = useState<'docs' | 'evidencias'>('docs')
  const unconfirmed = data.evidence.filter((e) => e.verification && e.verification !== 'verificada').length
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={sub} onChange={setSub} items={[
        { id: 'docs', label: `Documentos (${data.artifacts.length})` },
        { id: 'evidencias', label: `Evidências (${data.evidence.length}${unconfirmed ? ` · ${unconfirmed} não confirmadas` : ''})` },
      ]} />
      {sub === 'docs' ? <DocumentBrowser data={data} nav={nav} /> : <EvidenceTable evidence={data.evidence} />}
    </div>
  )
}

function DocumentBrowser({ data, nav }: { data: WorkspaceData; nav: Nav }) {
  const { project, artifacts } = data
  const name = useAgentName()
  const toast = useUiStore((s) => s.toast)
  const art = artifacts.find((a) => a.id === nav.focus.artifactId) ?? artifacts.find((a) => a.kind === 'report') ?? artifacts[0]
  const [version, setVersion] = useState<number | null>(null)
  const [content, setContent] = useState<ArtifactContent | null>(null)
  const [cmp, setCmp] = useState<{ a: number; b: number; diff: string } | null>(null)
  const v = version ?? art?.currentVersion
  useEffect(() => { setVersion(null); setCmp(null) }, [art?.id])
  useEffect(() => {
    if (!art) return
    platform.artifact(project.id, art.id, v).then(setContent).catch(() => setContent(null))
  }, [project.id, art, v])
  const grouped = useMemo(() => GROUPS.map((g) => ({ ...g, items: artifacts.filter((a) => (DOC_KIND[a.kind]?.group ?? 'parcial') === g.id) })), [artifacts])
  if (!art) return <Empty>Nenhum documento produzido ainda. Os agentes registram aqui cada entrega parcial e o relatório final.</Empty>
  const meta = content?.metadata ?? art.metadata
  const compare = async (a: number, b: number) => setCmp({ a, b, diff: (await platform.diff(project.id, art.id, a, b)).diff })
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Panel accent="purple" title="Documentos do projeto" bodyClassName="space-y-3">
        {grouped.filter((g) => g.items.length).map((g) => (
          <div key={g.id}>
            <p className="px-label">{g.label}</p>
            <ul className="space-y-1">
              {g.items.map((a) => (
                <li key={a.id}>
                  <button className={cx('w-full rounded-[6px] px-2.5 py-2 text-left text-[13px]', a.id === art.id ? 'bg-neon-purple/20 ring-1 ring-neon-purple/60' : 'hover:bg-white/5')} onClick={() => nav.go('documentos', { artifactId: a.id })}>
                    <span className="flex items-center gap-1.5 font-bold"><FileText size={14} /><span className="font-mono text-neon-cyan">{a.code}</span> <span className="truncate">{a.title}</span></span>
                    <span className="block text-[12px] text-lab-muted">{name(a.agentId)} · v{a.currentVersion} · {fmtDate(a.updatedAt ?? a.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Panel>
      <Panel accent="cyan" title={`${art.code ?? ''} ${art.title}`} actions={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select className="px-input w-auto py-1 text-[12px]" value={v} onChange={(e) => { setVersion(+e.target.value); setCmp(null) }} aria-label="Versão">
            {art.versions.map((x) => <option key={x.version} value={x.version}>v{x.version} · {fmtDate(x.createdAt)}</option>)}
          </select>
          {art.currentVersion > 1 && <button className="px-btn sm ghost" disabled={(v ?? 1) < 2} onClick={() => void compare(Math.max(1, (v ?? 2) - 1), v ?? 2)} title="Comparar com a versão anterior"><GitCompare size={13} /> Diff</button>}
          <button className="px-btn sm" onClick={() => void platform.download(project.id, art.id, v).catch((e: Error) => toast(e.message, 'error'))}><Download size={13} /> .md</button>
        </div>
      }>
        {meta && (
          <dl className="mb-3 grid gap-x-4 gap-y-1 rounded-[6px] bg-white/[0.04] p-3 text-[12.5px] sm:grid-cols-2 xl:grid-cols-4" data-testid="document-meta">
            {([['Identificação', `${meta.code} · ${meta.type}`], ['Autoria', `${meta.author}${meta.authorRole ? ` (${meta.authorRole})` : ''}`], ['Versão', `v${meta.version}${meta.lastEditor !== meta.author ? ` · editada por ${meta.lastEditor}` : ''}`], ['Data', fmtDate(meta.date)],
              ['Projeto', meta.project], ['Tarefa de origem', meta.originTask]] as const).map(([k, val]) => (
              <div key={k} className={k === 'Tarefa de origem' || k === 'Projeto' ? 'xl:col-span-2' : ''}><dt className="text-[11px] font-bold uppercase tracking-wide text-lab-muted">{k}</dt><dd>{k === 'Tarefa de origem' && meta.originTaskId ? <button className="text-neon-cyan hover:underline" onClick={() => nav.go('execucao', { taskId: meta.originTaskId! })}>{val}</button> : val}</dd></div>
            ))}
          </dl>
        )}
        {content?.note && <p className="mb-2 text-[12.5px] text-lab-muted">Nota da versão: {content.note}</p>}
        {art.versions.length > 1 && (
          <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-lab-muted">Histórico:
            {art.versions.map((x) => <button key={x.version} className={cx('px-chip', x.version === v && 'ring-1 ring-white')} onClick={() => { setVersion(x.version); setCmp(null) }} title={x.note}>v{x.version} · {name(x.agentId)}</button>)}
          </p>
        )}
        {cmp ? (
          <div data-testid="diff-view">
            <p className="mb-1 flex items-center gap-2 text-[12.5px]">Diferenças v{cmp.a} → v{cmp.b} <button className="text-neon-cyan hover:underline" onClick={() => setCmp(null)}>fechar</button></p>
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-[6px] bg-[#050913] p-3 font-mono text-[12.5px] leading-relaxed">
              {cmp.diff.split('\n').map((l, i) => <span key={i} className={l.startsWith('+') ? 'text-neon-green' : l.startsWith('-') ? 'text-neon-pink' : 'text-lab-muted'}>{l}{'\n'}</span>)}
            </pre>
          </div>
        ) : content ? <div className="max-h-[680px] overflow-auto pr-2" data-testid="document-view"><Markdown source={content.content} size="lg" /></div> : null}
      </Panel>
    </div>
  )
}

export function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  const name = useAgentName()
  return (
    <Panel accent="green" title="Evidências (fontes reais consultadas pelas ferramentas)">
      {evidence.length === 0 ? <Empty>Nenhuma fonte registrada.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="evidence-table">
            <thead className="text-left text-[11.5px] uppercase tracking-wide text-lab-muted"><tr><th className="pb-2">Código</th><th>Título</th><th>Autores / ano</th><th>Fonte</th><th>Verificação</th><th>Acesso</th><th>Registrado por</th></tr></thead>
            <tbody>
              {evidence.map((e) => {
                const ver = VERIFICATION[e.verification ?? 'pendente']
                return (
                  <tr key={e.id} className="border-t border-white/5 align-top">
                    <td className="py-2 font-mono font-bold text-neon-cyan">{e.code}</td>
                    <td className="max-w-[420px] pr-2"><a href={e.doi ? `https://doi.org/${e.doi}` : e.url} target="_blank" rel="noreferrer noopener" className="hover:text-neon-cyan hover:underline">{e.title}</a>
                      {e.abstract && <details><summary className="cursor-pointer text-[12px] text-lab-muted">resumo</summary><p className="text-[12.5px] text-lab-muted">{e.abstract}</p></details>}</td>
                    <td className="pr-2 text-lab-muted">{e.authors.split(',').slice(0, 3).join(',')}{e.authors.split(',').length > 3 ? ' et al.' : ''} ({e.year ?? 's.d.'})</td>
                    <td className="pr-2">{e.source}{e.doi && <span className="block font-mono text-[11.5px] text-lab-muted">doi:{e.doi}</span>}</td>
                    <td className="pr-2"><Chip color={ver.color} title={e.verificationNote}>{ver.label}</Chip>{e.verificationNote && <span className="block max-w-[220px] text-[11.5px] text-lab-muted">{e.verificationNote}</span>}</td>
                    <td>{e.fullText ? <Chip color="#00f5a0">texto completo</Chip> : <Chip color="#ffb800">apenas resumo</Chip>}</td>
                    <td className="text-lab-muted">{name(e.agentId)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-lab-muted">As referências dos relatórios são geradas pelo sistema a partir destas evidências. “Verificada” = DOI/arXiv confirmado em base independente (Crossref/arXiv); fontes não confirmadas aparecem marcadas no relatório e são apontadas pelo revisor. Citações a códigos inexistentes são sinalizadas.</p>
    </Panel>
  )
}

