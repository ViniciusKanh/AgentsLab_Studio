import { expect, test } from '@playwright/test'

test.describe('AgentsLab_Studio — fluxos críticos (modo demo)', () => {
  test('todas as rotas principais carregam sem erros', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const path of ['/', '/escritorio', '/laboratorio', '/painel', '/ambientes', '/agentes', '/agentes/novo', '/workflows', '/modelos', '/modelos?tab=chaves', '/conhecimento', '/execucoes', '/gamificacao', '/configuracoes', '/projetos']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('rota interna funciona após recarregar (fallback SPA)', async ({ page }) => {
    await page.goto('/workflows')
    await page.reload()
    await expect(page.getByTestId('workflow-studio')).toBeVisible()
  })

  test('mundo: cenário ocupa a área, personagens aparecem e o painel contextual abre e fecha', async ({ page }) => {
    await page.goto('/escritorio')
    const canvas = page.getByTestId('world-canvas').locator('canvas')
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    const vp = page.viewportSize()!
    expect(box.width * box.height).toBeGreaterThan(vp.width * vp.height * 0.6)
    await expect(page.locator('[data-testid^="tag-"]').first()).toBeAttached()
    await page.getByRole('button', { name: 'Modo gerenciamento' }).click()
    await page.getByTestId('management-panel').locator('li button').first().click()
    await expect(page.getByTestId('agent-panel')).toBeVisible()
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByLabel('Mensagem').fill('qual o seu status?')
    await page.getByLabel('Enviar').click()
    await expect(page.getByTestId('agent-chat')).toContainText(/demo|Estou|No momento/)
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

  test('nova missão é atribuída (demo)', async ({ page }) => {
    await page.goto('/escritorio')
    await page.getByTestId('new-mission').click()
    await page.getByTestId('mission-title').fill('Gerar relatório de insights')
    await page.locator('[role="dialog"] button[aria-pressed]').first().click()
    await page.getByTestId('mission-submit').click()
    await expect(page.getByText(/atribuída/)).toBeVisible()
  })

  test('perfil de chave (demo) e seleção por agente no Studio', async ({ page }) => {
    await page.goto('/modelos?tab=chaves')
    await page.getByTestId('cred-alias').fill('Gemini · chave 3')
    await page.getByTestId('cred-create').click()
    await expect(page.getByTestId('credentials-tab')).toContainText('Gemini · chave 3')
    await page.goto('/agentes/novo')
    await page.getByPlaceholder('Ex.: Pesquisador IA').fill('Agente E2E')
    await page.getByPlaceholder('O que este agente deve alcançar?').fill('Validar o fluxo completo de criação')
    await page.getByRole('button', { name: /Próximo/ }).click()
    await expect(page.getByTestId('credential-select')).toContainText('Gemini · chave 3')
    await page.getByTestId('credential-select').selectOption({ label: 'Gemini · chave 3' })
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Próximo/ }).click()
    await page.getByTestId('save-agent').click()
    await expect(page.getByTestId('agent-profile')).toContainText('Agente E2E')
  })

  test('workflow: adiciona nó, valida e executa simulação', async ({ page }) => {
    await page.goto('/workflows')
    await page.getByTestId('palette-tool').click()
    await page.getByRole('button', { name: /Validar/ }).click()
    await page.getByTestId('run-workflow').click()
    await expect(page.getByText(/Simulação concluída/)).toBeVisible({ timeout: 20_000 })
  })

  test('painel de métricas: período altera os indicadores', async ({ page }) => {
    await page.goto('/painel')
    const runs = page.getByTestId('kpi-runs')
    const before = await runs.textContent()
    await page.getByLabel('Período').selectOption('30d')
    await expect(runs).not.toHaveText(before ?? '')
  })
})
