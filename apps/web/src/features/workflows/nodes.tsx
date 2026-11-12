import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Bot, CheckCircle2, GitBranch, Play, ScanEye, Wrench, FileOutput } from 'lucide-react'
import type { WorkflowNodeData, WorkflowNodeKind } from '@/types/domain'
import { useLabStore } from '@/stores/labStore'
import { Avatar, cx } from '@/components/ui/primitives'
import { TOOLS_CATALOG } from '@/services/demo/demoData'

export const NODE_META: Record<WorkflowNodeKind, { label: string; color: string; icon: typeof Bot; hint: string }> = {
  start: { label: 'Início', color: '#00f5a0', icon: Play, hint: 'Gatilho do fluxo' },
  agent: { label: 'Agente', color: '#9d62ff', icon: Bot, hint: 'Executa com um agente' },
  tool: { label: 'Ferramenta', color: '#39d6ff', icon: Wrench, hint: 'Chama uma ferramenta' },
  condition: { label: 'Condição (IF)', color: '#ffb800', icon: GitBranch, hint: 'Ramifica sim/não' },
  review: { label: 'Revisão', color: '#ff537a', icon: ScanEye, hint: 'Aprovação humana ou agente' },
  output: { label: 'Saída', color: '#00f5a0', icon: FileOutput, hint: 'Entrega/exporta' },
}

export type FlowNode = Node<WorkflowNodeData>

const RUN_RING: Record<string, string> = { running: '0 0 0 3px #39d6ff, 0 0 18px #39d6ff', done: '0 0 0 2px #00f5a0', failed: '0 0 0 3px #ff537a' }

function PixelNode({ data, selected, type }: NodeProps<FlowNode>) {
  const kind = (type ?? data.kind) as WorkflowNodeKind
  const meta = NODE_META[kind]
  const Icon = meta.icon
  const agent = useLabStore((s) => (data.agentId ? s.agents.find((a) => a.id === data.agentId) : undefined))
  const sub = kind === 'agent' || (kind === 'review' && data.reviewer === 'agente')
    ? agent?.name ?? 'selecione um agente'
    : kind === 'tool' ? TOOLS_CATALOG.find((t) => t.id === data.tool)?.name ?? 'selecione'
    : kind === 'condition' ? data.condition || 'expressão'
    : kind === 'review' ? 'Humano'
    : kind === 'output' ? data.outputFormat || 'formato'
    : 'Gatilho'
  return (
    <div
      className={cx('relative w-[140px] rounded-[6px] border-2 bg-[#0d1530] px-2 py-2 text-center transition-shadow', selected && 'brightness-125')}
      style={{ borderColor: meta.color, boxShadow: data.runState ? RUN_RING[data.runState] : `0 0 12px -4px ${meta.color}` }}
      data-testid={`node-${kind}`}
    >
      {kind !== 'start' && <Handle type="target" position={Position.Left} style={{ background: meta.color }} />}
      <div className="flex items-center justify-center gap-1.5">
        {agent && (kind === 'agent' || kind === 'review') ? <Avatar characterId={agent.appearance.characterId} size={26} ring={meta.color} /> : <Icon size={20} style={{ color: meta.color }} />}
        {data.runState === 'done' && <CheckCircle2 size={14} className="text-neon-green" />}
      </div>
      <p className="mt-1 truncate text-[11.5px] font-extrabold text-white">{data.label}</p>
      <p className="truncate text-[9.5px]" style={{ color: meta.color }}>{sub}</p>
      {kind === 'condition' ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: '35%', background: '#00f5a0' }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: '75%', background: '#ff537a' }} />
          <span className="absolute -right-7 top-[22%] text-[8.5px] font-bold text-neon-green">sim</span>
          <span className="absolute -right-7 top-[62%] text-[8.5px] font-bold text-neon-pink">não</span>
        </>
      ) : kind !== 'output' ? (
        <Handle type="source" position={Position.Right} style={{ background: meta.color }} />
      ) : null}
    </div>
  )
}

export const nodeTypes = { start: PixelNode, agent: PixelNode, tool: PixelNode, condition: PixelNode, review: PixelNode, output: PixelNode }
