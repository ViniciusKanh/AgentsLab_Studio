import { useSearchParams } from 'react-router-dom'
import { Crown, Gift, Lock, Star, Swords, Trophy } from 'lucide-react'
import { ACHIEVEMENTS, MISSIONS, useGameStore, useLevel, xpForLevel } from '@/stores/gameStore'
import { ENVIRONMENTS } from '@/services/demo/demoData'
import { Avatar, Chip, Panel, PixelIcon, ProgressBar, Tabs, cx } from '@/components/ui/primitives'
import { useLabStore } from '@/stores/labStore'
import { useUiStore } from '@/stores/uiStore'
import { fmtInt, timeAgo } from '@/lib/format'

type T = 'missoes' | 'conquistas' | 'nivel' | 'recompensas'

export default function GamificationPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as T) || 'missoes'
  const { counters, claimed, claimMission, credits, history } = useGameStore()
  const { xp, level, cur, next, pct } = useLevel()
  const agents = useLabStore((s) => s.agents)
  const toast = useUiStore((s) => s.toast)

  return (
    <div className="flex flex-col gap-2.5" data-testid="gamification-page">
      <div className="px-panel c-gold flex flex-wrap items-center gap-4 px-3 py-3">
        <Avatar characterId="vinicius" size={64} ring="#ffb800" />
        <div className="min-w-[220px] flex-1">
          <h1 className="title-pixel flex items-center gap-2 text-[14px]"><Crown size={18} className="text-neon-gold" /> Meu Reino — Nível {level}</h1>
          <p className="mt-1 text-[11.5px] text-lab-muted">XP: <b className="text-lab-text">{fmtInt(xp)}</b> · próximo nível em {fmtInt(next)} XP</p>
          <ProgressBar value={pct} color="#ffb800" className="mt-1 max-w-md" />
        </div>
        <div className="px-inset flex items-center gap-2 px-3 py-2"><PixelIcon name="gem" size={28} /><span><span className="block text-[10.5px] text-lab-muted">Créditos (fictícios)</span><b className="title-pixel text-[13px]">{fmtInt(credits)}</b></span></div>
        <p className="w-full text-[10.5px] text-lab-muted">XP e créditos são pontos de jogo obtidos por ações verificáveis no sistema e <b>não</b> têm relação com tokens ou custos reais de provedores.</p>
      </div>
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} items={[{ id: 'missoes', label: 'Missões' }, { id: 'conquistas', label: 'Conquistas' }, { id: 'nivel', label: 'Nível e XP' }, { id: 'recompensas', label: 'Recompensas' }]} />

      {tab === 'missoes' && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {MISSIONS.map((m) => {
            const p = Math.min(m.target, m.progress(counters))
            const done = p >= m.target
            const isClaimed = claimed.includes(m.id)
            return (
              <article key={m.id} className={cx('px-panel p-3', isClaimed ? 'c-green opacity-80' : done ? 'c-gold' : 'c-purple')} data-testid={`mission-${m.id}`}>
                <div className="flex items-start gap-2">
                  <Swords size={18} className="mt-0.5 text-neon-gold" />
                  <div className="flex-1"><p className="text-[13px] font-extrabold">{m.title}</p><p className="text-[11px] text-lab-muted">{m.description}</p></div>
                </div>
                <div className="mt-2 flex items-center gap-2"><ProgressBar value={p / m.target} className="flex-1" color={done ? '#ffb800' : '#00f5a0'} /><span className="text-[11px] font-bold">{p}/{m.target}</span></div>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <Chip color="#ffb800">+{m.rewardXp} XP</Chip><Chip color="#39d6ff">+{m.rewardCredits} créditos</Chip>
                  {isClaimed ? <span className="ml-auto font-bold text-neon-green">Recompensa resgatada</span> : (
                    <button className="px-btn sm solid ml-auto" disabled={!done} onClick={() => claimMission(m.id) && toast(`Missão concluída: +${m.rewardXp} XP`, 'success')}>Resgatar</button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {tab === 'conquistas' && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {ACHIEVEMENTS.map((a) => {
            const ok = a.check(counters, level)
            return (
              <div key={a.id} className={cx('px-panel flex flex-col items-center gap-1.5 p-3 text-center', ok ? 'c-gold' : 'c-purple')}>
                <div className={cx('relative', !ok && 'opacity-40 grayscale')}><PixelIcon name={a.icon} size={40} />{!ok && <Lock size={14} className="absolute -bottom-1 -right-1 text-lab-muted" />}</div>
                <p className="text-[12px] font-extrabold">{a.title}</p>
                <p className="text-[10.5px] text-lab-muted">{a.description}</p>
                {ok ? <Chip color="#00f5a0">Desbloqueada</Chip> : <Chip color="#8b97c4">Bloqueada</Chip>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'nivel' && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <Panel accent="gold" title="Histórico de XP" icon={<Star size={16} />}>
            {history.length === 0 ? <p className="text-[12px] text-lab-muted">Nenhuma ação registrada ainda. Crie um agente ou salve um workflow para ganhar XP.</p> : (
              <ul className="space-y-1">{history.map((h) => <li key={h.id} className="flex justify-between border-b border-white/5 pb-1 text-[11.5px]"><span>{h.label}</span><span><b className="text-neon-gold">+{h.xp} XP</b> <span className="text-lab-muted">· {timeAgo(h.ts)}</span></span></li>)}</ul>
            )}
          </Panel>
          <Panel accent="purple" title="Progressão" icon={<Trophy size={16} />}>
            <ul className="space-y-1 text-[11.5px]">
              {Array.from({ length: 8 }, (_, i) => level - 1 + i).filter((n) => n >= 1).slice(0, 7).map((n) => (
                <li key={n} className={cx('flex justify-between rounded-[3px] px-2 py-1', n === level && 'bg-neon-gold/15 font-bold text-neon-gold')}><span>Nível {n}</span><span>{fmtInt(xpForLevel(n))} XP</span></li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] text-lab-muted">Ações: agente criado +120 · workflow salvo +80 · simulação de fluxo +60 · novo ambiente +40 · tarefa acompanhada +5. XP atual do nível: {fmtInt(xp - cur)}.</p>
          </Panel>
          <Panel accent="cyan" title="Evolução dos agentes" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
              {agents.map((a) => (
                <div key={a.id} className="px-inset flex items-center gap-2 p-2">
                  <Avatar characterId={a.appearance.characterId} size={32} ring={a.appearance.accentColor} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{a.name}</p><p className="text-[10px] text-lab-muted">Nv. {a.level}</p><ProgressBar value={a.xp / (a.level * 600)} height={5} color="#ffb800" /></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'recompensas' && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {ENVIRONMENTS.map((e) => {
            const unlocked = level >= e.unlockLevel
            return (
              <article key={e.id} className={cx('px-panel overflow-hidden', unlocked ? 'c-green' : 'c-purple')}>
                <img src={`${import.meta.env.BASE_URL}${e.thumbnail.replace(/^\//, '')}`} alt="" className={cx('pixel aspect-[2/1] w-full object-cover', !unlocked && 'opacity-40 grayscale')} />
                <div className="flex items-center gap-2 p-2.5 text-[11.5px]">
                  <Gift size={15} className="text-neon-gold" /><b className="flex-1">{e.name}</b>
                  {unlocked ? <Chip color="#00f5a0">{e.availability === 'implemented' ? 'Desbloqueado' : 'Desbloqueado · planejado'}</Chip> : <Chip color="#8b97c4">Nível {e.unlockLevel}</Chip>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
