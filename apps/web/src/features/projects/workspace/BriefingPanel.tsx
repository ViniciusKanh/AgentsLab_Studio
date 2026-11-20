import { Clock, FileText, ListTree, Users } from 'lucide-react'
import type { Project } from '@/types/platform'
import { TASK_KIND } from '@/services/platform'
import { Chip, Panel } from '@/components/ui/primitives'
import { useAgentName } from './shared'

const LENGTH: Record<string, string> = { padrao: 'padrão', extensa: 'extensa', maxima: 'máxima' }

/** Engenharia do pedido: como o coordenador interpretou o texto leigo, a estrutura do documento, os papéis e o tempo estimado. */
export function BriefingPanel({ project, compact = false }: { project: Project; compact?: boolean }) {
  const plan = project.plan ?? {}
  const b = plan.briefing
  const name = useAgentName()
  if (!b) return null
  const est = plan.estimativa_tempo_min
  const words = (plan.estrutura ?? []).reduce((s, x) => s + x.palavras, 0)
  const roles = (plan.papeis ?? []).filter((r) => r.papel)
  return (
    <Panel accent="green" title="Pedido interpretado pelo coordenador" data-testid="briefing" bodyClassName="space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Chip color="#00f5a0"><FileText size={12} className="mr-1 inline" />{b.tipo_nome}</Chip>
        <Chip color="#39d6ff">~{words.toLocaleString('pt-BR')} palavras · {plan.estrutura?.length ?? 0} seções · extensão {LENGTH[b.extensao] ?? b.extensao}</Chip>
        {est && <Chip color="#ffb800" title={est.base}><Clock size={12} className="mr-1 inline" />{est.min}–{est.max} min (estimativa)</Chip>}
        {plan.estimativa_custo_usd !== undefined && <Chip color="#9d62ff">custo estimado ~US$ {plan.estimativa_custo_usd.toFixed(2)}</Chip>}
      </div>
      {b.pedido_tecnico && <p><b>Pedido técnico:</b> {b.pedido_tecnico}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {b.pergunta_pesquisa && <p><b>Pergunta de pesquisa:</b> {b.pergunta_pesquisa}</p>}
        {b.objetivo_geral && <p><b>Objetivo geral:</b> {b.objetivo_geral}</p>}
      </div>
      {!!b.objetivos_especificos?.length && (
        <div><b>Objetivos específicos:</b><ul className="mt-1 list-disc space-y-0.5 pl-5">{b.objetivos_especificos.map((o) => <li key={o}>{o}</li>)}</ul></div>
      )}
      {!compact && !!plan.estrutura?.length && (
        <div>
          <p className="px-label flex items-center gap-1.5"><ListTree size={13} /> Estrutura da entrega (cada seção é escrita e revisada separadamente)</p>
          <ol className="grid gap-1.5 md:grid-cols-2">
            {plan.estrutura.map((s, i) => (
              <li key={s.titulo} className="rounded-[5px] bg-white/[0.04] px-2.5 py-1.5">
                <span className="flex justify-between gap-2"><b>{i + 1}. {s.titulo}</b><span className="shrink-0 text-[12px] text-lab-muted">~{s.palavras} pal.</span></span>
                {s.conteudo && <span className="block text-[12px] text-lab-muted">{s.conteudo}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!compact && roles.length > 0 && (
        <div>
          <p className="px-label flex items-center gap-1.5"><Users size={13} /> Papel de cada agente</p>
          <ul className="space-y-1">
            {roles.map((r) => {
              const t = project.tasks?.find((x) => x.key === r.tarefa)
              return <li key={r.tarefa} className="text-[12.5px]"><span className="font-mono font-bold text-neon-cyan">{r.tarefa}</span> <b>{name(t?.agentId ?? r.agentId)}</b>{t ? ` · ${TASK_KIND[t.kind]}` : ''} — {r.papel}</li>
            })}
          </ul>
        </div>
      )}
      <p className="text-[11.5px] text-lab-muted">Fluxo de qualidade: especialistas produzem → redator escreve seção por seção → revisor avalia com notas e aponta problemas por seção → o redator corrige (até 2 ciclos automáticos) → você aprova ou envia feedback.</p>
    </Panel>
  )
}
