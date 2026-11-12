/**
 * Configuração pública do frontend (variáveis VITE_*).
 * ATENÇÃO: tudo que começa com VITE_ é embutido no bundle — nunca use para segredos.
 */
export type AppMode = 'demo' | 'real'

export const appConfig = {
  name: (import.meta.env.VITE_APP_NAME as string | undefined) || 'AgentsLab_Studio',
  mode: ((import.meta.env.VITE_APP_MODE as string | undefined) === 'real' ? 'real' : 'demo') as AppMode,
  apiBaseUrl: ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/$/, ''),
  version: '1.0.0',
}

export const isDemo = () => appConfig.mode === 'demo'
