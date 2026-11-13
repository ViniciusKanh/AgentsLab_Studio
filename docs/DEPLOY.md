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

- **Render (gratuito — caminho recomendado)**: o repositório já tem `render.yaml`.
  1. render.com → entrar com o GitHub → **New → Blueprint** → escolha o repositório → *Apply*.
  2. Preencha os 4 segredos pedidos (`AGENTSLAB_DATABASE_URL`, `AGENTSLAB_SUPABASE_URL`, `AGENTSLAB_MASTER_KEY` — **a mesma do seu `.env`** —, `AGENTSLAB_CORS_ORIGINS` = endereço do Cloudflare Pages).
  3. Aguarde o build (alguns minutos) e teste `https://agentslab-api.onrender.com/health`.
  - O plano gratuito hiberna após ~15 min sem acesso. O backend se mantém acordado acessando o próprio endereço público a cada 5 min (`app/services/keepalive.py`; `AGENTSLAB_KEEPALIVE_MODE=always`, usa `RENDER_EXTERNAL_URL`). Um serviço ligado o mês todo usa ~744 h das ~750 h gratuitas — não crie um segundo serviço gratuito na mesma conta, ou use `busy` (acordado só com projeto em execução).
  - Republica sozinho a cada push que altera `apps/api/` (`buildFilter`). Memória medida: ~230 MB com LiteLLM carregado (limite gratuito: 512 MB).
- **Hugging Face Space**: Space Docker com o conteúdo de `apps/api`, variável `PORT=7860`, segredos em *Settings → Variables and secrets*. Use Space **privado** só se o frontend não precisar acessá-lo diretamente; com login Supabase, o Space público é seguro (todas as rotas exigem JWT).
- **Fly.io/Railway**: `fly launch` / *Deploy from repo* apontando para `apps/api`.

Depois do primeiro deploy (tabelas criadas), rode `supabase/migrations/20261113000002_agentslab_security.sql`.

Escala: um processo atende vários usuários; o motor usa asyncio com limites por projeto. Para muitos usuários simultâneos, a próxima etapa é fila externa (Redis + worker) — ver ROADMAP.

## 3. Frontend

**Vercel**: *Root Directory* `apps/web`, Framework *Vite*, build `npm run build`, saída `dist`. `vercel.json` já faz o fallback SPA. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_SITE_URL`.

**Cloudflare Workers (fluxo atual do painel — usado em produção)**: *Workers & Pages → Create → Import a repository* → `AgentsLab_Studio`. Build command `npm run build`, deploy command `npx wrangler deploy`, *Advanced settings → Root directory* `apps/web`. O arquivo `apps/web/wrangler.jsonc` publica a pasta `dist` com fallback de SPA. As variáveis `VITE_*` (abaixo) vão em **Settings → Build → Variables and secrets** (são lidas no build; depois de alterar, refaça o deploy). Endereço: `https://agentslab-studio.<conta>.workers.dev`.

**Cloudflare Pages (alternativa)**: dash.cloudflare.com → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → repositório. *Root directory* `apps/web`, *Framework preset* nenhum/Vite, build `npm run build`, saída `dist` (fallback SPA nativo). Variáveis de ambiente (Production):

```
NODE_VERSION=22
VITE_API_BASE_URL=https://agentslab-api.onrender.com
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SITE_URL=https://<seu-projeto>.pages.dev
```

Depois, no Supabase → *Authentication → URL Configuration*: *Site URL* = endereço do Pages e, em *Redirect URLs*, `https://<seu-projeto>.pages.dev/**` (mantenha `http://localhost:5173/**` para desenvolver). Na primeira abertura do dia o app pode levar alguns segundos para conectar (servidor acordando).

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
