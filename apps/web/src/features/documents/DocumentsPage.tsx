import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { Artifact, Project } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform, PROJECT_STATUS } from '@/services/platform'
import { useLabStore } from '@/stores/labStore'
import { Chip, Panel, PlannedBadge } from '@/components/ui/primitives'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { fmtDate } from '@/lib/format'

const KIND: Record<string, string> = { report: 'Relatório', findings: 'Achados', analysis: 'Análise', review: 'Parecer de revisão' }

/** Documentos e Conhecimento: todos os documentos versionados produzidos pelos agentes. */
export default function DocumentsPage() {
  const agents = useLabStore((s) => s.agents)
  const [rows, setRows] = useState<{ project: Project; artifacts: Artifact[] }[]>([])
  const real = appConfig.mode === 'real'
  useEffect(() => {
    if (!real) return
    platform.projects().then(async (ps) => setRows(await Promise.all(ps.map(async (p) => ({ project: p, artifacts: await platform.artifacts(p.id).catch(() => []) })))))
      .catch(() => undefined)
  }, [real])
  if (!real) return <OfflineNotice what="Documentos e evidências" />
  const total = rows.reduce((s, r) => s + r.artifacts.length, 0)
  return (
    <div className="flex flex-col gap-2.5" data-testid="documents-page">
      <div className="px-panel c-purple flex items-center gap-3 px-3 py-2">
        <FileText size={30} className="text-neon-purple" />
        <div><h1 className="title-pixel text-[15px]">Documentos e Conhecimento</h1><p className="text-[12px] text-lab-muted">{total} documentos versionados produzidos pelos agentes, agrupados por projeto.</p></div>
      </div>
      {rows.filter((r) => r.artifacts.length).map(({ project, artifacts }) => (
        <Panel key={project.id} accent="cyan" title={<span className="flex items-center gap-2">{project.title}<Chip color={PROJECT_STATUS[project.status]?.color}>{PROJECT_STATUS[project.status]?.label}</Chip></span>} actions={<Link to={`/projetos/${project.id}`} className="text-[11px] font-bold text-neon-cyan">Abrir projeto →</Link>}>
          <ul className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {artifacts.map((a) => (
              <li key={a.id} className="px-inset px-2.5 py-2 text-[11.5px]">
                <b className="block truncate">{a.title}</b>
                <span className="text-[10.5px] text-lab-muted">{KIND[a.kind] ?? a.kind} · v{a.currentVersion} · {agents.find((x) => x.id === a.agentId)?.name ?? '—'} · {fmtDate(a.versions[a.versions.length - 1]?.createdAt ?? a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      {total === 0 && <Panel title="Documentos"><p className="text-[12px] text-lab-muted">Nenhum documento ainda. Crie um projeto para que a equipe produza entregas.</p></Panel>}
      <Panel accent="gold" title={<span className="flex items-center gap-2">Bases de conhecimento (RAG) <PlannedBadge /></span>}>
        <p className="text-[12px] text-lab-muted">Upload de documentos próprios, embeddings (pgvector) e recuperação semântica estão planejados. Hoje as fontes externas vêm de OpenAlex e arXiv, registradas como evidências em cada projeto.</p>
      </Panel>
    </div>
  )
}
