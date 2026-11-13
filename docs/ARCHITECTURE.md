# Arquitetura (v1.4 — execução multiagente rastreável)

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
2. Status `awaiting_approval` + `Approval(plan)` + mensagem `decisao` do coordenador. O gestor edita (`PUT /plan`) e aprova ou devolve (`/plan/decision`). Na aprovação, o plano é congelado em `plan.plano_aprovado` (registro imutável).
3. `run()`: tarefas prontas (dependências concluídas) executam em paralelo (limite `task_concurrency`); chamadas ao modelo passam por um semáforo **por provedor** (`provider_concurrency`). Erros transitórios (429/5xx/timeout) são repetidos com espera exponencial (`llm_max_retries`, limitado por `limits.maxRetries` do agente); cada tentativa fica registrada como `Execution(status=retry)`. Cada tarefa tem tempo máximo (`task_timeout_sec`); cada chamada usa `limits.timeoutSec` do agente.
4. **Contexto mínimo** (`Task.context`): cada tarefa recebe só as versões atuais dos documentos das dependências diretas e as evidências produzidas por elas ou citadas nesses documentos; o revisor recebe só o relatório e as fontes que ele cita. O contexto entregue fica gravado na tarefa.
5. Pesquisa: busca (OpenAlex/arXiv) → `Evidence(E#)` → **verificação independente** de cada referência (Crossref por DOI, arXiv por id) → `verificada | divergente | nao_confirmada | pendente`. Toda busca/verificação é um `ToolCall` (entrada, saída, latência) e evento `tool.call`.
6. Ao concluir, o agente envia `entrega` para quem depende dele (no mundo: caminha até o colega). Agentes com tarefa bloqueada por dependência recebem o estado `waiting`.
7. Redação consolida as entregas; o **sistema** gera as referências a partir dos códigos `[E#]` citados, marcando “✔ verificada” ou “⚠ não confirmada”.
8. Revisão (JSON) + checagem de citações inexistentes + sinalização de referências não confirmadas; se reprovado, cria `RV#` (máx. `max_auto_revisions`); esgotado o limite, o coordenador pede decisão humana.
9. `delivered` + `Approval(delivery)` + `decisao`. **Feedback** (`POST /feedback` com `artifactId` **ou** `taskId`): identifica o responsável (autor/dono ou o agente indicado), cria `FB#` (nova versão do documento), propaga para os documentos derivados (`UP#`, encadeadas pelas dependências) e, se já houve revisão, cria `RR#` (nova revisão). Tarefa com falha recebe o feedback como orientação e é reaberta com as dependentes. Versões anteriores são preservadas (diff por `difflib`). Aprovação → `completed`.
10. Pausa: vale na próxima etapa de cada agente (sem desperdiçar a chamada em curso). Cancelamento: imediato (`asyncio` cancela as chamadas em andamento; histórico preservado). Orçamento e limite de chamadas são verificados antes de cada chamada; ao estourar, o projeto pausa e o coordenador pede decisão. Teto de tarefas por projeto (`max_total_tasks_per_project`) impede delegação sem fim.
11. A execução roda no backend: fechar a página não interrompe; `recover()` retoma projetos ao reiniciar o servidor.

## Dados
`Organization`, `Department`, `Agent(config JSON)`, `Project`, `Task`, `AgentMessage(tipo)`, `Artifact`/`ArtifactVersion`, `Task(context, attempts)`, `Evidence(código, DOI/URL, resumo, full_text, verification)`, `ToolCall(ferramenta, entrada, saída, latência)`, `Execution(tokens, custo, latência, status ok|retry|error)`, `Artifact(código D#)`, `AgentMessage(needs_decision)`, `Approval`, `Credential(metadados)`, `Event(log append-only)`, `KeyValue`.

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

## Espaço de trabalho do projeto (frontend, v1.4)
`features/projects/ProjectWorkspacePage.tsx` + `features/projects/workspace/*`: áreas em abas — **Planejamento** (revisão do plano, plano aprovado, fluxo por etapas), **Execução** (estado dos agentes derivado das tarefas, atividades com duração/ferramentas, detalhe contextual da tarefa, histórico de eventos), **Conversas** (filtros por participante, tarefa e tipo), **Documentos** (metadados, versões, diff, evidências com verificação), **Revisão** (aprovação da entrega, feedback em documento ou tarefa, ciclo de correções) e **Custos** (por agente, tarefa e modelo). A área e a seleção ficam na URL (`?area=documentos&doc=…`), o que permite links a partir do painel do agente no mundo (aba **Trabalho**, `GET /agents/{id}/activity`).
