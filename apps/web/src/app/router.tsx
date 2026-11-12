import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Link, Navigate, useRouteError } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

const WorldPage = lazy(() => import('@/features/world/WorldPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const EnvironmentsPage = lazy(() => import('@/features/environments/EnvironmentsPage'))
const EnvironmentViewPage = lazy(() => import('@/features/environments/EnvironmentsPage').then((m) => ({ default: m.EnvironmentViewPage })))
const AgentsPage = lazy(() => import('@/features/agents/AgentsPage'))
const AgentStudioPage = lazy(() => import('@/features/agents/AgentStudioPage'))
const AgentProfilePage = lazy(() => import('@/features/agents/AgentProfilePage'))
const WorkflowStudioPage = lazy(() => import('@/features/workflows/WorkflowStudioPage'))
const ModelsPage = lazy(() => import('@/features/models/ModelsPage'))
const KnowledgePage = lazy(() => import('@/features/knowledge/KnowledgePage'))
const RunsPage = lazy(() => import('@/features/analytics/RunsPage'))
const GamificationPage = lazy(() => import('@/features/gamification/GamificationPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const PlannedPage = lazy(() => import('@/features/planned/PlannedPage'))

const S = (el: ReactNode) => <Suspense fallback={<p className="title-pixel animate-blink p-6 text-[10px] text-lab-muted">Carregando…</p>}>{el}</Suspense>

function NotFound() {
  return (
    <div className="px-panel c-pink p-6 text-center">
      <p className="title-pixel text-[14px]">404 — Sala não encontrada</p>
      <Link to="/" className="px-btn mt-4">Voltar ao início</Link>
    </div>
  )
}

function RouteError() {
  const err = useRouteError() as Error | undefined
  return (
    <div className="lab-backdrop grid h-full place-items-center p-6">
      <div className="px-panel c-pink max-w-lg p-6 text-center">
        <p className="title-pixel text-[13px]">Ops! Algo deu errado nesta tela</p>
        <p className="mt-3 font-mono text-[11px] text-lab-muted">{err?.message ?? 'Erro desconhecido'}</p>
        <a href="/" className="px-btn mt-4">Recarregar o laboratório</a>
      </div>
    </div>
  )
}

const immersive = { immersive: true }

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: S(<WorldPage />), handle: immersive },
      { path: 'escritorio', element: S(<WorldPage key="office" envId="office" />), handle: immersive },
      { path: 'laboratorio', element: S(<WorldPage key="research" envId="research" />), handle: immersive },
      { path: 'painel', element: S(<DashboardPage />) },
      { path: 'ambientes', element: S(<EnvironmentsPage />) },
      { path: 'ambientes/:envId', element: S(<EnvironmentViewPage />) },
      { path: 'agentes', element: S(<AgentsPage />) },
      { path: 'agentes/novo', element: S(<AgentStudioPage key="novo" />) },
      { path: 'agentes/:agentId', element: S(<AgentProfilePage />) },
      { path: 'agentes/:agentId/editar', element: S(<AgentStudioPage />) },
      { path: 'workflows', element: S(<WorkflowStudioPage />) },
      { path: 'modelos', element: S(<ModelsPage />) },
      { path: 'conhecimento', element: S(<KnowledgePage />) },
      { path: 'execucoes', element: S(<RunsPage />) },
      { path: 'gamificacao', element: S(<GamificationPage />) },
      { path: 'configuracoes', element: S(<SettingsPage />) },
      { path: 'projetos', element: S(<PlannedPage id="projetos" />) },
      { path: 'ferramentas', element: S(<PlannedPage id="ferramentas" />) },
      { path: 'experimentos', element: S(<PlannedPage id="experimentos" />) },
      { path: 'avaliacao', element: S(<PlannedPage id="avaliacao" />) },
      { path: 'dashboard', element: <Navigate to="/painel" replace /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
