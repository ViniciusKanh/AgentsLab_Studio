import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { Panel, PlannedBadge } from '@/components/ui/primitives'
import { asset } from '@/lib/assets'

const INFO: Record<string, { title: string; phase: string; items: string[]; bg: string }> = {
  projetos: { title: 'Projetos', phase: 'Fase 2 — Infraestrutura e persistência', items: ['Agrupar agentes, workflows e bases por projeto', 'Permissões por equipe', 'Kanban e roadmap'], bg: 'projects' },
  ferramentas: { title: 'Tool Center', phase: 'Fase 4 — Execução multiagente', items: ['Catálogo de ferramentas e APIs', 'Controle de acesso por agente', 'Auditoria de chamadas'], bg: 'automation' },
  experimentos: { title: 'Experimentos', phase: 'Fase 6 — Pesquisa e otimização', items: ['Comparação de modelos e prompts', 'Benchmarks reprodutíveis', 'Relatórios estatísticos'], bg: 'arena' },
  avaliacao: { title: 'Avaliação & Métricas', phase: 'Fase 6 — Pesquisa e otimização', items: ['Métricas de qualidade (F1, ROUGE, juízes LLM)', 'Latência e custo por execução', 'Relatórios exportáveis'], bg: 'library' },
}

export default function PlannedPage({ id }: { id: keyof typeof INFO }) {
  const info = INFO[id]
  return (
    <Panel accent="purple" title={<span className="flex items-center gap-2">{info.title} <PlannedBadge /></span>} icon={<Hammer size={16} />}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <img src={asset(`environments/${info.bg}_preview.png`)} alt="" className="pixel w-full rounded-[4px] opacity-75" />
        <div className="space-y-2 text-[12px]">
          <p>Este módulo faz parte do escopo planejado e <b className="text-neon-purple">ainda não está implementado</b>.</p>
          <p className="text-lab-muted">Previsão: {info.phase}</p>
          <ul className="list-inside list-disc space-y-1 text-lab-muted">{info.items.map((i) => <li key={i}>{i}</li>)}</ul>
          <Link to="/" className="px-btn sm mt-2">Voltar ao Dashboard</Link>
        </div>
      </div>
    </Panel>
  )
}
