/**
 * Configuração pública do frontend (variáveis VITE_*).
 * ATENÇÃO: tudo que começa com VITE_ é embutido no bundle — nunca use para segredos.
 *
 * O modo NÃO é mais fixo no build: o app tenta o backend local (URL configurável em
 * Configurações). Conectado → 'real' (agentes executam de verdade). Sem backend → 'demo'
 * (apenas exploração visual com agentes de exemplo; nenhuma tarefa é executada).
 */
export type AppMode = 'demo' | 'real'

let runtimeMode: AppMode = 'demo'

export function setRuntimeMode(m: AppMode) {
  runtimeMode = m
}

export const appConfig = {
  name: (import.meta.env.VITE_APP_NAME as string | undefined) || 'AgentsLab_Studio',
  /** Endereço inicial do backend; pode ser alterado em Configurações. */
  defaultApiBaseUrl: ((import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000').replace(/\/$/, ''),
  get mode(): AppMode {
    return runtimeMode
  },
  version: '1.2.0',
}

export const isDemo = () => appConfig.mode === 'demo'
