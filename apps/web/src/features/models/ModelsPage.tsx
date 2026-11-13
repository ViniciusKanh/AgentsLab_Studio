import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Cpu, KeyRound, Lock, Plus, Server, ShieldCheck, Star, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLabStore } from '@/stores/labStore'
import { Chip, DemoTag, Field, Panel, Tabs, Toggle, cx } from '@/components/ui/primitives'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'
import { ConfirmModal } from '@/components/ui/Modal'
import { PROVIDER_COLORS, providerIconUrl } from '@/lib/assets'
import { fmtCompact, fmtCost, fmtInt, fmtUsd } from '@/lib/format'
import type { ProviderId } from '@/types/domain'
import type { Project, Usage, UsageRow } from '@/types/platform'

type T = 'provedores' | 'catalogo' | 'chaves' | 'limites' | 'custos'

/** Provedores e Custos: provedores, catálogo, chaves (cofre do SO), limites e consumo REAL. */
export default function ModelsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as T) || 'provedores'
  const focus = params.get('provider') as ProviderId | null
  const { providers, updateProvider, credentials } = useLabStore()
  const real = appConfig.mode === 'real'

  return (
    <div className="flex flex-col gap-2.5" data-testid="models-page">
      <div className="px-panel c-cyan flex flex-wrap items-center gap-3 px-3 py-2">
        <Cpu size={30} className="text-neon-cyan" />
        <div>
          <h1 className="title-pixel text-[15px]">Provedores e Custos</h1>
          <p className="text-[12px] text-lab-muted">Provedores de modelos, chaves de API, limites e consumo registrado. {!real && <DemoTag label="OFFLINE · EXEMPLOS" />}</p>
        </div>
      </div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} items={[{ id: 'provedores', label: 'Provedores' }, { id: 'chaves', label: 'Chaves (API)' }, { id: 'custos', label: 'Consumo e custos' }, { id: 'limites', label: 'Limites' }, { id: 'catalogo', label: 'Catálogo de modelos' }]} />

      {tab === 'provedores' && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          {providers.map((p) => {
            const keys = credentials.filter((c) => c.provider === p.id && c.status !== 'demo').length
            return (
              <article key={p.id} className={cx('px-panel flex flex-col gap-2 p-3', focus === p.id && 'ring-2 ring-neon-cyan')} style={{ ['--c' as string]: PROVIDER_COLORS[p.id] }} data-testid={`provider-${p.id}`}>
                <div className="flex items-center gap-2">
                  <img src={providerIconUrl(p.id)} alt="" className="pixel h-9 w-9" />
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-extrabold">{p.name}</p><Chip color="#9d62ff">{p.badge}</Chip></div>
                  <Toggle checked={p.enabled} onChange={(v) => updateProvider(p.id, { enabled: v })} label={`Ativar ${p.name}`} />
                </div>
                <p className={cx('text-[11px] font-bold', real && (keys || p.kind === 'local') ? 'text-neon-green' : 'text-lab-muted')}>
                  ● {!real ? 'Backend desconectado' : p.kind === 'local' ? 'Local (requer Ollama em execução)' : keys ? `${keys} chave(s) cadastrada(s)` : 'Sem chave cadastrada'}
                </p>
                <label className="text-[11px]"><span className="px-label">Modelo padrão</span>
                  <select className="px-input py-1" value={p.defaultModel} onChange={(e) => updateProvider(p.id, { defaultModel: e.target.value })}>{p.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                </label>
                {real ? (
                  <p className="text-[10.5px] text-lab-muted">Últimos 30 dias: <b className="text-lab-text">{fmtCompact(p.usage.tokensMonth)}</b> tokens · <b className="text-lab-text">{fmtCost(p.usage.costUsdMonth)}</b> <span className="opacity-70">(estimativa)</span></p>
                ) : <p className="text-[10.5px] text-lab-muted">Consumo disponível com o backend conectado.</p>}
              </article>
            )
          })}
        </div>
      )}

      {tab === 'catalogo' && (
        <Panel accent="purple" title="Catálogo de modelos">
          <table className="w-full text-[11.5px]">
            <thead className="text-left text-lab-muted"><tr><th className="pb-1.5">Provedor</th><th>Modelo</th><th>Contexto</th><th>Entrada / 1M</th><th>Saída / 1M</th><th>Tags</th></tr></thead>
            <tbody>
              {providers.flatMap((p) => p.models.map((m) => (
                <tr key={`${p.id}-${m.id}`} className="border-t border-white/5">
                  <td className="py-1.5"><span className="flex items-center gap-1.5"><img src={providerIconUrl(p.id)} className="pixel h-4 w-4" alt="" />{p.name}</span></td>
                  <td className="font-bold">{m.name}<span className="block font-mono text-[10px] font-normal text-lab-muted">{m.id}</span></td>
                  <td>{fmtInt(m.contextWindow)}</td>
                  <td>{m.inputPer1M === null ? '—' : fmtUsd(m.inputPer1M)}</td>
                  <td>{m.outputPer1M === null ? '—' : fmtUsd(m.outputPer1M)}</td>
                  <td className="space-x-1">{m.tags.map((t) => <Chip key={t} color="#8b97c4">{t}</Chip>)}</td>
                </tr>
              )))}
            </tbody>
          </table>
          <p className="mt-2 text-[10.5px] text-neon-gold">Preços de referência (US$/1M tokens) apenas para orientação. O custo registrado de cada chamada é calculado pelo LiteLLM e marcado como estimativa; confira as tarifas oficiais de cada provedor.</p>
        </Panel>
      )}

      {tab === 'chaves' && <CredentialsTab />}

      {tab === 'limites' && (
        <Panel accent="pink" title="Limites aplicados pelo backend">
          <ul className="space-y-1.5 text-[12px]">
            <li>• <b>Orçamento por projeto</b> (padrão US$ 2,00, ajustável no projeto): ao ser atingido, a execução é <b>pausada</b> e você decide se aumenta o limite.</li>
            <li>• <b>Chamadas de modelo por projeto</b>: máximo de 60 (evita loops).</li>
            <li>• <b>Tarefas por plano</b>: máximo de 10; dependências circulares são rejeitadas.</li>
            <li>• <b>Revisões automáticas</b>: no máximo 1 por projeto; novas revisões só por feedback do gestor.</li>
            <li>• <b>Execução paralela</b>: até 3 tarefas simultâneas.</li>
          </ul>
          <p className="mt-2 text-[10.5px] text-lab-muted">Valores configuráveis no backend via variáveis <code>AGENTSLAB_*</code> (ver apps/api/.env.example).</p>
        </Panel>
      )}

      {tab === 'custos' && <UsageTab />}
    </div>
  )
}

function UsageTab() {
  const agents = useLabStore((s) => s.agents)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    if (appConfig.mode !== 'real') return
    platform.usage().then(setUsage).catch(() => undefined)
    platform.projects().then(setProjects).catch(() => undefined)
  }, [])
  const byAgent = useMemo(() => (usage?.byAgent ?? []).map((r) => ({ name: (agents.find((a) => a.id === r.key)?.name ?? r.key ?? '—').split(' ')[0], custo: +r.costUsd.toFixed(4) })), [usage, agents])
  if (appConfig.mode !== 'real') return <Panel title="Consumo"><p className="text-[12px] text-lab-muted">Conecte o backend para ver o consumo real registrado.</p></Panel>
  if (!usage) return null
  const total = usage.byProvider.reduce((s, r) => s + r.costUsd, 0)
  const table = (rows: UsageRow[], label: (k: string | null) => string) => (
    <table className="w-full text-[11.5px]">
      <thead className="text-left text-lab-muted"><tr><th className="pb-1">Item</th><th>Chamadas</th><th>Tokens (entrada/saída)</th><th className="text-right">Custo</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={String(r.key)} className="border-t border-white/5"><td className="py-1">{label(r.key)}</td><td>{fmtInt(r.calls)}</td><td>{fmtInt(r.inputTokens)} / {fmtInt(r.outputTokens)}</td><td className="whitespace-nowrap text-right">{fmtCost(r.costUsd)}</td></tr>)}</tbody>
    </table>
  )
  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" data-testid="usage-tab">
      <Panel accent="cyan" title="Custo por agente">
        {byAgent.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhuma chamada registrada.</p> : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAgent} margin={{ left: -10 }}>
                <CartesianGrid stroke="#26335e" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" tickLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip formatter={(v) => fmtCost(Number(v))} cursor={{ fill: 'rgba(57,214,255,0.08)' }} />
                <Bar dataKey="custo" fill="#39d6ff" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel accent="gold" title={`Por modelo · total ${fmtCost(total)}`}>{table(usage.byModel, (k) => k ?? '—')}</Panel>
      <Panel accent="purple" title="Por projeto">{table(usage.byProject, (k) => (k ? projects.find((p) => p.id === k)?.title ?? k : 'Conversas avulsas'))}</Panel>
      <Panel accent="green" title="Por provedor">{table(usage.byProvider, (k) => k ?? '—')}
        <p className="mt-2 text-[10.5px] text-lab-muted">Custos calculados pelo LiteLLM a partir dos tokens informados pelo provedor — tratados como <b>estimativa</b>. Modelos locais (Ollama) não têm custo de API.</p>
      </Panel>
    </div>
  )
}

/**
 * Perfis de credencial: várias chaves por provedor (ex.: "Gemini · chave 1", "Gemini · chave 2"),
 * atribuídas por agente no Agent Studio. A chave é digitada aqui, enviada UMA vez ao backend local
 * e guardada no cofre do sistema operacional — o navegador só conhece apelido e últimos 4 dígitos.
 */
function CredentialsTab() {
  const { providers, credentials, createCredential, deleteCredential, agents, load } = useLabStore()
  const [provider, setProvider] = useState<ProviderId>('gemini')
  const [alias, setAlias] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const real = appConfig.mode === 'real'
  const usage = (id: string) => agents.filter((a) => a.intelligence.credentialId === id)
  const submit = async () => {
    if (alias.trim().length < 3) return
    if (!real) return
    const c = await createCredential({ provider, alias: alias.trim(), apiKey: apiKey.trim() })
    if (c) { setAlias(''); setApiKey('') }
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_380px]" data-testid="credentials-tab">
      <Panel accent="gold" title={<span className="flex items-center gap-2"><KeyRound size={16} /> Perfis de chave ({credentials.length})</span>}>
        {credentials.length === 0 && <p className="text-[12px] text-lab-muted">Nenhum perfil cadastrado.</p>}
        <ul className="space-y-1.5">
          {credentials.map((c) => {
            const used = usage(c.id)
            return (
              <li key={c.id} className="px-inset flex items-center gap-2 px-2.5 py-2 text-[11.5px]">
                <img src={providerIconUrl(c.provider)} className="pixel h-5 w-5" alt="" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{c.alias}</b>
                  <span className="text-[10.5px] text-lab-muted">{c.last4 ? `••••${c.last4}` : c.status === 'demo' ? 'perfil de exemplo (sem chave)' : 'sem chave'} · usado por {used.length} agente(s){used.length ? `: ${used.map((u) => u.name).join(', ')}` : ''}</span>
                </div>
                {c.status === 'demo' ? <DemoTag /> : <Chip color={c.status === 'invalid' ? '#ff537a' : '#00f5a0'}>{c.status === 'stored' ? 'no cofre' : c.status === 'valid' ? 'válida' : 'inválida'}</Chip>}
                {real && (c.isDefault ? <Chip color="#ffb800">padrão</Chip> : <button className="text-lab-muted hover:text-neon-gold" title="Tornar padrão do provedor" aria-label={`Tornar ${c.alias} padrão`} onClick={() => void platform.setDefaultCredential(c.id).then(load)}><Star size={14} /></button>)}
                <button className="text-lab-muted hover:text-neon-pink" onClick={() => setConfirm(c.id)} aria-label={`Excluir ${c.alias}`}><Trash2 size={14} /></button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-lab-muted">Atribua um perfil a cada agente em <b>Agent Studio → Inteligência → Chave de API</b>. Agentes sem perfil usam a chave <b>padrão</b> do provedor (a primeira cadastrada, ou a marcada com ★).</p>
      </Panel>
      <div className="flex flex-col gap-2.5">
        <Panel accent="green" title="Novo perfil de chave">
          <div className="space-y-2.5">
            <Field label="Provedor"><select className="px-input" value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Apelido" required hint="Ex.: Gemini · chave 2 (BI)"><input className="px-input" value={alias} onChange={(e) => setAlias(e.target.value)} data-testid="cred-alias" /></Field>
            <Field label="Chave de API" hint={real ? 'Enviada ao backend local e guardada no cofre do sistema operacional. Nunca é salva no navegador.' : 'Inicie o backend local para cadastrar chaves reais.'}>
              <input type="password" autoComplete="off" className="px-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={!real} placeholder={real ? 'cole a chave aqui' : 'disponível com o backend'} />
            </Field>
            <button className="px-btn solid w-full" onClick={submit} disabled={!real || alias.trim().length < 3 || (provider !== 'ollama' && apiKey.trim().length < 8)} data-testid="cred-create"><Plus size={14} /> Criar perfil</button>
          </div>
        </Panel>
        <Panel accent="cyan" title="Como as chaves são protegidas">
          <ul className="space-y-1.5 text-[11.5px]">
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Variáveis <code>VITE_*</code> são públicas: nenhuma chave vai para o bundle.</li>
            <li className="flex gap-2"><Server size={15} className="shrink-0 text-neon-cyan" /> O backend guarda a chave no <b>cofre do sistema</b> (Windows: Gerenciador de Credenciais, protegido por DPAPI) e o banco só registra apelido e últimos 4 dígitos.</li>
            <li className="flex gap-2"><Lock size={15} className="shrink-0 text-neon-purple" /> Em execução, o LiteLLM usa a chave do perfil associado ao agente — permitindo dividir cotas entre chaves.</li>
          </ul>
        </Panel>
      </div>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && void deleteCredential(confirm)} title="Excluir perfil" message="Os agentes que usam este perfil voltarão para a chave padrão do provedor." confirmLabel="Excluir" />
    </div>
  )
}
