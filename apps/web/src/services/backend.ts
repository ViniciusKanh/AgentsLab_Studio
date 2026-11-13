import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { appConfig, setRuntimeMode } from './config'

export type BackendStatus = 'checking' | 'online' | 'offline'

/**
 * Conexão com o backend local (FastAPI). As chaves de API e toda execução de IA
 * ficam no backend; o navegador só guarda o endereço.
 */
interface BackendState {
  baseUrl: string
  status: BackendStatus
  version: string | null
  lastError: string | null
  setBaseUrl: (url: string) => void
  check: () => Promise<boolean>
}

export const useBackendStore = create<BackendState>()(
  persist(
    (set, get) => ({
      baseUrl: appConfig.defaultApiBaseUrl,
      status: 'checking',
      version: null,
      lastError: null,
      setBaseUrl: (url) => set({ baseUrl: url.trim().replace(/\/$/, '') }),
      async check() {
        set({ status: 'checking' })
        try {
          const ctrl = new AbortController()
          // servidor remoto gratuito pode estar acordando (Render): espera mais que o local
          const local = /localhost|127\.0\.0\.1/.test(get().baseUrl)
          const t = setTimeout(() => ctrl.abort(), local ? 3500 : 15000)
          const res = await fetch(`${get().baseUrl}/health`, { signal: ctrl.signal })
          clearTimeout(t)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const body = (await res.json()) as { version?: string }
          setRuntimeMode('real')
          set({ status: 'online', version: body.version ?? null, lastError: null })
          return true
        } catch (err) {
          setRuntimeMode('demo')
          set({ status: 'offline', lastError: (err as Error).message })
          return false
        }
      },
    }),
    { name: 'agentslab:backend:v1', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ baseUrl: s.baseUrl }) },
  ),
)

export const apiBase = () => useBackendStore.getState().baseUrl
