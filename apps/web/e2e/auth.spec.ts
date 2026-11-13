import { expect, test } from '@playwright/test'
import { AUTH, PASSWORD, lastMail, login, useBackend } from './helpers'

/**
 * Fluxos de autenticação contra o Supabase Auth FALSO (apps/api/tests/fake_supabase.py),
 * usando o supabase-js real do app: cadastro → verificação → login → sessão → recuperação → logout.
 */
test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => useBackend(page, true))

  test('rotas privadas exigem login', async ({ page }) => {
    await page.goto('/projetos')
    await expect(page).toHaveURL(/\/entrar/)
    await expect(page.getByTestId('auth-login')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('cadastro com validação, verificação de e-mail, login, sessão e logout', async ({ page, request }) => {
    const email = `cadastro-${Date.now()}@teste.dev`
    await page.goto('/cadastro')
    await expect(page.getByTestId('auth-register')).toBeVisible()
    // validação
    await page.getByTestId('reg-submit').click()
    await expect(page.getByText('Informe nome e sobrenome.')).toBeVisible()
    await expect(page.getByText('É preciso aceitar os Termos de Uso')).toBeVisible()
    await page.getByTestId('reg-name').fill('Vinicius Teste')
    await page.getByTestId('reg-email').fill(email)
    await page.getByTestId('reg-email2').fill(`outro-${email}`)
    await page.getByTestId('reg-password').fill('fraca')
    await page.getByTestId('reg-submit').click()
    await expect(page.getByText('Os e-mails não conferem.')).toBeVisible()
    await expect(page.getByText('A senha não atende aos requisitos')).toBeVisible()
    await page.getByTestId('reg-email2').fill(email)
    await page.getByTestId('reg-password').fill(PASSWORD)
    await page.getByTestId('reg-terms').check()
    await page.getByTestId('reg-submit').click()
    await expect(page).toHaveURL(/verificar-email/)
    await expect(page.getByText(email)).toBeVisible()

    // não entra antes de confirmar o e-mail
    await page.goto(`/entrar?email=${encodeURIComponent(email)}`)
    await page.getByTestId('login-password').fill(PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('auth-alert-error')).toContainText('Confirme seu e-mail')

    // link de verificação → sessão iniciada
    await page.goto(await lastMail(request, email, 'signup'))
    await expect(page.getByTestId('topbar')).toBeVisible()
    await expect(page.getByTestId('user-name')).toHaveText('Vinicius Teste')
    await expect(page.getByTestId('backend-status')).toContainText('Conectado')

    // sessão persiste ao recarregar
    await page.reload()
    await expect(page.getByTestId('topbar')).toBeVisible()

    // logout → perde acesso
    await page.getByLabel('Perfil').click()
    await page.getByTestId('logout').click()
    await expect(page).toHaveURL(/\/entrar/)
    await page.goto('/organizacoes')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('login inválido e "lembrar de mim" desmarcado (sessão só na aba)', async ({ page, request }) => {
    const email = `lembrar-${Date.now()}@teste.dev`
    await request.post(`${AUTH}/auth/v1/signup`, { data: { email, password: PASSWORD, data: { full_name: 'Teste Lembrar' } } })
    await page.goto(await lastMail(request, email, 'signup'))
    await expect(page.getByTestId('topbar')).toBeVisible()
    await page.getByLabel('Perfil').click()
    await page.getByTestId('logout').click()
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill('SenhaErrada#1')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('auth-alert-error')).toContainText('E-mail ou senha incorretos')
    await page.getByTestId('login-password').fill(PASSWORD)
    await page.getByTestId('login-remember').uncheck()
    await page.getByLabel('Mostrar senha').click()
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('topbar')).toBeVisible()
    const where = await page.evaluate(() => ({ local: !!localStorage.getItem('agentslab-auth'), session: !!sessionStorage.getItem('agentslab-auth') }))
    expect(where).toEqual({ local: false, session: true })
  })

  test('recuperação de senha: link, nova senha, login com a nova e link expirado', async ({ page, request }) => {
    const email = `senha-${Date.now()}@teste.dev`
    await request.post(`${AUTH}/auth/v1/signup`, { data: { email, password: PASSWORD, data: { full_name: 'Teste Senha' } } })
    const th = new URL(await lastMail(request, email, 'signup')).searchParams.get('token_hash')
    await request.post(`${AUTH}/auth/v1/verify`, { data: { token_hash: th, type: 'signup' } })

    await page.goto('/entrar')
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
    await page.getByTestId('forgot-email').fill(email)
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('auth-alert-success')).toBeVisible()

    await page.goto(await lastMail(request, email, 'recovery'))
    await expect(page).toHaveURL(/redefinir-senha/)
    const nova = 'NovaSenha#456'
    await page.getByTestId('reset-password').fill(nova)
    await page.getByTestId('reset-password2').fill('diferente')
    await page.getByTestId('reset-submit').click()
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()
    await page.getByTestId('reset-password2').fill(nova)
    await page.getByTestId('reset-submit').click()
    await expect(page).toHaveURL(/entrar\?motivo=senha/)
    await expect(page.getByTestId('auth-alert-success')).toContainText('Senha alterada')

    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill(PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('auth-alert-error')).toContainText('incorretos')
    await login(page, email, nova)

    // link expirado/usado
    await page.getByLabel('Perfil').click()
    await page.getByTestId('logout').click()
    await page.goto('/recuperar-senha')
    await page.getByTestId('forgot-email').fill(email)
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('auth-alert-success')).toBeVisible()
    await request.post(`${AUTH}/__expire`)
    await page.goto(await lastMail(request, email, 'recovery'))
    await expect(page.getByTestId('auth-alert-error')).toContainText('inválido ou expirou')
  })

  test('troca de senha em Configurações exige a senha atual', async ({ page, request }) => {
    const email = `troca-${Date.now()}@teste.dev`
    await request.post(`${AUTH}/auth/v1/signup`, { data: { email, password: PASSWORD, data: { full_name: 'Teste Troca' } } })
    await page.goto(await lastMail(request, email, 'signup'))
    await expect(page.getByTestId('topbar')).toBeVisible()
    await page.goto('/configuracoes')
    await page.getByTestId('pw-current').fill('SenhaErrada#9')
    await page.getByTestId('pw-new').fill('OutraSenha#789')
    await page.getByTestId('pw-confirm').fill('OutraSenha#789')
    await page.getByTestId('pw-submit').click()
    await expect(page.getByTestId('change-password')).toContainText('Senha atual incorreta')
    await page.getByTestId('pw-current').fill(PASSWORD)
    await page.getByTestId('pw-new').fill('fraca')
    await page.getByTestId('pw-submit').click()
    await expect(page.getByTestId('change-password')).toContainText('não atende aos requisitos')
    await page.getByTestId('pw-new').fill('OutraSenha#789')
    await page.getByTestId('pw-submit').click()
    await expect(page.getByText('Senha alterada com sucesso')).toBeVisible()
    await page.getByTestId('settings-logout').click()
    await login(page, email, 'OutraSenha#789')
  })

  test('responsivo: telas de login e cadastro no celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/entrar')
    await expect(page.getByTestId('login-submit')).toBeVisible()
    const overflow = await page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
    expect(overflow).toBe(false)
    await page.goto('/cadastro')
    await expect(page.getByTestId('reg-submit')).toBeAttached()
  })
})
