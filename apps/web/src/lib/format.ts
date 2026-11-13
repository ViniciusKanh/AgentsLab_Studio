const nf = new Intl.NumberFormat('pt-BR')

export const fmtInt = (n: number) => nf.format(Math.round(n))

export function fmtCompact(n: number) {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`
  return fmtInt(n)
}

export const fmtUsd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fmtPct = (n: number, d = 1) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
export const fmtSec = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `Há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `Há ${h} h`
  return `Há ${Math.round(h / 24)} d`
}

export const fmtClock = (isoStr: string) => new Date(isoStr).toLocaleTimeString('pt-BR', { hour12: false })
export const fmtDate = (isoStr: string) => new Date(isoStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
/** Custos de LLM costumam ser frações de centavo: até 4 casas. */
export const fmtCost = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`
/** Modelo efetivo exibido: vazio = padrão do provedor. */
export const modelLabel = (model: string, providerDefault?: string) => model || (providerDefault ? `${providerDefault} (padrão)` : 'padrão do provedor')
