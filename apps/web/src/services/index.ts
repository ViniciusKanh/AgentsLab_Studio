import { appConfig } from './config'
import type { LabDataSource } from './dataSource'
import { createDemoDataSource } from './demo/demoDataSource'
import { createApiDataSource } from './api/apiDataSource'

const demo = createDemoDataSource()
const real = createApiDataSource()

/**
 * Fonte de dados ativa, decidida em tempo de execução:
 * backend conectado → API real; sem backend → exemplos locais (somente visualização).
 */
export const dataSource: LabDataSource = new Proxy({} as LabDataSource, {
  get(_t, prop) {
    const ds = appConfig.mode === 'real' ? real : demo
    const v = ds[prop as keyof LabDataSource]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(ds) : v
  },
})

export { appConfig }
