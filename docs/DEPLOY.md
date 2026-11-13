# Arquitetura de publicação

```
                     ┌──────────────── usuários (navegador / celular / app desktop) ────────────────┐
                     │                                                                              │
  Frontend estático ─┤  Vercel  ou  Cloudflare Pages   (apps/web → dist, SPA, PWA-ready)            │
                     │        │ HTTPS + JWT do Supabase                                             │
  Backend ───────────┤  Render / Fly.io / Railway / HF Space (Docker: apps/api/Dockerfile)          │
                     │        │ SQLAlchemy (psycopg)            │ LiteLLM → Gemini/Groq/OpenAI/HF    │
  Dados e contas ────┤  Supabase: Auth + PostgreSQL (schema agentslab + public.profiles)            │
                     └──────────────────────────────────────────────────────────────────────────────┘
  Desktop (Microsoft Store): Tauri 2 + backend Python como sidecar (PyInstaller) em MSIX — planejado
```

Por que não colocar o backend na Vercel/Cloudflare? Os agentes executam por minutos, em segundo plano, e enviam eventos ao vivo (SSE). Funções serverless encerram em segundos e não mantêm conexões longas. O backend precisa de um **processo contínuo** (container).

## 1. Banco e contas (Supabase)
Siga `docs/SUPABASE.md` (projeto, migrations, Auth, URLs, SMTP). O banco é **sempre PostgreSQL**: o backend recusa iniciar sem `AGENTSLAB_DATABASE_URL` (SQLite fica restrito aos testes automatizados). Para desenvolver sem internet: `docker compose up -d db` (PostgreSQL 16 em `localhost:5432`).

## 2. Backend (container)

Imagem: `apps/api/Dockerfile` (Python 3.12, uvicorn, usuário sem privilégios). Variáveis mínimas:

```
AGENTSLAB_ENV=production
AGENTSLAB_DATABASE_URL=postgresql+psycopg://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
AGENTSLAB_SUPABASE_URL=https://<ref>.supabase.co
AGENTSLAB_MASTER_KEY=<python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
AGENTSLAB_CORS_ORIGINS=https://agentslab.vercel.app,https://agentslab-studio.pages.dev
AGENTSLAB_CORS_ORIGIN_REGEX=https://.*\.vercel\.app|https://.*\.agentslab-studio\.pages\.dev
```

- **Render**: New → Web Service → repositório → *Root Directory* `apps/api`, *Runtime* Docker; adicione as variáveis; *Health Check Path* `/health`. O plano gratuito hiberna após inatividade — projetos interrompidos são retomados ao acordar (`recover()`), mas prefira um plano pago para execuções longas.
- **Hugging Face Space**: Space Docker com o conteúdo de `apps/api`, variável `PORT=7860`, segredos em *Settings → Variables and secrets*. Use Space **privado** só se o frontend não precisar acessá-lo diretamente; com login Supabase, o Space público é seguro (todas as rotas exigem JWT).
- **Fly.io/Railway**: `fly launch` / *Deploy from repo* apontando para `apps/api`.

Depois do primeiro deploy (tabelas criadas), rode `supabase/migrations/20261113000002_agentslab_security.sql`.

Escala: um processo atende vários usuários; o motor usa asyncio com limites por projeto. Para muitos usuários simultâneos, a próxima etapa é fila externa (Redis + worker) — ver ROADMAP.

## 3. Frontend

**Vercel**: *Root Directory* `apps/web`, Framework *Vite*, build `npm run build`, saída `dist`. `vercel.json` já faz o fallback SPA. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_SITE_URL`.

**Cloudflare Pages**: *Root directory* `apps/web`, build `npm run build`, saída `dist` (fallback SPA nativo). Mesmas variáveis. Defina `NODE_VERSION=22`.

Nada secreto vai para o frontend: só a URL do Supabase, a chave **publicável** e a URL pública da API.

## 4. Celular
- Layout responsivo: menu lateral vira gaveta (☰), painéis viram telas cheias, telas de login/cadastro com o cenário no topo.
- Pode ser instalado como atalho (“Adicionar à tela inicial”). Um PWA completo (manifesto + service worker) e apps nativos via Capacitor estão no roadmap — reaproveitam o mesmo build.

## 5. Desktop (.exe / Microsoft Store) — planejado
- **Tauri 2** empacota o frontend; o backend Python vai como *sidecar* (PyInstaller) iniciado pelo app em `localhost`.
- Modo **local**: sem Supabase, banco SQLite em `%APPDATA%`, chaves no **Gerenciador de Credenciais do Windows** (`AGENTSLAB_SECRET_BACKEND=keyring`).
- Modo **conectado**: o app desktop aponta para o backend hospedado e usa o mesmo login Supabase.
- Publicação: `tauri build` gera MSI/MSIX; assinatura de código e submissão pelo Partner Center.

## 6. Checklist de produção
- [ ] Confirm email ligado, SMTP próprio, CAPTCHA no cadastro.
- [ ] Redirect URLs com todos os domínios (produção e previews).
- [ ] `AGENTSLAB_MASTER_KEY` gerada e guardada só nos segredos do serviço (perdê-la invalida as chaves salvas).
- [ ] Migration de segurança executada após o 1º deploy.
- [ ] Termos de Uso e Política de Privacidade revisados (LGPD).
- [ ] Teste real: cadastro → e-mail → login → projeto com sua chave → logout.
