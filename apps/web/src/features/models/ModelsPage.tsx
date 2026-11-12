import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Cpu, KeyRound, Lock, Plus, Server, ShieldCheck, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLabStore } from '@/stores/labStore'
import { Chip, DemoTag, Field, Panel, ProgressBar, Tabs, Toggle, cx } from '@/components/ui/primitives'
import { appConfig } from '@/services/config'
import { ConfirmModal } from '@/components/ui/Modal'
import { PROVIDER_COLORS, providerIconUrl } from '@/lib/assets'
import { fmtCompact, fmtInt, fmtUsd } from '@/lib/format'
import type { ProviderId } from '@/types/domain'

type T = 'provedores' | 'catalogo' | 'chaves' | 'limites' | 'custos'

export default function ModelsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as T) || 'provedores'
  const focus = params.get('provider') as ProviderId | null
  const { providers, updateProvider, agents } = useLabStore()
  const [budget, setBudget] = useState({ monthUsd: 20, alertPct: 80, perAgentDayUsd: 2 })

  const usageByAgent = useMemo(() => [...agents].sort((a, b) => b.stats.costUsd30d - a.stats.costUsd30d).slice(0, 8).map((a) => ({ name: a.name.split(' ')[0], custo: +a.stats.costUsd30d.toFixed(2) })), [agents])
  const totalCost = providers.reduce((s, p) => s + p.usage.costUsdMonth, 0)

  return (
    <div className="flex flex-col gap-2.5" data-testid="models-page">
      <div className="px-panel c-cyan flex flex-wrap items-center gap-3 px-3 py-2">
        <Cpu size={30} className="text-neon-cyan" />
        <div>
          <h1 className="title-pixel text-[15px]">Modelos & Tokens</h1>
          <p className="text-[12px] text-lab-muted">Provedores, catálogo de modelos, limites e custos. <DemoTag label="CONSUMO DEMO" /></p>
        </div>
      </div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} items={[{ id: 'provedores', label: 'Provedores' }, { id: 'catalogo', label: 'Catálogo de modelos' }, { id: 'chaves', label: 'Chaves (API)' }, { id: 'limites', label: 'Limites' }, { id: 'custos', label: 'Custos' }]} />

      {tab === 'provedores' && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          {providers.map((p) => (
            <article key={p.id} className={cx('px-panel flex flex-col gap-2 p-3', focus === p.id && 'ring-2 ring-neon-cyan')} style={{ ['--c' as string]: PROVIDER_COLORS[p.id] }} data-testid={`provider-${p.id}`}>
              <div className="flex items-center gap-2">
                <img src={providerIconUrl(p.id)} alt="" className="pixel h-9 w-9" />
                <div className="min-w-0 flex-1"><p className="text-[14px] font-extrabold">{p.name}</p><Chip color="#9d62ff">{p.badge}</Chip></div>
                <Toggle checked={p.enabled} onChange={(v) => updateProvider(p.id, { enabled: v })} label={`Ativar ${p.name}`} disabled={p.status === 'not_configured'} />
              </div>
              <p className={cx('text-[11px] font-bold', p.status === 'connected' ? 'text-neon-green' : 'text-lab-muted')}>● {p.status === 'connected' ? 'Conectado (simulado)' : 'Não configurado'} · {p.kind === 'local' ? 'execução local' : 'nuvem'}</p>
              <label className="text-[11px]"><span className="px-label">Modelo padrão</span>
                <select className="px-input py-1" value={p.defaultModel} onChange={(e) => updateProvider(p.id, { defaultModel: e.target.value })}>{p.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </label>
              <div className="flex justify-between text-[10.5px] text-lab-muted"><span>Tokens (mês)</span><span><b className="text-lab-text">{fmtCompact(p.usage.tokensMonth)}</b> / {fmtCompact(p.usage.quotaMonth)}</span></div>
              <ProgressBar value={p.usage.quotaMonth ? p.usage.tokensMonth / p.usage.quotaMonth : 0} color={PROVIDER_COLORS[p.id]} height={8} />
              <p className="text-[10.5px] text-lab-muted">Custo estimado (mês): <b className="text-lab-text">{fmtUsd(p.usage.costUsdMonth)}</b></p>
              {p.id === 'ollama' && <p className="text-[10.5px] text-neon-gold">Requer Ollama rodando localmente e o backend (Fase 3) para conexão.</p>}
            </article>
          ))}
        </div>
      )}

      {tab === 'catalogo' && (
        <Panel accent="purple" title="Catálogo de modelos" demo>
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
          <p className="mt-2 text-[10.5px] text-neon-gold">Preços ilustrativos (estimativa) — serão sincronizados com as tarifas oficiais via backend/LiteLLM na Fase 3.</p>
        </Panel>
      )}

      {tab === 'chaves' && <CredentialsTab />}

      {tab === 'limites' && (
        <Panel accent="pink" title="Limites de consumo (preferências locais)">
          <div className="grid gap-3 md:grid-cols-3">
            {([['monthUsd', 'Orçamento mensal (US$)'], ['alertPct', 'Alerta ao atingir (%)'], ['perAgentDayUsd', 'Teto por agente/dia (US$)']] as const).map(([k, l]) => (
              <label key={k}><span className="px-label">{l}</span><input type="number" className="px-input" value={budget[k]} onChange={(e) => setBudget({ ...budget, [k]: Math.max(0, +e.target.value) })} /></label>
            ))}
          </div>
          <div className="mt-3">
            <p className="text-[11px] text-lab-muted">Consumo estimado do mês: <b className="text-lab-text">{fmtUsd(totalCost)}</b> de {fmtUsd(budget.monthUsd)} <DemoTag /></p>
            <ProgressBar value={totalCost / Math.max(0.01, budget.monthUsd)} color={totalCost / budget.monthUsd * 100 >= budget.alertPct ? '#ff537a' : '#00f5a0'} />
          </div>
          <p className="mt-2 text-[10.5px] text-lab-muted">A aplicação efetiva dos limites (bloqueio de execuções) será feita pelo backend na Fase 3.</p>
        </Panel>
      )}

      {tab === 'custos' && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <Panel accent="cyan" title="Custo estimado por agente (30d)" demo>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByAgent} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#26335e" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip formatter={(v) => fmtUsd(Number(v))} cursor={{ fill: 'rgba(57,214,255,0.08)' }} />
                  <Bar dataKey="custo" fill="#39d6ff" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel accent="gold" title="Custo por provedor (mês)" demo>
            <ul className="space-y-2">
              {providers.map((p) => (
                <li key={p.id} className="text-[11.5px]">
                  <div className="flex justify-between"><span className="flex items-center gap-1.5"><img src={providerIconUrl(p.id)} className="pixel h-4 w-4" alt="" />{p.name}</span><b>{fmtUsd(p.usage.costUsdMonth)}</b></div>
                  <ProgressBar value={totalCost ? p.usage.costUsdMonth / totalCost : 0} color={PROVIDER_COLORS[p.id]} height={7} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] text-lab-muted">Total estimado: <b className="text-lab-text">{fmtUsd(totalCost)}</b>. Estimativas identificadas conforme política de custos.</p>
          </Panel>
        </div>
      )}
    </div>
  )
}

/**
 * Perfis de credencial: várias chaves por provedor (ex.: "Gemini · chave 1", "Gemini · chave 2"),
 * atribuídas por agente no Agent Studio. A chave é enviada UMA vez ao backend, que a guarda
 * criptografada (Fernet) e nunca a devolve — o navegador só conhece alias e últimos 4 dígitos.
 */
function CredentialsTab() {
  const { providers, credentials, createCredential, deleteCredential, agents } = useLabStore()
  const [provider, setProvider] = useState<ProviderId>('gemini')
  const [alias, setAlias] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const real = appConfig.mode === 'real'
  const usage = (id: string) => agents.filter((a) => a.intelligence.credentialId === id)
  const submit = async () => {
    if (alias.trim().length < 3) return
    const c = await createCredential({ provider, alias: alias.trim(), apiKey: real ? apiKey.trim() || undefined : undefined })
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
                  <span className="text-[10.5px] text-lab-muted">{c.last4 ? `••••${c.last4}` : 'sem chave (perfil demo)'} · usado por {used.length} agente(s){used.length ? `: ${used.map((u) => u.name).join(', ')}` : ''}</span>
                </div>
                {c.status === 'demo' ? <DemoTag /> : <Chip color={c.status === 'invalid' ? '#ff537a' : '#00f5a0'}>{c.status === 'stored' ? 'armazenada' : c.status === 'valid' ? 'válida' : 'inválida'}</Chip>}
                <button className="text-lab-muted hover:text-neon-pink" onClick={() => setConfirm(c.id)} aria-label={`Excluir ${c.alias}`}><Trash2 size={14} /></button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-lab-muted">Atribua um perfil a cada agente em <b>Agent Studio → Inteligência → Chave de API</b>. Agentes sem perfil usam a chave padrão do provedor.</p>
      </Panel>
      <div className="flex flex-col gap-2.5">
        <Panel accent="green" title="Novo perfil de chave">
          <div className="space-y-2.5">
            <Field label="Provedor"><select className="px-input" value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Apelido" required hint="Ex.: Gemini · chave 2 (BI)"><input className="px-input" value={alias} onChange={(e) => setAlias(e.target.value)} data-testid="cred-alias" /></Field>
            <Field label="Chave de API" hint={real ? 'Enviada ao backend via HTTPS e armazenada criptografada. Nunca é salva no navegador.' : 'Desativado no modo demo: chaves reais exigem o backend (VITE_APP_MODE=real).'}>
              <input type="password" autoComplete="off" className="px-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={!real} placeholder={real ? 'cole a chave aqui' : 'disponível com o backend'} />
            </Field>
            <button className="px-btn solid w-full" onClick={submit} disabled={alias.trim().length < 3} data-testid="cred-create"><Plus size={14} /> Criar perfil</button>
          </div>
        </Panel>
        <Panel accent="cyan" title="Como as chaves são protegidas">
          <ul className="space-y-1.5 text-[11.5px]">
            <li className="flex gap-2"><ShieldCheck size={15} className="shrink-0 text-neon-green" /> Variáveis <code>VITE_*</code> são públicas: nenhuma chave vai para o bundle.</li>
            <li className="flex gap-2"><Server size={15} className="shrink-0 text-neon-cyan" /> O backend criptografa com <code>AGENTSLAB_MASTER_KEY</code> e expõe só alias e últimos 4 dígitos.</li>
            <li className="flex gap-2"><Lock size={15} className="shrink-0 text-neon-purple" /> Em execução, o LiteLLM usa a chave do perfil associado ao agente — permitindo dividir cotas entre chaves.</li>
          </ul>
        </Panel>
      </div>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && void deleteCredential(confirm)} title="Excluir perfil" message="Os agentes que usam este perfil voltarão para a chave padrão do provedor." confirmLabel="Excluir" />
    </div>
  )
}
