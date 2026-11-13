import { useEffect, useMemo, useState } from 'react'
import type { Execution } from '@/types/platform'
import { appConfig } from '@/services/config'
import { platform } from '@/services/platform'
import { onPlatformEvent } from '@/services/realtime'

/** Uso REAL de um agente, calculado das execuções registradas no backend. */
export function useAgentUsage(agentId: string | undefined) {
  const [all, setAll] = useState<Execution[]>([])
  useEffect(() => {
    if (!agentId || appConfig.mode !== 'real') return
    let alive = true
    const load = () => platform.allExecutions(1000).then((x) => { if (alive) setAll(x) }).catch(() => undefined)
    void load()
    const off = onPlatformEvent((e) => { if (e.type === 'execution' && e.payload.agentId === agentId) void load() })
    return () => { alive = false; off() }
  }, [agentId])
  return useMemo(() => {
    const items = all.filter((e) => e.agentId === agentId)
    const calls = items.length
    return {
      items,
      calls,
      errors: items.filter((e) => e.status === 'error').length,
      tokens: items.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0),
      costUsd: items.reduce((s, e) => s + e.costUsd, 0),
      avgLatencyMs: calls ? items.reduce((s, e) => s + e.latencyMs, 0) / calls : 0,
    }
  }, [all, agentId])
}
