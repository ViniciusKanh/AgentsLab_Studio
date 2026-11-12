import { Bot, Building2, Database, FlaskConical, FolderKanban, Gauge, Home, LayoutDashboard, ScrollText, Settings, Sparkles, Trophy, Workflow, Cpu } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  planned?: boolean
  end?: boolean
}

/** Navegação principal (Environment First). */
export const NAV_MAIN: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/escritorio', label: 'Escritório', icon: Building2 },
  { to: '/laboratorio', label: 'Laboratório', icon: FlaskConical },
  { to: '/agentes', label: 'Agentes', icon: Bot },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban, planned: true },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/experimentos', label: 'Experimentos', icon: Sparkles, planned: true },
  { to: '/modelos', label: 'Modelos', icon: Cpu },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

/** Ferramentas de apoio (o painel de métricas deixou de ser a tela principal). */
export const NAV_MORE: NavItem[] = [
  { to: '/painel', label: 'Painel de métricas', icon: LayoutDashboard },
  { to: '/ambientes', label: 'Ambientes', icon: Gauge },
  { to: '/conhecimento', label: 'Conhecimento', icon: Database },
  { to: '/execucoes', label: 'Execuções', icon: ScrollText },
  { to: '/gamificacao', label: 'Missões & Conquistas', icon: Trophy },
]
