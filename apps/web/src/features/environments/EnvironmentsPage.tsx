import { Link, Navigate, useParams } from 'react-router-dom'
import { Building2, DoorOpen, Lock, Users } from 'lucide-react'
import { ENVIRONMENTS } from '@/services/demo/demoData'
import { useLabStore } from '@/stores/labStore'
import { useLevel } from '@/stores/gameStore'
import { useSimulationStore } from '@/stores/simulationStore'
import { Chip, Panel, PlannedBadge, cx } from '@/components/ui/primitives'
import { envPath } from '@/world/maps'

const thumb = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

export default function EnvironmentsPage() {
  const agents = useLabStore((s) => s.agents)
  const runtime = useSimulationStore((s) => s.runtime)
  const { level } = useLevel()
  return (
    <div className="flex flex-col gap-2.5" data-testid="environments-page">
      <div className="px-panel c-cyan flex items-center gap-3 px-3 py-2">
        <Building2 size={30} className="text-neon-cyan" />
        <div>
          <h1 className="title-pixel text-[15px]">Ambientes (Salas Temáticas)</h1>
          <p className="text-[12px] text-lab-muted">Escolha uma sala para acompanhar seus agentes. Salas marcadas como <b>planejado</b> ainda não estão implementadas.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {ENVIRONMENTS.map((e) => {
          const inRoom = agents.filter((a) => a.environmentId === e.id && a.status !== 'archived')
          const busy = inRoom.filter((a) => runtime[a.id] && runtime[a.id].state !== 'idle' && runtime[a.id].state !== 'paused').length
          const impl = e.availability === 'implemented'
          return (
            <article key={e.id} className="px-panel flex flex-col overflow-hidden" style={{ ['--c' as string]: e.accent }} data-testid={`env-card-${e.id}`}>
              <div className="relative">
                <img src={thumb(e.thumbnail)} alt={`Miniatura ${e.name}`} className={cx('pixel aspect-[2/1] w-full object-cover', !impl && 'opacity-60 saturate-50')} />
                {!impl && <div className="absolute inset-0 grid place-items-center bg-[#050913]/40"><span className="flex items-center gap-1.5 rounded-[3px] border border-neon-purple bg-[#0b0820]/90 px-2 py-1 text-[11px] font-bold text-neon-purple"><Lock size={12} /> Planejado · desbloqueio no nível {e.unlockLevel}</span></div>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-extrabold" style={{ color: e.accent }}>{e.name}</h2>
                  {impl ? <Chip color="#00f5a0">Disponível</Chip> : <PlannedBadge />}
                </div>
                <p className="text-[11.5px] text-lab-muted">{e.description}</p>
                <div className="mt-auto flex items-center gap-3 pt-1 text-[11px]">
                  <span className="flex items-center gap-1"><Users size={13} /> {inRoom.length} agentes</span>
                  {impl && <span className="flex items-center gap-1 text-neon-green">● {busy} em atividade</span>}
                  {impl ? (
                    <Link to={envPath(e.id)} className="px-btn sm solid ml-auto"><DoorOpen size={13} /> Entrar</Link>
                  ) : (
                    <span className="ml-auto text-[10.5px] text-lab-muted">{level >= e.unlockLevel ? 'Nível atingido — implementação na Fase 5' : `Requer nível ${e.unlockLevel}`}</span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <Panel accent="purple" title="Sobre os ambientes">
        <p className="text-[11.5px] leading-relaxed text-lab-muted">Cada ambiente é um mapa em grade (tilemap de navegação + atlas de objetos) gerado por <code>tools/pixelart/world_maps.py</code>. Os personagens caminham com A*, usam objetos e conversam (camada ambiental) e obedecem aos estados operacionais dos agentes (camada operacional).</p>
      </Panel>
    </div>
  )
}

export function EnvironmentViewPage() {
  const { envId = 'office' } = useParams()
  const env = ENVIRONMENTS.find((e) => e.id === envId)
  if (!env || env.availability !== 'implemented') {
    return (
      <Panel accent="purple" title={env?.name ?? 'Ambiente não encontrado'}>
        {env && <img src={thumb(env.thumbnail)} alt="" className="pixel mb-3 w-full max-w-3xl opacity-70" />}
        <p className="text-[12px] text-lab-muted">Este ambiente está <b className="text-neon-purple">planejado</b> e ainda não possui simulação navegável. <Link className="text-neon-cyan" to="/ambientes">Voltar à galeria</Link></p>
      </Panel>
    )
  }
  return <Navigate to={envPath(env.id)} replace />
}
