# AgentsLab_Studio

**Plataforma de organizações multiagentes com interface pixel art.** Você descreve um trabalho em linguagem natural. O agente coordenador da organização propõe um plano, você aprova ou ajusta, e os agentes executam tarefas **reais**: chamadas a LLMs, buscas em bases acadêmicas e verificação de referências. Eles trocam entregas, consolidam um documento, revisam e geram novas versões a partir do seu feedback. O escritório e o laboratório em pixel art mostram esse trabalho acontecendo; estados, mensagens e entregas dos personagens vêm do backend, nunca de animações inventadas.

[![CI](https://github.com/ViniciusKanh/AgentsLab_Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/ViniciusKanh/AgentsLab_Studio/actions/workflows/ci.yml)
[![Showcase](https://github.com/ViniciusKanh/AgentsLab_Studio/actions/workflows/showcase.yml/badge.svg)](https://github.com/ViniciusKanh/AgentsLab_Studio/actions/workflows/showcase.yml)

| | |
|---|---|
| **App publicado** | https://agentslab-studio.viniciussouza742.workers.dev (Cloudflare Workers) |
| **API** | https://agentslab-api.onrender.com/health (Render) |
| **Versão** | v1.4 — execução multiagente rastreável (API `0.4.0`) |

![Laboratório durante um projeto](docs/media/demo-laboratorio.gif)

> Todas as imagens deste README são geradas automaticamente (`npm run media` / workflow *Showcase*) com a API em **modo de teste**: LLM e ferramentas determinísticos, sem chave real. Com as suas chaves, o mesmo fluxo usa os modelos reais.

---

## Sumário

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Demonstração](#2-demonstração)
3. [Arquitetura](#3-arquitetura)
4. [Stack e versões](#4-stack-e-versões)
5. [Estrutura do repositório](#5-estrutura-do-repositório)
6. [Execução local reprodutível](#6-execução-local-reprodutível)
7. [Configuração (variáveis de ambiente)](#7-configuração-variáveis-de-ambiente)
8. [Primeiro projeto: caso de validação](#8-primeiro-projeto-caso-de-validação)
9. [Publicação gratuita](#9-publicação-gratuita)
10. [Testes e reprodutibilidade](#10-testes-e-reprodutibilidade)
11. [Referência da API e eventos](#11-referência-da-api-e-eventos)
12. [Modelo de dados](#12-modelo-de-dados)
13. [Segurança e custos](#13-segurança-e-custos)
14. [Análise do projeto](#14-análise-do-projeto)
15. [Solução de problemas](#15-solução-de-problemas)
16. [Documentação complementar](#16-documentação-complementar)

---

## 1. O que o sistema faz

| Módulo | Funcionalidades | Situação |
|---|---|---|
| **Contas** | Cadastro, verificação de e-mail, login, "lembrar de mim", recuperação e troca de senha (Supabase Auth); cada usuário só vê os próprios dados | Implementado e testado |
| **Organizações** | Laboratório de Pesquisa em IA, Escritório Empresarial e modelo Fábrica de Software, com departamentos, coordenador e equipe | Implementado e testado |
| **Agent Studio** | Papel, personalidade, instruções, provedor/modelo, chave, ferramentas, limites (tokens, tempo, retentativas) e aparência | Implementado e testado |
| **Projetos** | Pedido em linguagem natural → plano do coordenador → edição/aprovação humana → execução com dependências → relatório → revisão → feedback → novas versões | Implementado e testado |
| **Execução** | Tarefas independentes em paralelo, limite por provedor, retentativa em 429/5xx, tempo limite, pausa, retomada e cancelamento imediato; continua com a página fechada e retoma após reinício | Implementado e testado |
| **Evidências** | Busca no OpenAlex e no arXiv; verificação independente no Crossref/arXiv; referências geradas pelo sistema; citações inexistentes sinalizadas | Implementado; testado com ferramentas de teste |
| **Documentos** | Código (D1, D2…), autoria, versão, data, projeto, tarefa de origem; histórico, diff e download `.md` com cabeçalho | Implementado e testado |
| **Feedback** | Em documento ou tarefa; vai ao agente responsável e propaga às dependentes (FB → UP → RR), com nova revisão | Implementado e testado |
| **Provedores e custos** | Gemini, Groq, OpenAI, Hugging Face, Ollama (LiteLLM); modelos testados com a sua chave; tokens e custo por agente, tarefa, modelo e projeto; orçamento por projeto | Implementado e testado |
| **Mundo pixel art** | Escritório e laboratório (Phaser + A\*); estados reais (pesquisando, redigindo, revisando, aguardando dependência); entregas com caminhada até o colega; painel "Trabalho" do agente | Implementado e testado |
| **Fluxos** | Editor visual de workflows com validação e ordem de execução | Implementado; execução pelo editor planejada |
| **RAG / PDFs / desktop** | Upload de documentos (pgvector), texto completo de artigos, app Tauri para a Microsoft Store | Planejado ([ROADMAP](docs/ROADMAP.md)) |

**Princípio:** os personagens representam agentes computacionais reais. Sem backend, o app entra em modo offline, só para visualização, com agentes de exemplo identificados. Não há gamificação (XP, níveis, missões).

## 2. Demonstração

| Plano proposto pelo coordenador | Execução (estado real dos agentes) |
|---|---|
| ![Plano](docs/media/projeto-plano.png) | ![Execução](docs/media/projeto-execucao.png) |
| **Documentos com metadados e referências verificadas** | **Revisão: aprovação e feedback** |
| ![Documentos](docs/media/projeto-entrega.png) | ![Revisão](docs/media/projeto-revisao.png) |
| **Custos por agente, tarefa e modelo** | **Agente selecionado no laboratório** |
| ![Custos do projeto](docs/media/projeto-custos.png) | ![Agente](docs/media/agente-selecionado.png) |
| **Organizações** | **Chaves de API (cofre no backend)** |
| ![Organizações](docs/media/organizacoes.png) | ![Chaves](docs/media/chaves-api.png) |

| Login | Cadastro | Celular |
|---|---|---|
| ![Login](docs/media/login.png) | ![Cadastro](docs/media/cadastro.png) | ![Login no celular](docs/media/login-celular.png) |

Vídeos: [laboratório](docs/media/demo-laboratorio.mp4) · [escritório](docs/media/demo-escritorio.mp4).

## 3. Arquitetura

```mermaid
flowchart LR
  subgraph Navegador["Navegador (React + Phaser) — Cloudflare Workers"]
    UI[Telas: Projetos, Agent Studio, Provedores...]
    W[Mundo pixel art<br/>AmbientWorld + Phaser]
    RT[services/realtime.ts<br/>EventSource SSE]
    RT --> W
    RT --> UI
  end
  subgraph Supabase
    AUTH[Supabase Auth<br/>JWT]
    PG[(PostgreSQL<br/>schema agentslab + RLS)]
  end
  subgraph API["Backend FastAPI — Render (Docker)"]
    R[Routers REST + /events SSE]
    O[Orquestrador asyncio<br/>plano → execução → revisão]
    L[LiteLLM gateway]
    T[Ferramentas<br/>OpenAlex · arXiv · Crossref]
    V[Cofre Fernet<br/>chaves dos usuários]
    E[EventHub<br/>eventos persistidos + replay]
    R --> O --> L
    O --> T
    O --> E
    L --> V
  end
  UI -- "login" --> AUTH
  UI -- "REST + Bearer JWT" --> R
  RT -- "SSE ?access_token" --> E
  R -- "valida JWT (JWKS)" --> AUTH
  API --> PG
  L --> P[(Gemini · Groq · OpenAI<br/>Hugging Face · Ollama)]
```

**Fluxo de um projeto**

```mermaid
sequenceDiagram
  actor G as Gestor
  participant C as Coordenador
  participant P1 as Pesquisador(es)
  participant A as Analista
  participant R as Redator
  participant V as Revisor
  G->>C: pedido em linguagem natural
  C-->>G: plano (tarefas, agentes, dependências) — decisão necessária
  G->>C: ajusta e aprova (plano congelado)
  par em paralelo
    C->>P1: T1 revisão de literatura
    C->>P1: T2 investigação técnica
  end
  P1->>P1: busca OpenAlex/arXiv → evidências E# → verificação Crossref/arXiv
  P1->>A: entrega D1, D2 (só as evidências necessárias)
  A->>R: análise comparativa D3
  R->>V: relatório D4 (referências geradas pelo sistema)
  V-->>R: parecer (citações inexistentes, fontes não confirmadas) → revisão automática
  C-->>G: entrega pronta — decisão necessária
  G->>A: feedback na tarefa T3
  A->>R: D3 v2 → R atualiza D4 → V revisa de novo
  G->>C: aprova a entrega
```

Detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Decisões principais** (histórico completo em [docs/ROADMAP.md](docs/ROADMAP.md#histórico-de-decisões)):

- Orquestração própria em `asyncio`, com estado persistido e `recover()` no boot, em vez de LangGraph nesta fase. O fluxo fica auditável e determinístico nos testes.
- O backend é um **processo contínuo** (container), não serverless: os agentes trabalham por minutos e transmitem eventos ao vivo.
- **PostgreSQL obrigatório.** SQLite só existe nos testes automatizados.
- As referências são montadas pelo sistema a partir das evidências; o modelo só cita códigos `[E#]`.

## 4. Stack e versões

| Camada | Tecnologia | Versão validada |
|---|---|---|
| Runtime frontend | Node.js / npm | **22.x** (`.nvmrc`) / 10.x |
| UI | React · React Router · Zustand · Tailwind CSS · Recharts · @xyflow/react · lucide-react | 19.3 · 7.18 · 5.1 · 4.3 · 3.10 · 12.12 · 1.72 |
| Mundo 2D | Phaser | 3.90 |
| Build e testes web | Vite · TypeScript · Vitest · Playwright | 8.3 · 5.9 · 4.1 · 1.63 |
| Auth (cliente) | @supabase/supabase-js | 2.119 |
| Runtime backend | Python | **3.12** (`.python-version`, Dockerfile) |
| API | FastAPI · Uvicorn · Pydantic | 0.162 · 0.54 · 2.14 |
| Dados | SQLAlchemy · psycopg · PostgreSQL | 2.1 · 3.3 · 16 (Supabase) |
| IA | LiteLLM | 1.109 |
| Segurança | PyJWT · cryptography (Fernet) · keyring | 2.15 · 50.0 · 25.7 |

Versões exatas: `apps/web/package-lock.json` e `apps/api/requirements.lock.txt` (ver [§10](#10-testes-e-reprodutibilidade)).

## 5. Estrutura do repositório

```
AgentsLab_Studio/
├── apps/
│   ├── api/                         Backend FastAPI (Python 3.12)
│   │   ├── app/
│   │   │   ├── main.py              inicialização, migração leve de colunas, CORS, recover(), keep-alive
│   │   │   ├── config.py            todas as configurações (prefixo AGENTSLAB_)
│   │   │   ├── auth.py · deps.py    validação do JWT do Supabase, usuário atual, seed por usuário
│   │   │   ├── db.py · models.py    SQLAlchemy (schema agentslab), 16 entidades
│   │   │   ├── routers/             health, credentials, organizations (+agentes), projects, system (SSE, provedores, uso)
│   │   │   └── services/
│   │   │       ├── orchestrator.py  plano → aprovação → execução paralela → revisão → feedback com propagação
│   │   │       ├── llm.py           LiteLLM, custo/tokens, erros transitórios
│   │   │       ├── tools.py         OpenAlex, arXiv, verificação Crossref/arXiv
│   │   │       ├── prompts.py       prompts (conteúdo externo delimitado como não confiável)
│   │   │       ├── providers.py     catálogo, preferências, teste de modelos Gemini
│   │   │       ├── vault.py         cofre de chaves (Fernet no banco / keyring / arquivo)
│   │   │       ├── events.py        eventos persistidos + SSE com replay
│   │   │       ├── keepalive.py     mantém o servidor acordado no Render gratuito
│   │   │       └── seed.py          organizações e agentes iniciais
│   │   ├── scripts/                 criar_conta_principal.py, listar_projetos.py
│   │   ├── tests/                   pytest + substitutos de teste (fakes.py, fake_supabase.py, e2e_server.py)
│   │   ├── Dockerfile · requirements.txt · requirements.lock.txt · .env.example
│   └── web/                         Frontend React + Vite
│       ├── src/
│       │   ├── features/            auth, projects (workspace em 6 áreas), agents, organizations, models, world, settings…
│       │   ├── services/            http, platform (cliente REST), realtime (SSE), supabase, backend
│       │   ├── stores/              Zustand (auth, lab, simulation, chat, world, ui)
│       │   ├── world/               mapas, A*, AmbientWorld, renderização Phaser
│       │   └── test/                Vitest
│       ├── e2e/                     Playwright (auth + fluxo crítico)
│       ├── scripts/capture-media.mjs  prints, MP4 e GIF do README
│       └── wrangler.jsonc · playwright.config.ts · .env.example
├── supabase/migrations · tests      perfis, RLS e verificação
├── docs/                            arquitetura, deploy, Supabase, validação, roadmap, design system, mídia
├── tools/pixelart                   gerador procedural de sprites e mapas (não editar PNG/JSON à mão)
├── .github/workflows                CI, Showcase, Release
├── docker-compose.yml               PostgreSQL 16 local (+ API opcional)
├── render.yaml                      Blueprint do backend no Render
└── CLAUDE.md                        regras permanentes do projeto
```

Tamanho aproximado: backend ~3,7 mil linhas, frontend ~9,1 mil linhas (TS/TSX), testes ~1,5 mil linhas.

## 6. Execução local reprodutível

### 6.1 Pré-requisitos

| Ferramenta | Versão | Verificar |
|---|---|---|
| Git | qualquer recente | `git --version` |
| Python | **3.12** | `python --version` |
| Node.js | **22** | `node --version` |
| Banco | Supabase (gratuito) **ou** Docker Desktop | — |
| Chave de LLM | Gemini (gratuita no Google AI Studio) ou outra | — |

### 6.2 Banco e autenticação

- **Opção A — Supabase (recomendada, igual à produção):** siga [docs/SUPABASE.md](docs/SUPABASE.md). Você vai criar o projeto, rodar `supabase/migrations/20261113000001_profiles.sql`, configurar as URLs de Auth e pegar a *Session pooler connection string*. Depois do primeiro start da API, rode `20261113000002_agentslab_security.sql`.
- **Opção B — PostgreSQL local, sem login:** `docker compose up -d db`. Use `AGENTSLAB_DATABASE_URL=postgresql+psycopg://agentslab:agentslab@localhost:5432/agentslab` e deixe `AGENTSLAB_SUPABASE_URL` vazio: a API entra em **modo local de usuário único**.

### 6.3 Backend (Windows / PowerShell)

```powershell
git clone https://github.com/ViniciusKanh/AgentsLab_Studio.git C:\dev\AgentsLab_Studio
cd C:\dev\AgentsLab_Studio\apps\api
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1          # se bloquear: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt -c requirements.lock.txt
copy .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# cole a saída em AGENTSLAB_MASTER_KEY; preencha AGENTSLAB_DATABASE_URL e AGENTSLAB_SUPABASE_URL no .env
python -c "from app.db import engine; engine.connect(); print('BANCO OK')"
uvicorn app.main:app --reload --port 8000     # http://localhost:8000/health → "version": "0.4.0"
```

Linux/macOS: troque `py -3.12` por `python3.12`, a ativação por `source .venv/bin/activate` e `copy` por `cp`.

### 6.4 Frontend

```powershell
cd C:\dev\AgentsLab_Studio\apps\web
npm ci                                 # instala exatamente o package-lock.json
copy .env.example .env                 # VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (chave publicável)
npm run dev                            # http://localhost:5173
```

### 6.5 Conta principal (uma vez)

Cria sua conta já confirmada como dona da plataforma. A chave *secret/service_role* fica só no terminal, nunca em arquivo.

```powershell
cd C:\dev\AgentsLab_Studio\apps\api
$env:SUPABASE_URL="https://<ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<secret key do painel>"
python scripts\criar_conta_principal.py --nome "Seu Nome" --email voce@exemplo.com --assumir-dados-locais
```

A senha é digitada no terminal. Depois, troque-a quando quiser em **Configurações → Conta → Trocar senha**.

### 6.6 Chave do modelo

Em **Provedores e Custos → Chaves**, cadastre a chave (ex.: Gemini). O app testa cada modelo disponível para a sua conta e mostra só os que funcionam. A chave vai criptografada para o banco e o navegador só vê os 4 últimos dígitos.

### 6.7 Alternativa com Docker (banco + API)

```powershell
docker compose up -d          # PostgreSQL 16 + API em http://localhost:8000 (usa apps/api/.env)
```

## 7. Configuração (variáveis de ambiente)

### Backend: `apps/api/.env` (privado, nunca versionado)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `AGENTSLAB_DATABASE_URL` | sim | — | PostgreSQL. Supabase: *Session pooler* (porta 5432, IPv4). Aceita `postgresql://`. |
| `AGENTSLAB_MASTER_KEY` | sim (cofre `db`) | — | Chave Fernet que criptografa as chaves dos usuários. **Perdê-la invalida as chaves salvas.** |
| `AGENTSLAB_SUPABASE_URL` | para login | vazio = modo local | `https://<ref>.supabase.co`; a API valida os JWT pelo JWKS. |
| `AGENTSLAB_SUPABASE_JWT_SECRET` | não | — | Só para projetos com JWT legado (HS256). |
| `AGENTSLAB_CORS_ORIGINS` | em produção | localhost | Endereços do frontend, separados por vírgula. |
| `AGENTSLAB_CORS_ORIGIN_REGEX` | não | — | Para URLs de preview (ex.: `https://.*\.workers\.dev`). |
| `AGENTSLAB_SECRET_BACKEND` | não | `auto` | `auto`/`db` (Fernet no banco), `keyring` (cofre do Windows) ou `file`. |
| `AGENTSLAB_DB_SCHEMA` | não | `agentslab` | Schema próprio, fora do `public` exposto pelo Supabase. |
| `AGENTSLAB_DEFAULT_PROJECT_BUDGET_USD` | não | `2.0` | Orçamento padrão por projeto. |
| `AGENTSLAB_MAX_TASKS_PER_PROJECT` | não | `10` | Tarefas no plano. |
| `AGENTSLAB_MAX_TOTAL_TASKS_PER_PROJECT` | não | `30` | Teto com revisões e feedback (evita delegação sem fim). |
| `AGENTSLAB_MAX_LLM_CALLS_PER_PROJECT` | não | `60` | Limite de chamadas por projeto. |
| `AGENTSLAB_MAX_AUTO_REVISIONS` | não | `1` | Revisões automáticas pedidas pelo revisor. |
| `AGENTSLAB_TASK_CONCURRENCY` | não | `3` | Tarefas simultâneas por projeto. |
| `AGENTSLAB_PROVIDER_CONCURRENCY` | não | `2` | Chamadas simultâneas por provedor. |
| `AGENTSLAB_LLM_MAX_RETRIES` / `_RETRY_BASE_SEC` | não | `2` / `4` | Retentativas com espera exponencial em 429/5xx/timeout. |
| `AGENTSLAB_TASK_TIMEOUT_SEC` | não | `900` | Tempo máximo de uma tarefa. |
| `AGENTSLAB_VERIFY_REFERENCES` | não | `true` | Verificação no Crossref/arXiv. |
| `AGENTSLAB_KEEPALIVE_MODE` / `_URL` | não | `always` / `RENDER_EXTERNAL_URL` | Mantém o servidor gratuito acordado (`always`, `busy`, `off`). |
| `AGENTSLAB_OLLAMA_BASE_URL` | não | `http://localhost:11434` | Modelos locais. |

### Frontend: `apps/web/.env` (público, entra no bundle)

| Variável | Descrição |
|---|---|
| `VITE_API_BASE_URL` | Endereço da API (também pode ser alterado em Configurações). |
| `VITE_SUPABASE_URL` | URL do projeto Supabase; vazio = modo local sem login. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Somente** a chave publicável (`sb_publishable_...`). Nunca a *secret/service_role*. |
| `VITE_SITE_URL` | Endereço do site para os links de e-mail. |

## 8. Primeiro projeto: caso de validação

O caso de referência do projeto é a **"Pesquisa sobre aplicações de IA na aeronáutica"**:

1. **Projetos → Novo projeto →** *Usar exemplo* → organização **Laboratório de Pesquisa em IA** → **Enviar ao coordenador**.
2. **Planejamento:** revise T1 (literatura), T2 (modelos e datasets), T3 (análise comparativa), T4 (relatório) e T5 (revisão). Ajuste se quiser e clique em **Aprovar e iniciar**.
3. **Execução:** T1 e T2 rodam em paralelo. Clique numa atividade para ver o contexto recebido, as ferramentas usadas, os tokens e a duração.
4. **Documentos:** relatório com referências marcadas como ✔ verificada ou ⚠ não confirmada; aba **Evidências**; **Diff** entre versões; download `.md`.
5. **Revisão:** envie feedback **na tarefa T3**. O analista gera D3 v2, o redator atualiza o relatório e o revisor revisa de novo. Depois, **Aprovar entrega**.
6. **Custos:** tokens e valores por agente, tarefa e modelo.

O mesmo fluxo é executado automaticamente em `apps/api/tests/test_execucao_multiagente.py`. Resultados e limitações: [docs/VALIDACAO_EXECUCAO.md](docs/VALIDACAO_EXECUCAO.md).

## 9. Publicação gratuita

| Parte | Serviço | Arquivo |
|---|---|---|
| Frontend | **Cloudflare Workers** (assets estáticos + fallback SPA) | `apps/web/wrangler.jsonc` |
| Backend | **Render** gratuito (Docker), acordado pelo keep-alive | `render.yaml`, `apps/api/Dockerfile` |
| Banco + Auth | **Supabase** gratuito | `supabase/migrations` |

Resumo:

1. **Render → New → Blueprint** → repositório. Informe `AGENTSLAB_DATABASE_URL`, `AGENTSLAB_SUPABASE_URL`, `AGENTSLAB_MASTER_KEY` (a mesma do `.env`) e `AGENTSLAB_CORS_ORIGINS` (endereço do frontend).
2. **Cloudflare → Workers & Pages → Create → Import a repository.** Root `apps/web`, build `npm run build`, deploy `npx wrangler deploy`. As variáveis `VITE_*` vão em *Settings → Build → Variables*.
3. **Supabase → Authentication → URL Configuration:** Site URL e Redirect URLs `https://<frontend>/**`.

Os dois serviços republicam sozinhos a cada push na `main`; o Render só quando `apps/api/` muda. Limites do plano gratuito: o Render tem ~750 h/mês e 512 MB de RAM (a API usa ~230 MB). O Supabase pausa o projeto após cerca de uma semana sem uso. Passo a passo completo: [docs/DEPLOY.md](docs/DEPLOY.md).

## 10. Testes e reprodutibilidade

### Como garantimos resultados reproduzíveis

| Mecanismo | Onde |
|---|---|
| Versões de runtime fixadas | `.nvmrc` (Node 22), `.python-version` e `Dockerfile` (Python 3.12), CI com as mesmas versões |
| Dependências exatas | `apps/web/package-lock.json` (`npm ci`); `apps/api/requirements.lock.txt` usado como restrição (`pip install -r requirements.txt -c requirements.lock.txt`) no Docker, no CI e localmente |
| Execução determinística nos testes | LLM, busca acadêmica e Supabase Auth substituídos por implementações de teste (`apps/api/tests/fakes.py`, `fake_supabase.py`), carregadas **somente** nos testes |
| Banco igual ao de produção | A suíte pytest roda também em PostgreSQL 16 real (`AGENTSLAB_TEST_DATABASE_URL`) |
| Estado auditável | Plano aprovado congelado; contexto de cada tarefa, ferramentas, chamadas de modelo (tokens, custo, latência, retentativas) e eventos persistidos |
| Mídia regenerável | `npm run media` recria prints, MP4 e GIF a partir do código |
| Assets regeneráveis | `npm run assets` (`tools/pixelart`) recria sprites e mapas |

**Para regenerar o lock do Python** (ao atualizar dependências): crie um venv limpo com Python 3.12, rode `pip install -r requirements.txt` e depois `pip freeze > requirements.lock.txt` (mantenha o cabeçalho).

### Suítes

| Comando | Resultado atual | O que valida |
|---|---|---|
| `cd apps/api; pytest -q` | **33/33** (SQLite e PostgreSQL 16) | Fluxo aeronáutica completo; paralelismo real (sobreposição de T1/T2); contexto mínimo; verificação de referências; ferramentas registradas; feedback em tarefa com propagação; retentativa em 429; tempo limite; cancelamento imediato; pausa/retomada; JWT e isolamento entre usuários; modelos Gemini; cofre; orçamento; keep-alive |
| `cd apps/web; npm test` | **30/30** | A\*, mundo ambiental (sem falso progresso, "aguardando dependência"), eventos SSE → estados, fluxo de dependências, stores, UI |
| `cd apps/web; npm run e2e` | **17/17** | Cadastro → verificação → login → recuperação/troca de senha → logout; projeto completo pelas 6 áreas; reanalisar; provedores; celular |
| `cd apps/web; npm run build` | OK | `tsc -b` + build de produção |

```powershell
# PostgreSQL real nos testes (ex.: docker compose up -d db)
$env:AGENTSLAB_TEST_DATABASE_URL="postgresql+psycopg://agentslab:agentslab@localhost:5432/agentslab"
pytest -q
```

Primeira execução dos E2E: `npx playwright install chromium`.

### CI/CD (GitHub Actions)

| Workflow | Gatilho | O que faz |
|---|---|---|
| **CI** | push/PR | `npm ci`, build, Vitest, Playwright (com API de teste) e pytest |
| **Showcase** | push na `main` (código) ou manual | Gera prints/vídeos/GIF e commita em `docs/media` (`[skip ci]`) |
| **Release** | tag `v*` | Zip do frontend + tarball da API anexados à release |

Como o Showcase commita na `main`, faça `git pull --rebase` antes de cada push. Em conflito em `docs/media`, use `git checkout --theirs -- docs/media`.

## 11. Referência da API e eventos

Todas as rotas `/api/v1/*` exigem `Authorization: Bearer <JWT do Supabase>` (no modo local, não). O SSE aceita `?access_token=`. Recurso de outro usuário responde **404**. A documentação interativa fica em `http://localhost:8000/docs`.

| Grupo | Rotas |
|---|---|
| Saúde | `GET /health` (versão da API e modo de autenticação) |
| Conta | `GET /me` |
| Organizações | `GET/POST /organizations`, `PUT/DELETE /organizations/{id}`, departamentos, `GET /organization-templates` |
| Agentes | `GET/POST /agents`, `GET/PUT/DELETE /agents/{id}`, `POST /agents/{id}/chat`, `POST /agents/{id}/tasks`, `GET /agents/{id}/activity` |
| Projetos | `GET/POST /projects`, `GET /projects/{id}`, `PUT …/plan`, `POST …/plan/decision`, `POST …/delivery/decision`, `POST …/control` (pause/resume/cancel), `PUT …/budget`, `POST …/reanalyze`, `POST …/retry`, `POST …/feedback` (`artifactId` **ou** `taskId`), `POST …/guidance` |
| Rastreabilidade | `GET …/messages`, `…/artifacts`, `…/artifacts/{aid}`, `…/diff`, `…/download`, `…/evidence`, `…/executions`, `…/tool-calls` |
| Provedores | `GET/PUT /providers`, `PATCH /providers/{id}`, `POST /providers/{id}/models/refresh` |
| Chaves | `GET/POST /credentials`, `DELETE /credentials/{id}`, `POST /credentials/{id}/default`, `GET /credentials/vault` |
| Painéis | `GET /overview`, `/usage`, `/executions`, `/messages`, `/workflows` |
| Tempo real | `GET /events` (SSE, com replay por `Last-Event-ID`) |

Eventos SSE: `agent.state` (idle, planning, working, reviewing, waiting, completed, failed, paused, com `taskKind`), `task.progress`, `task.context`, `task.finished`, `agent.message`, `artifact.version`, `evidence`, `tool.call`, `execution`, `llm.retry`, `project.updated`.

## 12. Modelo de dados

```mermaid
erDiagram
  ORGANIZATION ||--o{ DEPARTMENT : tem
  ORGANIZATION ||--o{ AGENT : emprega
  ORGANIZATION ||--o{ PROJECT : executa
  PROJECT ||--o{ TASK : "plano + revisões"
  PROJECT ||--o{ AGENT_MESSAGE : conversa
  PROJECT ||--o{ ARTIFACT : produz
  ARTIFACT ||--o{ ARTIFACT_VERSION : versões
  PROJECT ||--o{ EVIDENCE : "fontes E#"
  PROJECT ||--o{ TOOL_CALL : ferramentas
  PROJECT ||--o{ EXECUTION : "chamadas LLM"
  PROJECT ||--o{ APPROVAL : "plano/entrega"
  AGENT ||--o{ TASK : responsável
```

Todas as entidades do usuário têm `owner_id`. Tabelas auxiliares: `Credential` (metadados da chave), `Secret` (chave criptografada), `Event` (log append-only do SSE) e `KeyValue` (preferências). As colunas novas são adicionadas automaticamente na inicialização (`main.migrate()`), sem perder dados.

## 13. Segurança e custos

- **Chaves de LLM:** só no backend, criptografadas (Fernet) com a `AGENTSLAB_MASTER_KEY`. A API nunca as devolve; o navegador vê apelido e os 4 últimos dígitos.
- **Autenticação:** senhas e tokens ficam com o Supabase. O backend valida assinatura, audiência e papel do JWT, e o frontend usa apenas a chave publicável.
- **Isolamento:** todas as consultas são filtradas por `owner_id`, e o banco tem RLS ligado como defesa extra.
- **Conteúdo externo** (fontes, documentos) entra nos prompts delimitado como dado não confiável. Referências não confirmadas são marcadas; citações inexistentes são apontadas.
- **Limites:** orçamento por projeto, limite de chamadas, teto de tarefas, revisões automáticas, retentativas e tempo limite. Ao estourar, a execução pausa e o coordenador pede decisão.
- **Custos** registrados por chamada com as tarifas conhecidas pelo LiteLLM (sempre identificados como estimativa).
- **Repositório:** `.env`, bancos locais e cofres ficam no `.gitignore`. `scripts/publicar-github.ps1` bloqueia o envio de arquivos sensíveis.

## 14. Análise do projeto

### Maturidade

| Área | Estado | Evidência |
|---|---|---|
| Orquestração multiagente | Sólida para fluxos de pesquisa e relatório | Testes de paralelismo, dependências, propagação, falhas e limites |
| Rastreabilidade | Alta | Contexto por tarefa, ferramentas, execuções, versões e eventos persistidos |
| Segurança básica | Adequada para uso pessoal e pequenas equipes | JWT, isolamento por dono, RLS, cofre criptografado |
| Interface | Completa para o fluxo principal | 17 E2E cobrindo as 6 áreas do projeto e o login |
| Integrações reais | **Implementadas, não exercitadas no CI** | Gemini/OpenAlex/arXiv/Crossref dependem de rede e chave; os testes usam substitutos |

### Limitações conhecidas

- Só resumos e metadados de artigos (`full_text = false`). Ainda não há leitura de PDF.
- A execução roda no processo da API. Com várias instâncias, seria necessária uma fila externa (Redis + worker).
- No Render gratuito há um único processo (512 MB) e uma pequena espera ao acordar.
- Delegação dinâmica decidida pelo próprio agente ainda não existe. As tarefas vêm do plano aprovado, das revisões e do feedback.
- Referências sem DOI nem id arXiv ficam como "não confirmadas".
- Custos dependem da tabela de preços do LiteLLM. Modelos sem tarifa aparecem como US$ 0.

### Riscos e mitigação

| Risco | Mitigação atual | Próximo passo |
|---|---|---|
| Modelo descontinuado pelo provedor | Modelos testados com a chave; Reanalisar com troca de modelo | Alerta proativo de descontinuação |
| Limite de taxa (plano gratuito) | Concorrência por provedor + retentativa exponencial | Limite de requisições/minuto configurável |
| Perda da `MASTER_KEY` | Documentação e aviso no `.env.example` | Rotação de chave com recriptografia |
| Projeto Supabase pausado por inatividade | Aviso na documentação | Monitor de saúde |
| Credenciais expostas em capturas/chat | Orientação de troca | Rotação periódica da senha do banco |

### Próximas etapas

Texto completo de artigos (PDF) · upload de documentos e RAG (pgvector) · execução de fluxos do editor · reuniões visuais · fila externa · app desktop (Tauri) para a Microsoft Store. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## 15. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Faixa amarela "backend desatualizado" ou erros "Not Found" | O uvicorn rodando é de uma versão anterior | Pare (Ctrl+C) e inicie de novo |
| `ModuleNotFoundError: sqlalchemy` | Ambiente virtual não ativado | `.\.venv\Scripts\Activate.ps1` |
| `password authentication failed` (Render ou local) | URL do banco com senha errada ou placeholder | Teste com `python -c "from app.db import engine; engine.connect()"`; cole a URL do `.env` |
| Selo "Offline" no site publicado | CORS sem o endereço do frontend, ou Render acordando | Ajuste `AGENTSLAB_CORS_ORIGINS`; aguarde ~30 s |
| Projeto "sumiu" | Dono diferente ou banco diferente | `python scripts/listar_projetos.py` |
| `404 model not found` no Gemini | Modelo descontinuado | Provedores → Atualizar lista de modelos → projeto → Reanalisar |
| Link de e-mail abre o localhost | Site URL do Supabase ou `VITE_SITE_URL` desatualizados | Atualize os dois e refaça o deploy do frontend |
| Push rejeitado | Commit do Showcase na `main` | `git pull --rebase origin main` e depois `git push` |

## 16. Documentação complementar

[Arquitetura](docs/ARCHITECTURE.md) · [Validação da execução multiagente](docs/VALIDACAO_EXECUCAO.md) · [Supabase](docs/SUPABASE.md) · [Publicação](docs/DEPLOY.md) · [Roadmap e decisões](docs/ROADMAP.md) · [Modelo de agentes](docs/AGENT_MODEL.md) · [Design System](docs/DESIGN_SYSTEM.md) · [Telas](docs/SCREENS.md) · [Plano de adaptação](docs/PLANO_ADAPTACAO.md) · [Regras do projeto (CLAUDE.md)](CLAUDE.md)

---

Desenvolvido por **Vinicius Santos**. O repositório não declara licença de uso; todos os direitos são reservados ao autor até que uma licença seja adicionada.
