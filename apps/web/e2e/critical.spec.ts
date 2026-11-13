import { expect, test } from '@playwright/test'
import { ensureUser, login, useBackend } from './helpers'

const USER = `gestor-${Date.now()}@teste.dev`

test.describe('Offline (sem backend): somente exploração visual', () => {
  test.beforeEach(async ({ page, request }) => {
    await useBackend(page, false)
    await ensureUser(request, USER)
    await login(page, USER)
  })

  test('todas as rotas carregam sem erros e informam que o backend está desconectado', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const path of ['/', '/escritorio', '/laboratorio', '/organizacoes', '/ambientes', '/agentes', '/agentes/novo', '/projetos', '/fluxos', '/documentos', '/execucoes', '/provedores', '/provedores?tab=chaves', '/configuracoes']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
    }
    await page.goto('/projetos')
    await expect(page.getByTestId('offline-notice')).toBeVisible()
    await expect(page.getByTestId('backend-status')).toContainText('Offline')
    expect(errors).toEqual([])
  })

  test('não há gamificação (XP, níveis, missões)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('world-page')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/\bXP\b|Nível \d|Missões & Conquistas|Nova missão/)
    await page.goto('/gamificacao')
    await expect(page).toHaveURL(/\/$/)
  })

  test('mundo: cenário ocupa a área e o painel contextual abre e fecha', async ({ page }) => {
    await page.goto('/escritorio')
    const canvas = page.getByTestId('world-canvas').locator('canvas')
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    const vp = page.viewportSize()!
    expect(box.width * box.height).toBeGreaterThan(vp.width * vp.height * 0.6)
    await expect(page.getByTestId('overview-offline')).toBeVisible()
    await page.getByRole('button', { name: 'Modo gerenciamento' }).click()
    await page.getByTestId('management-panel').locator('li button').first().click()
    await expect(page.getByTestId('agent-panel')).toBeVisible()
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByLabel('Mensagem').fill('olá')
    await page.getByLabel('Enviar').click()
    await expect(page.getByTestId('agent-chat')).toContainText('Backend desconectado')
    await page.getByLabel('Fechar painel').click()
    await expect(page.getByTestId('agent-panel')).toHaveCount(0)
  })

  test('modo observador oculta a interface e Esc restaura', async ({ page }) => {
    await page.goto('/laboratorio')
    await page.getByRole('button', { name: 'Modo observador' }).click()
    await expect(page.getByTestId('sidebar')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sidebar')).toBeVisible()
  })

  test('troca de ambiente não duplica o canvas', async ({ page }) => {
    await page.goto('/escritorio')
    await page.getByRole('tab', { name: 'Laboratório' }).click()
    await expect(page).toHaveURL(/laboratorio/)
    await page.getByRole('tab', { name: 'Escritório' }).click()
    await expect(page.locator('canvas')).toHaveCount(1)
  })

  test('workflow: valida e pré-visualiza a ordem (sem simular execução)', async ({ page }) => {
    await page.goto('/fluxos')
    await page.reload()
    await expect(page.getByTestId('workflow-studio')).toBeVisible()
    await page.getByTestId('palette-tool').click()
    await page.getByTestId('run-workflow').click()
    await expect(page.getByText(/Ordem validada/)).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('Conectado à API (modo de teste determinístico)', () => {
  test.beforeEach(async ({ page, request }) => {
    await useBackend(page, true)
    await ensureUser(request, USER)
    await login(page, USER)
  })

  test('chave digitada no app vai para o cofre do backend e só os 4 últimos dígitos voltam', async ({ page }) => {
    await page.goto('/provedores?tab=chaves')
    await expect(page.getByTestId('backend-status')).toContainText('Conectado')
    await page.getByTestId('cred-alias').fill('Gemini · chave E2E')
    await page.getByPlaceholder('cole a chave aqui').fill('AIza-E2E-SECRET-9876')
    await page.getByTestId('cred-create').click()
    await expect(page.getByTestId('credentials-tab')).toContainText('••••9876')
    await expect(page.locator('body')).not.toContainText('AIza-E2E-SECRET')
    const stored = await page.evaluate(() => JSON.stringify(localStorage))
    expect(stored).not.toContain('SECRET')
  })

  test('projeto completo: prompt → plano → aprovação → execução → entrega → feedback → nova versão', async ({ page }) => {
    await page.goto('/projetos?novo=1')
    await page.getByTestId('project-request').fill('Pesquise aplicações de inteligência artificial na aeronáutica e entregue um relatório técnico com fontes.')
    await page.getByTestId('project-org').selectOption({ label: 'Laboratório de Pesquisa em IA' })
    await page.getByTestId('project-submit').click()
    await expect(page.getByTestId('project-workspace')).toBeVisible()
    await expect(page.getByTestId('plan-approve')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('plan-approve').click()
    // execução: estado dos agentes derivado das tarefas reais
    await expect(page.getByTestId('agent-status')).toBeVisible({ timeout: 20_000 })
    // entrega pronta → área Revisão + aviso de decisão do coordenador
    await expect(page.getByTestId('delivery-approve')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('decision-banner')).toContainText('Entrega pronta')
    await page.getByTestId('area-documentos').click()
    await expect(page.getByTestId('document-view')).toContainText('Referências')
    await expect(page.getByTestId('document-meta')).toContainText('Tarefa de origem')
    await page.getByRole('tab', { name: /Evidências/ }).click()
    await expect(page.getByTestId('evidence-table')).toContainText('E1')
    await expect(page.getByTestId('evidence-table')).toContainText('apenas resumo')
    await expect(page.getByTestId('evidence-table')).toContainText('Verificada')
    await page.getByTestId('area-conversas').click()
    await expect(page.getByTestId('message-timeline')).toContainText('Entrega')
    await page.getByTestId('area-revisao').click()
    await page.getByTestId('feedback-text').fill('Inclua uma seção sobre certificação.')
    await page.getByTestId('feedback-send').click()
    await expect(page.getByTestId('delivery-approve')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('revision-cycle')).toContainText('FB')
    await page.getByTestId('area-documentos').click()
    await expect(page.getByLabel('Versão')).toContainText('v3')
    await page.getByTestId('area-revisao').click()
    await page.getByTestId('delivery-approve').click()
    await expect(page.getByTestId('project-workspace')).toContainText('Concluído')
    await page.getByTestId('area-custos').click()
    await expect(page.getByTestId('executions-table')).toContainText('report')
    await expect(page.getByTestId('costs-breakdown')).toBeVisible()
  })

  test('organizações e agentes reais carregam; Agent Studio permite escolher organização', async ({ page }) => {
    await page.goto('/organizacoes')
    await expect(page.getByTestId('organizations-page')).toContainText('Laboratório de Pesquisa em IA')
    await expect(page.getByTestId('organizations-page')).toContainText('Escritório Empresarial')
    await page.goto('/agentes/novo')
    await expect(page.getByTestId('agent-org')).toBeVisible()
  })
})

test.describe('Reanalisar projeto e provedores (conectado)', () => {
  const U = `reanalise-${Date.now()}@teste.dev`
  test.beforeEach(async ({ page, request }) => {
    await useBackend(page, true)
    await ensureUser(request, U)
    await login(page, U)
  })

  test('sem chave o plano falha; após trocar o modelo da equipe, "Reanalisar" refaz o plano', async ({ page }) => {
    await page.goto('/projetos?novo=1')
    await page.getByTestId('project-request').fill('Pesquise aplicações de IA em satélites de observação da Terra com fontes verificáveis.')
    await page.getByTestId('project-org').selectOption({ label: 'Laboratório de Pesquisa em IA' })
    await page.getByTestId('project-submit').click()
    await expect(page.getByTestId('project-error')).toContainText('Nenhuma chave', { timeout: 20_000 })
    // cadastra chave do Groq e reanalisa trocando o modelo de toda a equipe
    const url = page.url()
    await page.goto('/provedores?tab=chaves')
    await page.locator('select').first().selectOption('groq')
    await page.getByTestId('cred-alias').fill('Groq E2E')
    await page.getByPlaceholder('cole a chave aqui').fill('gsk-E2E-000000001')
    await page.getByTestId('cred-create').click()
    await expect(page.getByTestId('credentials-tab')).toContainText('Groq E2E')
    await page.goto(url)
    await page.getByTestId('project-reanalyze').click()
    await page.getByTestId('reanalyze-apply').check()
    await page.getByTestId('reanalyze-provider').selectOption('groq')
    await page.getByTestId('reanalyze-model').fill('llama-e2e')
    await page.getByTestId('reanalyze-submit').click()
    await expect(page.getByTestId('plan-approve')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('area-custos').click()
    await expect(page.getByTestId('executions-table')).toContainText('groq/llama-e2e')
  })

  test('provedores: alterações ficam em rascunho até Salvar e persistem após recarregar', async ({ page }) => {
    await page.goto('/provedores')
    await expect(page.getByTestId('providers-dirty')).toContainText('salvas')
    await page.getByTestId('provider-openai').getByRole('switch').click()
    await page.getByLabel('Novo modelo para Gemini').fill('gemini-modelo-e2e')
    await page.getByTestId('provider-gemini').getByLabel('Adicionar modelo').click()
    await expect(page.getByTestId('providers-dirty')).toContainText('2 provedor(es)')
    await page.getByTestId('providers-save').click()
    await expect(page.getByTestId('providers-dirty')).toContainText('salvas')
    await page.reload()
    await expect(page.getByTestId('default-model-gemini')).toHaveValue('gemini-modelo-e2e')
    await expect(page.getByTestId('provider-openai')).toContainText('Desativado')
  })
})
