# Supabase — autenticação, banco e segurança

O AgentsLab_Studio usa o **Supabase Auth** para contas (cadastro, verificação de e-mail, login, sessão, recuperação de senha) e, quando publicado, o **Supabase PostgreSQL** como banco do backend. O app **não armazena senhas nem gera tokens**: o frontend usa `@supabase/supabase-js` (fluxo PKCE) e o backend FastAPI apenas **valida o JWT** de cada requisição.

```
Navegador (React)                 Supabase                    Backend (FastAPI)
supabase-js ── cadastro/login ──► Auth (GoTrue) ─ e-mails ─►  usuário
     │ access_token (JWT)                                         
     └──── Authorization: Bearer ─────────────────────────────►  valida JWT (JWKS ou HS256)
                                                                  owner_id = sub do token
                                                                  ▼
                                  PostgreSQL ◄── SQLAlchemy ──── schema "agentslab" (RLS ligado)
                                  public.profiles (RLS)
```

## 1. Criar o projeto

1. Crie um projeto em https://supabase.com (região mais próxima, ex.: São Paulo).
2. **Project Settings → API**: copie a **Project URL** e a **Publishable key** (`sb_publishable_...`).
   - Nunca use no frontend a `service_role`/**secret key** nem a senha do banco.
3. **Project Settings → Database → Connection string**: copie a URI do **Session pooler** (porta 5432) ou do **Transaction pooler** (6543) para o backend (`AGENTSLAB_DATABASE_URL`, trocando o prefixo para `postgresql+psycopg://` e acrescentando `?sslmode=require`).

## 2. Migrations SQL

Arquivos em `supabase/migrations/` (SQL Editor do painel ou `supabase db push`):

| Arquivo | Quando | O que faz |
|---|---|---|
| `20261113000001_profiles.sql` | antes do primeiro uso | tabela `public.profiles` (1:1 com `auth.users`: nome, avatar, cargo), RLS (cada usuário lê/atualiza só o próprio perfil; anon sem acesso), gatilhos que criam o perfil no cadastro e sincronizam o nome |
| `20261113000002_agentslab_security.sql` | **depois** da 1ª inicialização do backend (que cria as tabelas) | RLS em todas as tabelas do schema `agentslab`, revoga `anon`, políticas de **leitura dos próprios dados** para `authenticated` (filhas herdam do pai), `secrets`/`kv` sem política (acesso negado). Idempotente — rode de novo após atualizar o backend |

As tabelas do backend ficam no schema **`agentslab`**, que não é exposto pela Data API/PostgREST. O backend conecta como dono das tabelas e filtra **toda** consulta por `owner_id` (= `sub` do JWT). As políticas RLS são defesa em profundidade.

Validação feita: as duas migrations e o backend rodaram em PostgreSQL 16 com papéis `anon`/`authenticated` e `auth.uid()` simulados (`supabase/tests/`): o usuário A vê só os próprios projetos/organizações/agentes e o próprio perfil; não altera o perfil de B; `secrets` dá *permission denied*; `anon` não acessa `profiles` nem o schema `agentslab`. A suíte de testes do backend também passou inteira sobre PostgreSQL.

## 3. Autenticação (painel: Authentication)

**Sign In / Providers → Email**
- *Enable Email provider*: ligado · *Confirm email*: **ligado** (sem confirmação não há sessão — e o app também bloqueia).
- *Secure password change* ligado; senha mínima **8** com letras maiúsculas, minúsculas, números e símbolos (o app valida o mesmo no cadastro).

**URL Configuration**
- *Site URL*: a URL de produção (ex.: `https://agentslab.vercel.app`).
- *Redirect URLs* (uma por linha):
  ```
  http://localhost:5173/**
  http://localhost:4173/**
  https://agentslab.vercel.app/**
  https://*-seu-time.vercel.app/**
  https://agentslab-studio.pages.dev/**
  https://*.agentslab-studio.pages.dev/**
  ```

**Email Templates** — use links com `token_hash` (funcionam mesmo se o e-mail for aberto em outro navegador/celular, o que o PKCE puro não permite):
- *Confirm signup*:
  ```html
  <h2>Confirme seu e-mail</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/">Ativar minha conta no AgentsLab_Studio</a></p>
  ```
- *Reset password*:
  ```html
  <h2>Redefinir senha</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha">Definir nova senha</a></p>
  ```
  Com vários domínios (Vercel e Cloudflare), troque `{{ .SiteURL }}` por `{{ .RedirectTo }}` sem o caminho, ou mantenha um domínio principal.

**Sessões**: o SDK renova o token automaticamente. “Lembrar de mim” desmarcado guarda a sessão em `sessionStorage` (acaba ao fechar o navegador); marcado, em `localStorage`.

**Rate limits / Attack Protection**: mantenha os limites padrão; habilite CAPTCHA (Turnstile/hCaptcha) antes de abrir o cadastro ao público.

### SMTP próprio (produção)
O e-mail embutido do Supabase é só para testes (poucas mensagens por hora). Em **Authentication → Emails → SMTP Settings** configure um provedor (Resend, Amazon SES, Brevo, Postmark…): host, porta 587, usuário, senha, remetente (`no-reply@seudominio.com`) com SPF/DKIM configurados no DNS.

## 4. Variáveis

### Frontend (`apps/web/.env`, Vercel/Cloudflare) — públicas
| Variável | Exemplo |
|---|---|
| `VITE_SUPABASE_URL` | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (ou a *anon key* legada) |
| `VITE_SITE_URL` | `https://agentslab.vercel.app` (opcional; padrão = origem atual) |
| `VITE_API_BASE_URL` | `https://agentslab-api.onrender.com` |

Sem `VITE_SUPABASE_*` o app roda em **modo local de usuário único** (desktop/desenvolvimento), sem login.

### Backend (`apps/api/.env` ou segredos do serviço) — privadas
| Variável | Uso |
|---|---|
| `AGENTSLAB_SUPABASE_URL` | liga a autenticação; valida o JWT pela JWKS pública (`/auth/v1/.well-known/jwks.json`, chaves assimétricas — padrão dos projetos novos) |
| `AGENTSLAB_SUPABASE_JWT_SECRET` | só para projetos com **JWT secret legado (HS256)** |
| `AGENTSLAB_DATABASE_URL` | `postgresql+psycopg://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require` |
| `AGENTSLAB_SECRET_BACKEND=db` + `AGENTSLAB_MASTER_KEY` | chaves de API dos usuários criptografadas (Fernet) no banco |
| `AGENTSLAB_CORS_ORIGINS` / `AGENTSLAB_CORS_ORIGIN_REGEX` | domínios do frontend (ex.: regex `https://.*\.vercel\.app`) |

O backend recusa tokens expirados, com assinatura inválida, com `aud` diferente de `authenticated` ou com `role` diferente de `authenticated`. O SSE (`/api/v1/events`) aceita o token também em `?access_token=` porque o `EventSource` não envia cabeçalhos.

## 5. Isolamento entre usuários
- Toda entidade raiz tem `owner_id`; rotas buscam o recurso e respondem **404** se pertencer a outro usuário (organizações, agentes, projetos, mensagens, documentos, evidências, execuções, chaves, preferências de provedor, workflows, eventos SSE).
- Cada usuário recebe suas próprias organizações iniciais no primeiro acesso.
- Chaves de API: uma pessoa nunca usa a chave de outra; variáveis de ambiente (`GEMINI_API_KEY` etc.) só valem no modo local.
- Testes: `apps/api/tests/test_auth.py` (tokens inválidos/expirados, dados cruzados entre dois usuários, semente concorrente).

## 6. Testes sem rede
`apps/api/tests/fake_supabase.py` implementa o subconjunto da API do Supabase Auth usado pelo app (cadastro, e-mails com `token_hash`, verificação, login, refresh, recuperação, atualização de senha, logout). Os E2E (`apps/web/e2e/auth.spec.ts`) rodam o `supabase-js` real do app contra ele. **Não substitui** um teste com o seu projeto Supabase real — faça-o após configurar (passo a passo no README).
