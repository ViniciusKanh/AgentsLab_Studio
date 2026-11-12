import { appConfig } from './config'
import type { LabDataSource } from './dataSource'
import { createDemoDataSource } from './demo/demoDataSource'
import { createApiDataSource } from './api/apiDataSource'

/** Fonte de dados ativa — trocada apenas por VITE_APP_MODE, sem alterar as páginas. */
export const dataSource: LabDataSource = appConfig.mode === 'real' ? createApiDataSource(appConfig.apiBaseUrl) : createDemoDataSource()

export { appConfig }
