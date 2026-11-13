import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, DoorOpen, FolderPlus, Plus, Trash2, UserPlus, X } from 'lucide-react'
import type { OrgTemplate } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { Avatar, Chip, Field, Panel } from '@/components/ui/primitives'
import { ConfirmModal } from '@/components/ui/Modal'
import { OfflineNotice } from '@/components/ui/OfflineNotice'
import { envPath, getWorldMap } from '@/world/maps'

/** Organizações: departamentos, equipe de agentes e ambiente de trabalho. */
export default function OrganizationsPage() {
  const { organizations, agents, loadOrganizations } = useLabStore()
  const toast = useUiStore((s) => s.toast)
  const nav = useNavigate()
  const [templates, setTemplates] = useState<OrgTemplate[]>([])
  const [form, setForm] = useState<{ name: string; template: string } | null>(null)
  const [dep, setDep] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<string | null>(null)
  const real = appConfig.mode === 'real'
  useEffect(() => { if (real) platform.templates().then(setTemplates).catch(() => undefined) }, [real])
  if (!real) return <OfflineNotice what="Organizações e departamentos" />

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok, 'success'); await loadOrganizations() } catch (err) { toast((err as Error).message, 'error') }
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="organizations-page">
      <div className="px-panel c-cyan flex flex-wrap items-center gap-3 px-3 py-2">
        <Building2 size={30} className="text-neon-cyan" />
        <div className="min-w-0 flex-1"><h1 className="title-pixel text-[15px]">Organizações</h1><p className="text-[12px] text-lab-muted">Cada organização tem departamentos, uma equipe de agentes (com um coordenador) e um ambiente.</p></div>
        <button className="px-btn solid" onClick={() => setForm({ name: '', template: templates[0]?.id ?? 'custom' })}><Plus size={14} /> Nova organização</button>
      </div>

      {form && (
        <Panel accent="green" title="Nova organização" actions={<button onClick={() => setForm(null)} aria-label="Fechar"><X size={14} /></button>}>
          <div className="grid gap-2 md:grid-cols-[1fr_260px_auto] md:items-end">
            <Field label="Nome" required><input className="px-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Modelo"><select className="px-input" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="custom">Personalizada (vazia)</option></select></Field>
            <button className="px-btn solid" disabled={form.name.trim().length < 3} onClick={() => void run(() => platform.createOrganization({ name: form.name.trim(), template: form.template }), 'Organização criada').then(() => setForm(null))}>Criar</button>
          </div>
          {templates.find((t) => t.id === form.template) && <p className="mt-2 text-[11px] text-lab-muted">Departamentos: {templates.find((t) => t.id === form.template)!.departments.join(', ')}. Papéis sugeridos: {templates.find((t) => t.id === form.template)!.roles.join(', ')} — crie os agentes no Agent Studio.</p>}
        </Panel>
      )}

      {organizations.map((o) => {
        const team = agents.filter((a) => a.organizationId === o.id)
        return (
          <Panel key={o.id} accent="purple" title={<span className="flex items-center gap-2">{o.name} <Chip color="#39d6ff">{getWorldMap(o.environmentId).name}</Chip></span>} actions={
            <div className="flex gap-1.5">
              <Link to={envPath(o.environmentId)} className="px-btn sm ghost"><DoorOpen size={13} /> Ambiente</Link>
              <button className="px-btn sm" onClick={() => nav('/projetos?novo=1')}><FolderPlus size={13} /> Projeto</button>
              <button className="px-btn sm" onClick={() => nav(`/agentes/novo?organizacao=${o.id}&ambiente=${o.environmentId}`)}><UserPlus size={13} /> Agente</button>
              <button className="text-lab-muted hover:text-neon-pink" onClick={() => setConfirm(o.id)} aria-label={`Excluir ${o.name}`}><Trash2 size={14} /></button>
            </div>
          }>
            <p className="mb-2 text-[11.5px] text-lab-muted">{o.description}</p>
            <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="px-label">Departamentos</p>
                <div className="flex flex-wrap gap-1">
                  {o.departments.map((d) => (
                    <span key={d.id} className="flex items-center gap-1 rounded-[4px] bg-white/5 px-2 py-0.5 text-[11px]">{d.name}
                      <button className="text-lab-muted hover:text-neon-pink" onClick={() => void run(() => platform.deleteDepartment(o.id, d.id), 'Departamento removido')} aria-label={`Remover ${d.name}`}><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <input className="px-input py-1 text-[11px]" placeholder="Novo departamento" value={dep[o.id] ?? ''} onChange={(e) => setDep({ ...dep, [o.id]: e.target.value })} />
                  <button className="px-btn sm" disabled={(dep[o.id] ?? '').trim().length < 2} onClick={() => void run(() => platform.addDepartment(o.id, dep[o.id].trim()), 'Departamento adicionado').then(() => setDep({ ...dep, [o.id]: '' }))}><Plus size={12} /></button>
                </div>
              </div>
              <div>
                <p className="px-label">Equipe ({team.length})</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {team.map((a) => (
                    <Link key={a.id} to={`/agentes/${a.id}`} className="px-inset flex items-center gap-2 px-2 py-1.5 hover:border-neon-green/60">
                      <Avatar characterId={a.appearance.characterId} size={30} />
                      <span className="min-w-0"><b className="block truncate text-[11.5px]">{a.name}</b><span className="block truncate text-[10px] text-lab-muted">{a.role} · {a.department}</span></span>
                      {a.isCoordinator && <Chip color="#ffb800" className="ml-auto">coord.</Chip>}
                    </Link>
                  ))}
                  {team.length === 0 && <p className="text-[11px] text-lab-muted">Sem agentes. Crie um no Agent Studio e marque um como coordenador.</p>}
                </div>
              </div>
            </div>
          </Panel>
        )
      })}
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm && void run(() => platform.deleteOrganization(confirm), 'Organização excluída')} title="Excluir organização" message="Os agentes continuam existindo, mas ficam sem organização. Projetos permanecem no histórico." confirmLabel="Excluir" />
    </div>
  )
}
