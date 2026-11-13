import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, CheckCircle2, Copy, FilePlus2, Play, Save, ShieldCheck, Square, Trash2, Workflow as WorkflowIcon } from 'lucide-react'
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from '@/types/domain'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { Avatar, DemoTag, Field, Panel, cx } from '@/components/ui/primitives'
import { ConfirmModal } from '@/components/ui/Modal'
import { TOOLS_CATALOG } from '@/services/demo/demoData'
import { NODE_META, nodeTypes, type FlowNode } from './nodes'
import { canConnect, executionPlan, validateWorkflow, type ValidationIssue } from './workflowLogic'

const edgeStyle = (color = '#9d62ff'): Partial<Edge> => ({ type: 'smoothstep', animated: true, style: { stroke: color }, markerEnd: { type: MarkerType.ArrowClosed, color } })

const toFlowEdges = (edges: WorkflowEdge[]): Edge[] => edges.map((e) => ({ ...e, ...edgeStyle(e.sourceHandle === 'false' ? '#ff537a' : e.sourceHandle === 'true' ? '#00f5a0' : '#9d62ff'), label: e.label, labelStyle: { fill: '#e6ecff', fontSize: 10 }, labelBgStyle: { fill: '#0b1228' } }))
const fromFlowEdges = (edges: Edge[]): WorkflowEdge[] => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, label: typeof e.label === 'string' ? e.label : undefined }))
const fromFlowNodes = (nodes: FlowNode[]): WorkflowNode[] => nodes.map((n) => ({ id: n.id, type: (n.type ?? n.data.kind) as WorkflowNodeKind, position: n.position, data: { ...n.data, runState: undefined } }))

const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7)}`

function blankWorkflow(): Workflow {
  return {
    id: newId('wf'), name: 'Novo workflow', description: '', updatedAt: new Date().toISOString(), origin: 'demo',
    nodes: [
      { id: newId('n'), type: 'start', position: { x: 0, y: 80 }, data: { kind: 'start', label: 'Início (Gatilho)' } },
      { id: newId('n'), type: 'output', position: { x: 520, y: 80 }, data: { kind: 'output', label: 'Saída (Relatório)', outputFormat: 'Markdown' } },
    ],
    edges: [],
  }
}

export default function WorkflowStudioPage() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  )
}

function Studio() {
  const { workflows, saveWorkflow, deleteWorkflow, loaded } = useLabStore()
  const agents = useLabStore((s) => s.agents)
  const toast = useUiStore((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [current, setCurrent] = useState<Workflow | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [running, setRunning] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)

  const load = useCallback((wf: Workflow) => {
    setCurrent(wf)
    setNodes(wf.nodes.map((n) => ({ ...n, data: { ...n.data } })) as FlowNode[])
    setEdges(toFlowEdges(wf.edges))
    setSelectedId(null)
    setIssues(null)
    setDirty(false)
    setTimeout(() => rf.fitView({ padding: 0.12, maxZoom: 1.1 }), 60)
  }, [rf, setEdges, setNodes])

  // carga inicial + parâmetros (?novo=1, ?executar=1)
  useEffect(() => {
    if (!loaded || current) return
    if (params.get('novo')) { load(blankWorkflow()); setDirty(true); setParams({}, { replace: true }); return }
    if (workflows[0]) load(workflows[0])
  }, [loaded, workflows, current, params, load, setParams])

  useEffect(() => () => runTimers.current.forEach(clearTimeout), [])

  const onConnect = useCallback((c: Connection) => {
    const err = canConnect(fromFlowNodes(nodes), fromFlowEdges(edges), c.source, c.target, c.sourceHandle)
    if (err) return toast(err, 'warn')
    const color = c.sourceHandle === 'false' ? '#ff537a' : c.sourceHandle === 'true' ? '#00f5a0' : '#9d62ff'
    setEdges((eds) => addEdge({ ...c, id: newId('e'), ...edgeStyle(color), label: c.sourceHandle === 'true' ? 'sim' : c.sourceHandle === 'false' ? 'não' : undefined }, eds))
    setDirty(true)
  }, [nodes, edges, setEdges, toast])

  const addNode = useCallback((kind: WorkflowNodeKind, pos?: { x: number; y: number }) => {
    if (kind === 'start' && nodes.some((n) => n.type === 'start')) return toast('O fluxo já possui um nó de Início.', 'warn')
    const center = pos ?? rf.screenToFlowPosition({ x: (wrapper.current?.getBoundingClientRect().left ?? 0) + (wrapper.current?.clientWidth ?? 600) / 2, y: (wrapper.current?.getBoundingClientRect().top ?? 0) + (wrapper.current?.clientHeight ?? 400) / 2 })
    const id = newId('n')
    const defaults: Record<WorkflowNodeKind, Partial<FlowNode['data']>> = {
      start: { label: 'Início' }, agent: { label: 'Nova etapa', agentId: agents[0]?.id }, tool: { label: 'Ferramenta', tool: 'web_search' },
      condition: { label: 'Condição', condition: 'resultado.valido == true' }, review: { label: 'Revisão', reviewer: 'humano' }, output: { label: 'Saída', outputFormat: 'PDF' },
    }
    setNodes((ns) => [...ns, { id, type: kind, position: { x: center.x - 75, y: center.y - 35 }, data: { kind, label: '', ...defaults[kind] } as FlowNode['data'] }])
    setSelectedId(id)
    setDirty(true)
  }, [agents, nodes, rf, setNodes, toast])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData('application/agentslab-node') as WorkflowNodeKind
    if (kind) addNode(kind, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const updateSelected = (patch: Partial<FlowNode['data']>) => {
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)))
    setDirty(true)
  }
  const removeSelected = () => {
    if (!selectedId) return
    setNodes((ns) => ns.filter((n) => n.id !== selectedId))
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
    setDirty(true)
  }

  const validate = () => {
    const v = validateWorkflow(fromFlowNodes(nodes), fromFlowEdges(edges))
    setIssues(v)
    return v
  }

  const save = async () => {
    if (!current) return
    const wf: Workflow = { ...current, nodes: fromFlowNodes(nodes), edges: fromFlowEdges(edges) }
    const saved = await saveWorkflow(wf)
    setCurrent(saved)
    setDirty(false)
  }

  const stopRun = () => {
    runTimers.current.forEach(clearTimeout)
    runTimers.current = []
    setRunning(false)
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, runState: undefined } })))
  }

  const run = useCallback(() => {
    const v = validateWorkflow(fromFlowNodes(nodes), fromFlowEdges(edges))
    setIssues(v)
    if (v.some((i) => i.level === 'error')) return toast('Corrija os erros antes de executar.', 'error')
    const plan = executionPlan(fromFlowNodes(nodes), fromFlowEdges(edges))
    setRunning(true)
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, runState: 'idle' } })))
    plan.forEach((id, i) => {
      runTimers.current.push(setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, runState: 'running' } } : n))), i * 1100))
      runTimers.current.push(setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, runState: 'done' } } : n))), i * 1100 + 900))
    })
    runTimers.current.push(setTimeout(() => {
      setRunning(false)
      toast(`Ordem validada: ${plan.length} etapas. Pré-visualização — a execução de fluxos personalizados está planejada; projetos usam o planejamento do coordenador.`, 'info')
    }, plan.length * 1100 + 200))
  }, [nodes, edges, setNodes, toast])

  useEffect(() => {
    if (params.get('executar') && current && nodes.length && !running) { setParams({}, { replace: true }); run() }
  }, [params, current, nodes.length, running, run, setParams])

  const involved = useMemo(() => [...new Set(nodes.map((n) => n.data.agentId).filter(Boolean))].map((id) => agents.find((a) => a.id === id)).filter(Boolean), [nodes, agents])

  return (
    <div className="flex flex-col gap-2.5" data-testid="workflow-studio">
      <div className="px-panel c-purple flex flex-wrap items-center gap-3 px-3 py-2">
        <WorkflowIcon size={28} className="text-neon-purple" />
        <div className="min-w-0">
          <h1 className="title-pixel text-[15px]">Orquestração de Workflows</h1>
          <p className="text-[12px] text-lab-muted">Construa fluxos com múltiplos agentes, ferramentas, condições e revisões.</p>
        </div>
        <select className="px-input ml-auto w-56 py-1.5" aria-label="Workflow" value={current?.id ?? ''} onChange={(e) => { const w = workflows.find((x) => x.id === e.target.value); if (w) load(w) }}>
          {current && !workflows.some((w) => w.id === current.id) && <option value={current.id}>{current.name} (não salvo)</option>}
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="px-btn sm ghost" onClick={() => { load(blankWorkflow()); setDirty(true) }}><FilePlus2 size={13} /> Novo</button>
        <button className="px-btn sm ghost" style={{ ['--c' as string]: '#9d62ff' }} disabled={!current} onClick={() => current && (load({ ...current, id: newId('wf'), name: `${current.name} (cópia)`, nodes: fromFlowNodes(nodes), edges: fromFlowEdges(edges) }), setDirty(true))}><Copy size={13} /> Duplicar</button>
        <button className="px-btn sm ghost" style={{ ['--c' as string]: '#ff537a' }} disabled={!current || !workflows.some((w) => w.id === current.id)} onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Excluir</button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[175px_minmax(0,1fr)_260px]">
        <Panel accent="purple" title="Biblioteca">
          <ul className="space-y-1.5">
            {(Object.keys(NODE_META) as WorkflowNodeKind[]).map((k) => {
              const m = NODE_META[k]
              const Icon = m.icon
              return (
                <li key={k}>
                  <button draggable onDragStart={(e) => { e.dataTransfer.setData('application/agentslab-node', k); e.dataTransfer.effectAllowed = 'move' }} onClick={() => addNode(k)} className="px-inset flex w-full items-center gap-2 px-2 py-1.5 text-left hover:border-white/40" title={`${m.hint} — clique ou arraste`} data-testid={`palette-${k}`}>
                    <span className="grid h-7 w-7 place-items-center rounded-[4px] border-2" style={{ borderColor: m.color, color: m.color }}><Icon size={15} /></span>
                    <span><b className="block text-[11.5px]">{m.label}</b><span className="text-[9.5px] text-lab-muted">{m.hint}</span></span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[10px] text-lab-muted">Clique para adicionar ao centro ou arraste para o canvas. Selecione e pressione Delete para remover.</p>
        </Panel>

        <section className="px-panel c-cyan flex min-h-[560px] flex-col p-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input className="px-input w-60 py-1 font-bold" aria-label="Nome do workflow" value={current?.name ?? ''} onChange={(e) => { if (current) { setCurrent({ ...current, name: e.target.value }); setDirty(true) } }} />
            {dirty && <span className="text-[10.5px] font-bold text-neon-gold">● alterações não salvas</span>}
            <div className="ml-auto flex items-center gap-1.5">
              <button className="px-btn sm ghost" style={{ ['--c' as string]: '#39d6ff' }} onClick={validate}><ShieldCheck size={13} /> Validar</button>
              <button className="px-btn sm" onClick={save} disabled={!current} data-testid="save-workflow"><Save size={13} /> Salvar</button>
              {running ? (
                <button className="px-btn sm" style={{ ['--c' as string]: '#ff537a' }} onClick={stopRun}><Square size={13} /> Parar</button>
              ) : (
                <button className="px-btn sm solid" onClick={run} data-testid="run-workflow"><Play size={13} /> Pré-visualizar ordem</button>
              )}
              <DemoTag label="PRÉ-VISUALIZAÇÃO" />
            </div>
          </div>
          <div ref={wrapper} className="relative min-h-0 flex-1 overflow-hidden rounded-[4px] bg-[#070c1c]" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}>
            <ReactFlow<FlowNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === 'position' || x.type === 'remove')) setDirty(true) }}
              onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === 'remove')) setDirty(true) }}
              onConnect={onConnect}
              isValidConnection={(c) => !canConnect(fromFlowNodes(nodes), fromFlowEdges(edges), c.source, c.target, c.sourceHandle)}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              onNodesDelete={() => setSelectedId(null)}
              deleteKeyCode={['Delete', 'Backspace']}
              fitView
              fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1.4} color="#26335e" />
              <Controls showInteractive={false} />
              <MiniMap style={{ width: 150, height: 90 }} pannable zoomable nodeColor={(n) => NODE_META[(n.type as WorkflowNodeKind) ?? 'agent']?.color ?? '#9d62ff'} maskColor="rgba(5,9,19,0.7)" />
            </ReactFlow>
          </div>
          {involved.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-lab-muted">
              Agentes envolvidos:
              {involved.map((a) => <span key={a!.id} className="flex items-center gap-1 font-bold text-lab-text"><Avatar characterId={a!.appearance.characterId} size={22} />{a!.name}</span>)}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-2.5">
          <Panel accent="gold" title="Propriedades">
            {!selected ? <p className="text-[11.5px] text-lab-muted">Selecione um nó para configurar.</p> : (
              <div className="space-y-2.5" data-testid="node-properties">
                <p className="text-[11px] font-bold" style={{ color: NODE_META[selected.type as WorkflowNodeKind].color }}>{NODE_META[selected.type as WorkflowNodeKind].label}</p>
                <Field label="Rótulo"><input className="px-input" value={selected.data.label} onChange={(e) => updateSelected({ label: e.target.value })} /></Field>
                {(selected.type === 'agent' || (selected.type === 'review' && selected.data.reviewer === 'agente')) && (
                  <Field label="Agente"><select className="px-input" value={selected.data.agentId ?? ''} onChange={(e) => updateSelected({ agentId: e.target.value || undefined })}><option value="">Selecione…</option>{agents.filter((a) => a.status !== 'archived').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
                )}
                {selected.type === 'review' && (
                  <Field label="Revisor"><select className="px-input" value={selected.data.reviewer ?? 'humano'} onChange={(e) => updateSelected({ reviewer: e.target.value as 'humano' | 'agente' })}><option value="humano">Aprovação humana</option><option value="agente">Agente revisor</option></select></Field>
                )}
                {selected.type === 'tool' && (
                  <Field label="Ferramenta"><select className="px-input" value={selected.data.tool ?? ''} onChange={(e) => updateSelected({ tool: e.target.value })}>{TOOLS_CATALOG.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                )}
                {selected.type === 'condition' && <Field label="Expressão" hint="Saída verde = sim · vermelha = não"><input className="px-input font-mono" value={selected.data.condition ?? ''} onChange={(e) => updateSelected({ condition: e.target.value })} /></Field>}
                {selected.type === 'output' && <Field label="Formato"><select className="px-input" value={selected.data.outputFormat ?? 'PDF'} onChange={(e) => updateSelected({ outputFormat: e.target.value })}>{['PDF', 'Markdown', 'DOCX', 'JSON', 'E-mail (planejado)'].map((f) => <option key={f}>{f}</option>)}</select></Field>}
                <Field label="Notas"><textarea className="px-input h-14" value={selected.data.notes ?? ''} onChange={(e) => updateSelected({ notes: e.target.value })} /></Field>
                <button className="px-btn sm w-full" style={{ ['--c' as string]: '#ff537a' }} onClick={removeSelected}><Trash2 size={12} /> Remover nó</button>
              </div>
            )}
          </Panel>
          <Panel accent="green" title="Validação">
            {issues === null ? <p className="text-[11.5px] text-lab-muted">Clique em “Validar” para verificar o fluxo.</p> : issues.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[11.5px] text-neon-green"><CheckCircle2 size={14} /> Fluxo válido.</p>
            ) : (
              <ul className="space-y-1" data-testid="validation-issues">
                {issues.map((i) => (
                  <li key={i.message}>
                    <button className={cx('flex items-start gap-1.5 text-left text-[11px]', i.level === 'error' ? 'text-neon-pink' : 'text-neon-gold')} onClick={() => i.nodeId && setSelectedId(i.nodeId)}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {i.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      <ConfirmModal open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={async () => { if (current) { await deleteWorkflow(current.id); setCurrent(null) } }} title="Excluir workflow" message={<>Excluir “{current?.name}”?</>} confirmLabel="Excluir" />
    </div>
  )
}
