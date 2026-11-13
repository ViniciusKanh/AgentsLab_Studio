import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Link, Navigate, useRouteError } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

const WorldPage = lazy(() => import('@/features/world/WorldPage'))
const EnvironmentsPage = lazy(() => import('@/features/environments/EnvironmentsPage'))
const EnvironmentViewPage = lazy(() => import('@/features/environments/EnvironmentsPage').then((m) => ({ default: m.EnvironmentViewPage })))
const AgentsPage = lazy(() => import('@/features/agents/AgentsPage'))
const AgentStudioPage = lazy(() => import('@/features/agents/AgentStudioPage'))
const AgentProfilePage = lazy(() => import('@/features/agents/AgentProfilePage'))
const WorkflowStudioPage = lazy(() => import('@/features/workflows/WorkflowStudioPage'))
const ModelsPage = lazy(() => import('@/features/models/ModelsPage'))
const RunsPage = lazy(() => import('@/features/analytics/RunsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const OrganizationsPage = lazy(() => import('@/features/organizations/OrganizationsPage'))
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'))
const ProjectWorkspacePage = lazy(() => import('@/features/projects/ProjectWorkspacePage'))
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'))
const Auth = () => import('@/features/auth/AuthPages')
const LoginPage = lazy(() => Auth().then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => Auth().then((m) => ({ default: m.RegisterPage })))
const CheckEmailPage = lazy(() => Auth().then((m) => ({ default: m.CheckEmailPage })))
const ForgotPasswordPage = lazy(() => Auth().then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => Auth().then((m) => ({ default: m.ResetPasswordPage })))
const AuthConfirmPage = lazy(() => Auth().then((m) => ({ default: m.AuthConfirmPage })))
const LegalPage = lazy(() => Auth().then((m) => ({ default: m.LegalPage })))
const RequireAuth = lazy(() => Auth().then((m) => ({ default: m.RequireAuth })))
const PublicOnly = lazy(() => Auth().then((m) => ({ default: m.PublicOnly })))

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
  // rotas públicas (autenticação)
  { path: '/entrar', element: S(<PublicOnly><LoginPage /></PublicOnly>), errorElement: <RouteError /> },
  { path: '/cadastro', element: S(<PublicOnly><RegisterPage /></PublicOnly>), errorElement: <RouteError /> },
  { path: '/verificar-email', element: S(<CheckEmailPage />), errorElement: <RouteError /> },
  { path: '/recuperar-senha', element: S(<ForgotPasswordPage />), errorElement: <RouteError /> },
  { path: '/redefinir-senha', element: S(<ResetPasswordPage />), errorElement: <RouteError /> },
  { path: '/auth/confirm', element: S(<AuthConfirmPage />), errorElement: <RouteError /> },
  { path: '/termos', element: S(<LegalPage kind="termos" />) },
  { path: '/privacidade', element: S(<LegalPage kind="privacidade" />) },
  // rotas privadas
  {
    path: '/',
    element: S(<RequireAuth><AppShell /></RequireAuth>),
    errorElement: <RouteError />,
    children: [
      { index: true, element: S(<WorldPage />), handle: immersive },
      { path: 'escritorio', element: S(<WorldPage key="office" envId="office" />), handle: immersive },
      { path: 'laboratorio', element: S(<WorldPage key="research" envId="research" />), handle: immersive },
      { path: 'organizacoes', element: S(<OrganizationsPage />) },
      { path: 'ambientes', element: S(<EnvironmentsPage />) },
      { path: 'ambientes/:envId', element: S(<EnvironmentViewPage />) },
      { path: 'agentes', element: S(<AgentsPage />) },
      { path: 'agentes/novo', element: S(<AgentStudioPage key="novo" />) },
      { path: 'agentes/:agentId', element: S(<AgentProfilePage />) },
      { path: 'agentes/:agentId/editar', element: S(<AgentStudioPage />) },
      { path: 'projetos', element: S(<ProjectsPage />) },
      { path: 'projetos/:projectId', element: S(<ProjectWorkspacePage />) },
      { path: 'fluxos', element: S(<WorkflowStudioPage />) },
      { path: 'documentos', element: S(<DocumentsPage />) },
      { path: 'execucoes', element: S(<RunsPage />) },
      { path: 'provedores', element: S(<ModelsPage />) },
      { path: 'configuracoes', element: S(<SettingsPage />) },
      // endereços antigos
      { path: 'workflows', element: <Navigate to="/fluxos" replace /> },
      { path: 'modelos', element: <Navigate to="/provedores" replace /> },
      { path: 'conhecimento', element: <Navigate to="/documentos" replace /> },
      { path: 'painel', element: <Navigate to="/" replace /> },
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'gamificacao', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routes)
