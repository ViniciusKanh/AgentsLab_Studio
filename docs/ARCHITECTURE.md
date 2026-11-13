# Arquitetura (v1.2 — plataforma de organizações multiagentes)

```
┌──────────────────────────── apps/web (React + Phaser) ───────────────────────────┐
│ Páginas: Visão Geral (mundo) · Organizações · Ambientes · Agentes · Projetos ·    │
│          Tarefas e Fluxos · Documentos · Execuções · Provedores e Custos · Config │
│ services/backend.ts  URL do backend (configurável) + health check → modo real/off │
│ services/platform.ts cliente REST          services/realtime.ts EventSource (SSE) │
│        │                                        │ agent.state/task.progress →     │
│        │                                        │   simulationStore (estados)     │
│        │                                        │ agent.message → worldBus →      │
│        ▼                                        ▼   balões e caminhadas de entrega│
│ world/ (A*, AmbientWorld, WorldScene) — ambientação local sem tokens              │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │ HTTP + SSE (localhost)
┌────────────────────────────── apps/api (FastAPI) ────────────────────────────────┐
│ routers: credentials · organizations/agents · projects · system (SSE, uso…)       │
│ services/orchestrator: plan → aprovação → run (dependências, semáforo) →          │
│   research(OpenAlex/arXiv → Evidence) · analysis · writing(+referências) ·        │
│   review(JSON, citações) → revisão automática (1x) → delivered → feedback → nova  │
│   versão · orientação · pausa/cancelamento · orçamento/limites · recover() no boot│
│ services/llm (LiteLLM, custo por chamada) · tools · vault (keyring/Fernet) ·      │
│ events (Event persistido + fila por assinante, replay por Last-Event-ID)          │
│ SQLAlchemy: SQLite (padrão) | PostgreSQL                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Fluxo de um projeto
1. `POST /projects` (prompt) → mensagem `solicitacao` do gestor → coordenador gera o plano (JSON validado: ids de agentes, chaves únicas, sem ciclos, ≤ limite de tarefas, garante redação e revisão; pesquisa só para agentes com a ferramenta `literature_search`).
2. Status `awaiting_approval` + `Approval(plan)`. O gestor edita (`PUT /plan`) e aprova ou devolve (`/plan/decision`).
3. `run()`: tarefas prontas (dependências concluídas) executam em paralelo (limite `task_concurrency`). Cada etapa emite `task.progress` com `stepsDone/stepsTotal` reais.
4. Ao concluir, o agente envia `entrega` para quem depende dele (no mundo: caminha até o colega).
5. Redação consolida as entregas; o **sistema** gera a seção de referências a partir dos códigos `[E#]` citados.
6. Revisão (JSON) + checagem automática de citações inexistentes; se reprovado, cria `RV1` (máx. `max_auto_revisions`).
7. `delivered` + `Approval(delivery)`. Feedback cria tarefa de revisão → nova `ArtifactVersion` (diff por `difflib`). Aprovação → `completed`.
8. Antes de cada chamada: orçamento e limite de chamadas; ao estourar, o projeto pausa com alerta.

## Dados
`Organization`, `Department`, `Agent(config JSON)`, `Project`, `Task`, `AgentMessage(tipo)`, `Artifact`/`ArtifactVersion`, `Evidence(código, DOI/URL, resumo, full_text)`, `Execution(tokens, custo, latência, status)`, `Approval`, `Credential(metadados)`, `Event(log append-only)`, `KeyValue`.

## Contas e isolamento (v1.3)
- Frontend: `services/supabase.ts` (cliente PKCE, armazenamento “lembrar de mim”), `stores/authStore.ts`, `features/auth/*` (telas e guardas `RequireAuth`/`PublicOnly`), `services/http.ts` (Bearer token), SSE com `?access_token=`.
- Backend: `app/auth.py` valida o JWT (JWKS do Supabase ou HS256 legado); `app/deps.py` injeta o usuário e cria suas organizações iniciais; rotas filtram por `owner_id`.
- Banco: SQLite local ou PostgreSQL (schema `agentslab`, RLS) + `public.profiles` — ver `docs/SUPABASE.md`.

## Segurança
- Chave digitada no app → `POST /credentials` → cofre do SO (`keyring`); banco só com apelido/últimos 4. Resolução: perfil do agente → padrão do provedor → variável de ambiente.
- Prompts delimitam fontes e documentos como **dados não confiáveis**.
- CORS restrito a localhost/tauri; a API escuta em localhost.

## Ambiente visual
- Camada 1 (`AmbientWorld`): navegação, café, conversas sociais neutras — sem tokens e sem falar de trabalho.
- Camada 2: estados reais (`setOperational`), `say()` com mensagens reais, `deliver()` para entregas.
