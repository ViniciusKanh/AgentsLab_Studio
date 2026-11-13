import { Bot, Building2, Cpu, FileText, FolderKanban, Home, Map, ScrollText, Settings, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  planned?: boolean
  end?: boolean
}

/** Navegação principal da plataforma de organizações multiagentes. */
export const NAV_MAIN: NavItem[] = [
  { to: '/', label: 'Visão Geral', icon: Home, end: true },
  { to: '/organizacoes', label: 'Organizações', icon: Building2 },
  { to: '/ambientes', label: 'Ambientes', icon: Map },
  { to: '/agentes', label: 'Agentes', icon: Bot },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/fluxos', label: 'Tarefas e Fluxos', icon: Workflow },
  { to: '/documentos', label: 'Documentos', icon: FileText },
  { to: '/execucoes', label: 'Execuções', icon: ScrollText },
  { to: '/provedores', label: 'Provedores e Custos', icon: Cpu },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]
