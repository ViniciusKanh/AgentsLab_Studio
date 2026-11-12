import { Database, FileUp } from 'lucide-react'
import { dataSource } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { useLabStore } from '@/stores/labStore'
import { Avatar, Chip, DemoTag, Panel, PlannedBadge } from '@/components/ui/primitives'
import { fmtInt, timeAgo } from '@/lib/format'

export default function KnowledgePage() {
  const { data } = useAsync(() => dataSource.listKnowledgeBases(), [])
  const agents = useLabStore((s) => s.agents)
  return (
    <div className="flex flex-col gap-2.5" data-testid="knowledge-page">
      <div className="px-panel c-gold flex flex-wrap items-center gap-3 px-3 py-2">
        <Database size={30} className="text-neon-gold" />
        <div>
          <h1 className="title-pixel text-[15px]">Conhecimento (RAG)</h1>
          <p className="text-[12px] text-lab-muted">Bases de documentos, embeddings e fontes utilizadas pelos agentes.</p>
        </div>
        <button className="px-btn ml-auto" style={{ ['--c' as string]: '#ffb800' }} disabled title="Upload e indexação reais dependem do backend (Fase 4)"><FileUp size={14} /> Importar documentos</button>
        <PlannedBadge />
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {(data ?? []).map((kb) => {
          const users = agents.filter((a) => a.knowledge.ragBaseId === kb.id)
          return (
            <Panel key={kb.id} accent={kb.status === 'planejado' ? 'purple' : 'gold'} title={kb.name} demo={kb.origin === 'demo'}>
              <dl className="grid grid-cols-2 gap-y-1 text-[11.5px]">
                <dt className="text-lab-muted">Tipo</dt><dd>{kb.kind}</dd>
                <dt className="text-lab-muted">Documentos</dt><dd>{fmtInt(kb.documents)}</dd>
                <dt className="text-lab-muted">Chunks</dt><dd>{fmtInt(kb.chunks)}</dd>
                <dt className="text-lab-muted">Embeddings</dt><dd className="truncate">{kb.embeddingModel}</dd>
                <dt className="text-lab-muted">Atualizado</dt><dd>{timeAgo(kb.updatedAt)}</dd>
              </dl>
              <div className="mt-2 flex items-center gap-2">
                <Chip color={kb.status === 'indexado' ? '#00f5a0' : kb.status === 'indexando' ? '#39d6ff' : '#9d62ff'}>{kb.status}</Chip>
                <span className="ml-auto flex -space-x-1">{users.map((u) => <Avatar key={u.id} characterId={u.appearance.characterId} size={22} title={u.name} />)}</span>
              </div>
            </Panel>
          )
        })}
      </div>
      <Panel accent="cyan" title="Pipeline RAG previsto">
        <p className="text-[11.5px] leading-relaxed text-lab-muted">Upload → extração de texto → chunking → embeddings (pgvector) → recuperação semântica → geração com citações. Todos os números acima são <DemoTag /> até a integração com o backend.</p>
      </Panel>
    </div>
  )
}
