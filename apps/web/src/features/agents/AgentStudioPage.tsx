import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Plus, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { AgentDraft, BehaviorProfile, MemoryMode, AutonomyLevel, ProviderId } from '@/types/domain'
import { useLabStore } from '@/stores/labStore'
import { AGENT_CHARACTERS } from '@/world/maps'
import { personalityFor, PERSONALITY_LABELS } from '@/world/ambient/personality'
import { ENVIRONMENTS, INTEGRATIONS_CATALOG, KNOWLEDGE_BASES, TOOLS_CATALOG } from '@/services/demo/demoData'
import { Avatar, Chip, DemoTag, Field, Panel, Toggle, cx } from '@/components/ui/primitives'
import { providerIconUrl } from '@/lib/assets'
import { ACCENTS, DEPARTMENTS, KNOWLEDGE_SOURCES, ROLE_PRESETS, STEPS, draftFromAgent, emptyDraft, validateStep, type Errors, type StepId } from './agentForm'

const BEHAVIORS: { id: BehaviorProfile; label: string }[] = [
  { id: 'analitico', label: 'Analítico' }, { id: 'criativo', label: 'Criativo' }, { id: 'preciso', label: 'Preciso' }, { id: 'didatico', label: 'Didático' }, { id: 'executor', label: 'Executor' },
]

export default function AgentStudioPage() {
  const { agentId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { agents, providers, saveAgent, loaded, credentials } = useLabStore()
  const editing = agents.find((a) => a.id === agentId)
  const [draft, setDraft] = useState<AgentDraft>(() => (editing ? draftFromAgent(editing) : emptyDraft({ name: params.get('nome') ?? undefined, objective: params.get('objetivo') ?? undefined, environmentId: params.get('ambiente') ?? undefined })))
  const [step, setStep] = useState<StepId>('identidade')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing && draft.id !== editing.id) setDraft(draftFromAgent(editing))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  const providerModels = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p.models.map((m) => m.id)])) as Record<ProviderId, string[]>, [providers])
  const idx = STEPS.findIndex((s) => s.id === step)

  const patch = <K extends keyof AgentDraft>(k: K, v: AgentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const patchIn = <K extends 'intelligence' | 'permissions' | 'knowledge' | 'limits' | 'rules' | 'appearance'>(k: K, v: Partial<AgentDraft[K]>) => setDraft((d) => ({ ...d, [k]: { ...d[k], ...v } }))

  const go = (target: StepId) => {
    const ti = STEPS.findIndex((s) => s.id === target)
    if (ti > idx) {
      const e = validateStep(step, draft, providerModels)
      setErrors(e)
      if (Object.keys(e).length) return
    } else setErrors({})
    setStep(target)
  }

  const save = async () => {
    const e = validateStep('revisao', draft, providerModels)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const saved = await saveAgent(draft)
      nav(`/agentes/${saved.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (agentId && !editing && loaded) return <Panel title="Agente não encontrado"><p className="text-lab-muted">O agente solicitado não existe.</p></Panel>

  const provider = providers.find((p) => p.id === draft.intelligence.provider)

  return (
    <div className="flex flex-col gap-2.5" data-testid="agent-studio">
      <div className="px-panel c-green flex flex-wrap items-center gap-3 px-3 py-2">
        <Sparkles size={28} className="text-neon-green" />
        <div>
          <h1 className="title-pixel text-[15px]">Studio de Agentes</h1>
          <p className="text-[12px] text-lab-muted">{editing ? `Editando “${editing.name}” (v${editing.version})` : 'Criação e configuração de um novo agente'} · persistência local no modo demonstrativo</p>
        </div>
        <button className="px-btn ghost ml-auto" style={{ ['--c' as string]: '#39d6ff' }} onClick={() => nav(-1)}><X size={14} /> Cancelar</button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[200px_260px_minmax(0,1fr)]">
        {/* etapas */}
        <Panel accent="green" title="Etapas">
          <ol className="space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className={cx('flex w-full items-center gap-2 rounded-[4px] border-2 px-2 py-1.5 text-left text-[12px] font-bold', s.id === step ? 'border-neon-green bg-neon-green/15 text-neon-green' : 'border-transparent text-lab-muted hover:text-white')} aria-current={s.id === step ? 'step' : undefined}>
                  <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[10px]', i < idx ? 'bg-neon-green text-[#04120c]' : s.id === step ? 'border-2 border-neon-green' : 'border border-lab-line')}>{i < idx ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        {/* prévia do personagem */}
        <Panel accent="purple" title="Prévia">
          <div className="flex flex-col items-center gap-2">
            <div className="relative grid h-[150px] w-[150px] place-items-center rounded-[6px] border-2 bg-[radial-gradient(circle,#1d2a5a,#0a1126)]" style={{ borderColor: draft.appearance.accentColor, boxShadow: `0 0 20px -4px ${draft.appearance.accentColor}` }}>
              <Avatar characterId={draft.appearance.characterId} size={128} ring="transparent" />
            </div>
            <p className="text-center text-[13px] font-extrabold">{draft.name || 'Novo agente'}</p>
            <p className="text-center text-[11px] text-lab-muted">{draft.role} · {draft.department}</p>
            <div className="flex flex-wrap justify-center gap-1">
              <Chip color="#39d6ff"><img src={providerIconUrl(draft.intelligence.provider)} className="pixel h-3 w-3" alt="" />{draft.intelligence.model}</Chip>
              {draft.knowledge.ragEnabled && <Chip color="#ffb800">RAG</Chip>}
              <Chip color="#9d62ff">{draft.rules.autonomy}</Chip>
            </div>
            {step === 'identidade' && (
              <div className="w-full">
                <p className="px-label mt-2">Personalizar avatar</p>
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Avatar">
                  {AGENT_CHARACTERS.map((c) => (
                    <button key={c} role="radio" aria-checked={draft.appearance.characterId === c} onClick={() => patchIn('appearance', { characterId: c })} className={cx('rounded-[4px] p-0.5', draft.appearance.characterId === c ? 'bg-neon-green' : 'hover:bg-white/10')}>
                      <Avatar characterId={c} size={48} />
                    </button>
                  ))}
                </div>
                <p className="px-label mt-2">Cor de destaque</p>
                <div className="flex gap-1.5">
                  {ACCENTS.map((c) => (
                    <button key={c} aria-label={`Cor ${c}`} onClick={() => patchIn('appearance', { accentColor: c })} className={cx('h-6 w-6 rounded-[3px] border-2', draft.appearance.accentColor === c ? 'border-white' : 'border-transparent')} style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* formulário da etapa */}
        <Panel accent="cyan" title={`${idx + 1}. ${STEPS[idx].label}`} actions={<DemoTag label="LOCAL" />}>
          <div className="space-y-3">
            {step === 'identidade' && (
              <>
              <Grid>
                <Field label="Nome do agente" required error={errors.name}><input className="px-input" value={draft.name} onChange={(e) => patch('name', e.target.value)} placeholder="Ex.: Pesquisador IA" /></Field>
                <Field label="Papel (função)" required error={errors.role}>
                  <input className="px-input" list="roles" value={draft.role} onChange={(e) => patch('role', e.target.value)} />
                  <datalist id="roles">{ROLE_PRESETS.map((r) => <option key={r} value={r} />)}</datalist>
                </Field>
                <Field label="Departamento"><select className="px-input" value={draft.department} onChange={(e) => patch('department', e.target.value)}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
                <Field label="Ambiente de trabalho"><select className="px-input" value={draft.environmentId} onChange={(e) => setDraft((d) => ({ ...d, environmentId: e.target.value, stationId: null }))}>{ENVIRONMENTS.filter((e) => e.availability === 'implemented').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="Descrição curta"><input className="px-input" value={draft.description} onChange={(e) => patch('description', e.target.value)} placeholder="Aparece nos cards" /></Field>
                <Field label="Tags" hint="Separe por vírgula"><input className="px-input" value={draft.tags.join(', ')} onChange={(e) => patch('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6))} placeholder="Pesquisa, Acadêmico, RAG" /></Field>
                <div className="md:col-span-2"><Field label="Objetivo" required error={errors.objective}><textarea className="px-input h-20" value={draft.objective} onChange={(e) => patch('objective', e.target.value)} placeholder="O que este agente deve alcançar?" /></Field></div>
              </Grid>
              <PersonalityEditor value={draft.personality ?? personalityFor(draft.department, ['ops', 'robo2'].includes(draft.appearance.characterId))} onChange={(personality) => patch('personality', personality)} />
              </>
            )}

            {step === 'inteligencia' && (
              <>
                <p className="px-label">Provedor</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {providers.map((p) => (
                    <button key={p.id} onClick={() => patchIn('intelligence', { provider: p.id, model: p.defaultModel, credentialId: null })} className={cx('px-inset flex flex-col items-center gap-1 p-2 text-[11px] font-bold', draft.intelligence.provider === p.id && 'border-neon-green shadow-[0_0_8px_-2px_#00f5a0]')} aria-pressed={draft.intelligence.provider === p.id}>
                      <img src={providerIconUrl(p.id)} className="pixel h-7 w-7" alt="" />{p.name}
                      <span className="text-[9px] font-normal text-lab-muted">{p.status === 'connected' ? 'conectado (demo)' : 'não configurado'}</span>
                    </button>
                  ))}
                </div>
                <Grid>
                  <Field label="Modelo" required error={errors.model}>
                    <select className="px-input" value={draft.intelligence.model} onChange={(e) => patchIn('intelligence', { model: e.target.value })}>
                      {provider?.models.map((m) => <option key={m.id} value={m.id}>{m.name} — {(m.contextWindow / 1000).toLocaleString('pt-BR')}K ctx</option>)}
                    </select>
                  </Field>
                  <Field label="Chave de API (perfil)" hint="Use chaves diferentes por agente para dividir cotas">
                    <select className="px-input" value={draft.intelligence.credentialId ?? ''} onChange={(e) => patchIn('intelligence', { credentialId: e.target.value || null })} data-testid="credential-select">
                      <option value="">Padrão do provedor</option>
                      {credentials.filter((c) => c.provider === draft.intelligence.provider).map((c) => <option key={c.id} value={c.id}>{c.alias}{c.last4 ? ` (…${c.last4})` : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Perfil de comportamento"><select className="px-input" value={draft.intelligence.behavior} onChange={(e) => patchIn('intelligence', { behavior: e.target.value as BehaviorProfile })}>{BEHAVIORS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></Field>
                  <Field label={`Temperatura: ${draft.intelligence.temperature.toFixed(1)}`} error={errors.temperature}><input type="range" min={0} max={2} step={0.1} value={draft.intelligence.temperature} onChange={(e) => patchIn('intelligence', { temperature: +e.target.value })} className="w-full accent-[#00f5a0]" /></Field>
                  <Field label={`Top-p: ${draft.intelligence.topP.toFixed(2)}`}><input type="range" min={0.1} max={1} step={0.05} value={draft.intelligence.topP} onChange={(e) => patchIn('intelligence', { topP: +e.target.value })} className="w-full accent-[#39d6ff]" /></Field>
                  <Field label="Máx. tokens de saída" error={errors.maxOutputTokens}><input type="number" className="px-input" value={draft.intelligence.maxOutputTokens} onChange={(e) => patchIn('intelligence', { maxOutputTokens: +e.target.value })} /></Field>
                </Grid>
                <Field label="Instruções de sistema" required error={errors.instructions}><textarea className="px-input h-28 font-mono" value={draft.intelligence.instructions} onChange={(e) => patchIn('intelligence', { instructions: e.target.value })} /></Field>
                <p className="flex items-center gap-1.5 text-[10.5px] text-lab-muted"><ShieldCheck size={13} className="text-neon-green" /> Credenciais dos provedores ficam no backend — nunca neste formulário.</p>
              </>
            )}

            {step === 'ferramentas' && (
              <>
                <p className="px-label">Ferramentas autorizadas</p>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {TOOLS_CATALOG.map((t) => {
                    const on = draft.tools.includes(t.id)
                    return (
                      <label key={t.id} className={cx('px-inset flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[11.5px]', on && 'border-neon-green/70')}>
                        <input type="checkbox" checked={on} onChange={() => patch('tools', on ? draft.tools.filter((x) => x !== t.id) : [...draft.tools, t.id])} className="accent-[#00f5a0]" />
                        <span className="flex-1">{t.name}</span>
                        <Chip color={t.risk === 'alto' ? '#ff537a' : t.risk === 'médio' ? '#ffb800' : '#00f5a0'}>risco {t.risk}</Chip>
                      </label>
                    )
                  })}
                </div>
                <p className="px-label">Permissões</p>
                <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {([
                    ['readFiles', 'Ler arquivos'], ['writeFiles', 'Escrever arquivos'], ['internet', 'Acesso à internet'], ['externalApis', 'Chamar APIs externas'], ['sensitiveRequiresApproval', 'Aprovação humana p/ operações sensíveis'],
                  ] as const).map(([k, label]) => (
                    <div key={k} className="px-inset flex items-center justify-between px-2 py-1.5 text-[11.5px]">{label}<Toggle checked={draft.permissions[k]} onChange={(v) => patchIn('permissions', { [k]: v })} label={label} /></div>
                  ))}
                </div>
                {errors.permissions && <ErrorLine msg={errors.permissions} />}
                <p className="px-label">Integrações</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEGRATIONS_CATALOG.map((i) => {
                    const on = draft.integrations.includes(i)
                    return <button key={i} onClick={() => patch('integrations', on ? draft.integrations.filter((x) => x !== i) : [...draft.integrations, i])} className={cx('rounded-[3px] border px-2 py-0.5 text-[11px] font-bold', on ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan' : 'border-lab-line text-lab-muted')} aria-pressed={on}>{i}</button>
                  })}
                </div>
                <p className="text-[10.5px] text-lab-muted">As integrações reais serão conectadas pelo backend (Fase 4). Aqui apenas registramos a autorização.</p>
              </>
            )}

            {step === 'conhecimento' && (
              <>
                <p className="px-label">Fontes de informação</p>
                <div className="flex flex-wrap gap-1.5">
                  {KNOWLEDGE_SOURCES.map((s) => {
                    const on = draft.knowledge.sources.includes(s)
                    return <button key={s} onClick={() => patchIn('knowledge', { sources: on ? draft.knowledge.sources.filter((x) => x !== s) : [...draft.knowledge.sources, s] })} className={cx('rounded-[3px] border px-2 py-0.5 text-[11px] font-bold', on ? 'border-neon-gold bg-neon-gold/15 text-neon-gold' : 'border-lab-line text-lab-muted')} aria-pressed={on}>{s}</button>
                  })}
                </div>
                <DocumentsEditor docs={draft.knowledge.documents} onChange={(documents) => patchIn('knowledge', { documents })} />
                <Grid>
                  <Field label="Memória">
                    <select className="px-input" value={draft.knowledge.memory} onChange={(e) => patchIn('knowledge', { memory: e.target.value as MemoryMode })}>
                      <option value="none">Sem memória</option><option value="short">Curto prazo (sessão)</option><option value="long">Longo prazo (persistente)</option>
                    </select>
                  </Field>
                  <div className="px-inset flex items-center justify-between px-2 py-1.5 text-[11.5px]">Base RAG (recuperação semântica)<Toggle checked={draft.knowledge.ragEnabled} onChange={(v) => patchIn('knowledge', { ragEnabled: v, ragBaseId: v ? draft.knowledge.ragBaseId ?? 'kb-dw' : null })} label="Ativar RAG" /></div>
                  {draft.knowledge.ragEnabled && (
                    <Field label="Base de conhecimento" error={errors.ragBaseId}>
                      <select className="px-input" value={draft.knowledge.ragBaseId ?? ''} onChange={(e) => patchIn('knowledge', { ragBaseId: e.target.value || null })}>
                        <option value="">Selecione…</option>
                        {KNOWLEDGE_BASES.filter((k) => k.status !== 'planejado').map((k) => <option key={k.id} value={k.id}>{k.name} ({k.documents} docs · demo)</option>)}
                      </select>
                    </Field>
                  )}
                </Grid>
              </>
            )}

            {step === 'configuracao' && (
              <>
                <Grid>
                  <Field label="Limite de tokens por execução" error={errors.maxTokensPerRun}><input type="number" className="px-input" value={draft.limits.maxTokensPerRun} onChange={(e) => patchIn('limits', { maxTokensPerRun: +e.target.value })} /></Field>
                  <Field label="Limite de custo diário (US$)" error={errors.maxCostPerDayUsd} hint="Bloqueia execuções ao atingir o teto"><input type="number" step="0.1" className="px-input" value={draft.limits.maxCostPerDayUsd} onChange={(e) => patchIn('limits', { maxCostPerDayUsd: +e.target.value })} /></Field>
                  <Field label="Tempo limite (s)" error={errors.timeoutSec}><input type="number" className="px-input" value={draft.limits.timeoutSec} onChange={(e) => patchIn('limits', { timeoutSec: +e.target.value })} /></Field>
                  <Field label="Retentativas máximas" error={errors.maxRetries}><input type="number" className="px-input" value={draft.limits.maxRetries} onChange={(e) => patchIn('limits', { maxRetries: +e.target.value })} /></Field>
                </Grid>
                <p className="px-label">Autonomia</p>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                  {([['manual', 'Manual', 'Toda ação aguarda aprovação'], ['supervised', 'Supervisionado', 'Aprovação em ações sensíveis'], ['autonomous', 'Autônomo', 'Executa dentro dos limites']] as [AutonomyLevel, string, string][]).map(([id, label, desc]) => (
                    <button key={id} role="radio" aria-checked={draft.rules.autonomy === id} onClick={() => patchIn('rules', { autonomy: id })} className={cx('px-inset p-2 text-left', draft.rules.autonomy === id && 'border-neon-purple shadow-[0_0_8px_-2px_#9d62ff]')}>
                      <b className="text-[12px]">{label}</b><span className="block text-[10px] text-lab-muted">{desc}</span>
                    </button>
                  ))}
                </div>
                {errors.autonomy && <ErrorLine msg={errors.autonomy} />}
                <Grid>
                  <div className="px-inset flex items-center justify-between px-2 py-1.5 text-[11.5px]">Revisão humana obrigatória<Toggle checked={draft.rules.requireHumanReview} onChange={(v) => patchIn('rules', { requireHumanReview: v })} label="Revisão humana" /></div>
                  <div className="px-inset flex items-center justify-between px-2 py-1.5 text-[11.5px]">Permitir delegação a outros agentes<Toggle checked={draft.rules.allowDelegation} onChange={(v) => patchIn('rules', { allowDelegation: v })} label="Delegação" /></div>
                </Grid>
                <Field label="Restrições adicionais"><textarea className="px-input h-16" value={draft.rules.restrictions} onChange={(e) => patchIn('rules', { restrictions: e.target.value })} placeholder="Ex.: não enviar e-mails externos" /></Field>
              </>
            )}

            {step === 'revisao' && <Review draft={draft} errors={errors} />}
          </div>

          <footer className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
            {Object.keys(errors).length > 0 && <span className="flex items-center gap-1 text-[11px] text-neon-pink"><AlertTriangle size={13} /> Corrija os campos destacados.</span>}
            <button className="px-btn ghost ml-auto" style={{ ['--c' as string]: '#39d6ff' }} disabled={idx === 0} onClick={() => go(STEPS[idx - 1].id)}><ArrowLeft size={14} /> Voltar</button>
            {step !== 'revisao' ? (
              <button className="px-btn solid" onClick={() => go(STEPS[idx + 1].id)}>Próximo <ArrowRight size={14} /></button>
            ) : (
              <button className="px-btn solid" onClick={save} disabled={saving} data-testid="save-agent"><Save size={14} /> {editing ? 'Salvar alterações' : 'Salvar agente'}</button>
            )}
          </footer>
        </Panel>
      </div>
    </div>
  )
}

function PersonalityEditor({ value, onChange }: { value: NonNullable<AgentDraft['personality']>; onChange: (v: NonNullable<AgentDraft['personality']>) => void }) {
  return (
    <div className="rounded-[6px] border border-lab-line/70 p-3" data-testid="personality-editor">
      <p className="mb-2 text-[12px] font-extrabold">Personalidade <span className="font-normal text-lab-muted">— influencia o comportamento no ambiente</span></p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
        {(Object.keys(PERSONALITY_LABELS) as (keyof typeof PERSONALITY_LABELS)[]).map((k) => (
          <label key={k} className="text-[11px]">
            <span className="flex justify-between text-lab-muted"><span>{PERSONALITY_LABELS[k]}</span><b className="text-lab-text">{value[k]}</b></span>
            <input type="range" min={0} max={100} step={5} value={value[k]} onChange={(e) => onChange({ ...value, [k]: +e.target.value })} className="w-full accent-[#9d62ff]" />
          </label>
        ))}
        <label className="text-[11px]"><span className="px-label">Preferência de interação</span>
          <select className="px-input py-1" value={value.preference} onChange={(e) => onChange({ ...value, preference: e.target.value as typeof value.preference })}>
            <option value="individual">Trabalho individual</option><option value="duplas">Duplas</option><option value="grupos">Grupos</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
}

function ErrorLine({ msg }: { msg: string }) {
  return <p className="flex items-center gap-1 text-[11px] text-neon-pink"><AlertTriangle size={12} /> {msg}</p>
}

function DocumentsEditor({ docs, onChange }: { docs: string[]; onChange: (d: string[]) => void }) {
  const [v, setV] = useState('')
  return (
    <div>
      <p className="px-label">Documentos de referência <span className="text-neon-purple">(upload real planejado — Fase 4)</span></p>
      <div className="flex gap-1.5">
        <input className="px-input" value={v} onChange={(e) => setV(e.target.value)} placeholder="nome-do-arquivo.pdf" onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { e.preventDefault(); onChange([...docs, v.trim()]); setV('') } }} />
        <button className="px-btn sm" onClick={() => { if (v.trim()) { onChange([...docs, v.trim()]); setV('') } }}><Plus size={12} /> Adicionar</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {docs.map((d) => <Chip key={d} color="#ffb800">{d} <button aria-label={`Remover ${d}`} onClick={() => onChange(docs.filter((x) => x !== d))}><X size={10} /></button></Chip>)}
      </div>
    </div>
  )
}

function Review({ draft, errors }: { draft: AgentDraft; errors: Errors }) {
  const rows: [string, ReactNode][] = [
    ['Nome', draft.name || '—'], ['Papel', draft.role], ['Departamento', draft.department], ['Ambiente', ENVIRONMENTS.find((e) => e.id === draft.environmentId)?.name],
    ['Objetivo', draft.objective || '—'], ['Modelo', `${draft.intelligence.provider} / ${draft.intelligence.model}`],
    ['Comportamento', `${draft.intelligence.behavior} · temp ${draft.intelligence.temperature} · top-p ${draft.intelligence.topP}`],
    ['Ferramentas', draft.tools.join(', ') || '—'], ['Integrações', draft.integrations.join(', ') || '—'],
    ['Conhecimento', `${draft.knowledge.sources.join(', ') || 'sem fontes'} · memória ${draft.knowledge.memory} · RAG ${draft.knowledge.ragEnabled ? draft.knowledge.ragBaseId : 'desativado'}`],
    ['Limites', `${draft.limits.maxTokensPerRun} tokens/run · US$ ${draft.limits.maxCostPerDayUsd}/dia · ${draft.limits.timeoutSec}s · ${draft.limits.maxRetries} retentativas`],
    ['Regras', `${draft.rules.autonomy} · revisão humana ${draft.rules.requireHumanReview ? 'sim' : 'não'} · delegação ${draft.rules.allowDelegation ? 'sim' : 'não'}`],
  ]
  const errs = Object.values(errors)
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-lab-muted">{k}</dt><dd className="break-words font-bold">{v}</dd></div>)}
      </dl>
      {errs.length ? <div className="rounded-[4px] border border-neon-pink/60 p-2">{errs.map((e) => <ErrorLine key={e} msg={e!} />)}</div> : <p className="flex items-center gap-1.5 text-[11.5px] text-neon-green"><Check size={14} /> Configuração válida. Pronto para salvar.</p>}
    </div>
  )
}
