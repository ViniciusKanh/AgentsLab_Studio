# AgentsLab_Studio

**Plataforma de organizações multiagentes com visual pixel art.** Você descreve um trabalho em linguagem natural; o agente coordenador da organização propõe um plano; você aprova ou ajusta; os agentes executam tarefas reais (chamadas a LLMs e a ferramentas de pesquisa), trocam entregas, consolidam um documento, revisam e produzem versões a partir do seu feedback. O escritório e o laboratório em pixel art mostram esse trabalho acontecendo: estados, mensagens e entregas dos personagens vêm do backend.

![Laboratório durante um projeto](docs/media/demo-laboratorio.gif)

| Plano proposto pelo coordenador | Entrega versionada com referências |
|---|---|
| ![Plano](docs/media/projeto-plano.png) | ![Entrega](docs/media/projeto-entrega.png) |
| ![Organizações](docs/media/organizacoes.png) | ![Custos](docs/media/custos.png) |

> As capturas acima são geradas automaticamente com a API em **modo de teste** (respostas determinísticas, sem LLM real) para não depender de chaves no CI. Com suas chaves, o mesmo fluxo usa os modelos reais.

## v1.2 — o que mudou

- **Sem gamificação:** XP, níveis, missões-RPG, recompensas, créditos e conquistas foram removidos. O estilo pixel art permanece.
- **Organizações e departamentos** (Laboratório de Pesquisa em IA, Escritório Empresarial; modelo Fábrica de Software), cada uma com coordenador e equipe.
- **Projetos por prompt** com aprovação humana do plano, execução com dependências, mensagens estruturadas (solicitação, entrega, revisão, orientação, feedback…), consolidação, revisão e **documentos versionados com diff**.
- **Evidências rastreáveis:** fontes reais do OpenAlex e arXiv (DOI/URL), marcação “apenas resumo”, referências geradas pelo sistema (o modelo não escreve a lista) e detecção de citações inexistentes.
- **Custos e limites:** cada chamada é registrada (tokens, latência, custo estimado pelo LiteLLM) por agente, projeto, modelo e provedor; orçamento por projeto pausa a execução.
- **Mundo conectado ao backend:** estados reais, balões com mensagens reais e entregas (o agente caminha até o colega). A ambientação (café, conversas sociais) nunca afirma progresso de trabalho.
- **Chaves digitadas no app → cofre do sistema operacional** (Windows: Gerenciador de Credenciais).

## Chaves de API

1. Inicie o backend (abaixo) — o app mostra **Conectado** na barra superior.
2. **Provedores e Custos → Chaves (API) → Novo perfil**: provedor, apelido e a chave.
3. **Agent Studio → Inteligência → Chave de API**: escolha o perfil de cada agente (ou deixe o padrão do provedor, marcado com ★).

A chave sai do navegador uma única vez para o backend local, que a guarda no **cofre do sistema** via `keyring` (Windows: Gerenciador de Credenciais/DPAPI; macOS: Keychain; Linux: Secret Service). O banco guarda só apelido e os 4 últimos dígitos; a API nunca devolve a chave. Sem cofre disponível (CI/servidor), use `AGENTSLAB_SECRET_BACKEND=file` + `AGENTSLAB_MASTER_KEY` (arquivo criptografado com Fernet).

**Microsoft Store (planejado):** empacotar com Tauri 2 (frontend) + backend Python como *sidecar* (PyInstaller) em MSIX — o mesmo modelo de chaves no cofre do Windows. Detalhes em [docs/PLANO_ADAPTACAO.md](docs/PLANO_ADAPTACAO.md).

## Como executar (Windows / PowerShell)

Backend (onde os agentes executam):

```powershell
cd C:\dev\AgentsLab_Studio\apps\api
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Frontend (outro terminal):

```powershell
cd C:\dev\AgentsLab_Studio\apps\web
npm install
npm run dev          # http://localhost:5173
```

O banco SQLite fica em `apps/api/data/agentslab.db` (PostgreSQL: `AGENTSLAB_DATABASE_URL`). Sem backend, o app abre em **modo offline** com agentes de exemplo apenas para visualização — nada é executado.

### Primeiro projeto (teste obrigatório)

**Projetos → Novo projeto →** “Usar exemplo: pesquisa sobre IA na aeronáutica” → organização *Laboratório de Pesquisa em IA* → **Enviar ao coordenador** → revise/ajuste o plano → **Aprovar e iniciar**. Acompanhe no Laboratório ou na aba Tarefas; ao final, leia o relatório (aba Documentos), confira as evidências, envie feedback e compare as versões (Diff).

## Testes

| Comando | O que valida |
|---|---|
| `cd apps/api; pytest` | 12 testes: fluxo completo da aeronáutica (plano → edição → aprovação → dependências → evidências → consolidação → revisão automática → feedback → v3 + diff → aprovação → custos), cofre multi-chave, orçamento, cancelamento, chat, tarefa avulsa, CRUD |
| `cd apps/web; npm test` | Vitest: A\*, motor ambiental (entregas reais, ambientação sem falso progresso), eventos SSE → estados, stores, UI |
| `npm run e2e` | Playwright: offline + conectado à API de teste (chave → cofre, projeto completo no navegador) |
| `npm run media` | gera prints, MP4 e GIF em `docs/media` |

Os testes usam LLM e ferramentas **determinísticos** (`apps/api/tests/fakes.py`), carregados somente nos testes.

## Publicar no GitHub

```powershell
cd C:\dev\AgentsLab_Studio
powershell -ExecutionPolicy Bypass -File .\scripts\publicar-github.ps1 -Mensagem "feat: plataforma de organizações multiagentes"
```

| Workflow | Quando | Resultado |
|---|---|---|
| **CI** | push/PR | build, Vitest, E2E (com API de teste) e pytest |
| **Showcase** | push na `main` ou manual | prints, vídeo e GIF commitados em `docs/media` |
| **Release** | tag `v*` | zip do frontend + tarball da API |

## Estrutura

```
apps/api/app
  models.py              organizações, departamentos, agentes, projetos, tarefas, mensagens, artefatos+versões, evidências, execuções, aprovações, eventos
  services/orchestrator  planejamento → aprovação → execução com dependências → consolidação → revisão → feedback
  services/llm.py        LiteLLM (Gemini, Groq, OpenAI, Hugging Face, Ollama), custo por chamada
  services/tools.py      OpenAlex + arXiv (fontes reais)
  services/vault.py      cofre do SO (keyring) / Fernet
  services/events.py     eventos persistidos + SSE com replay
  routers/               credentials, organizations (+agents/chat/tarefas), projects, system (SSE, provedores, uso, visão geral)
apps/web/src
  features/projects      projetos e espaço de trabalho (plano, tarefas, mensagens, documentos, evidências, custos)
  features/organizations, documents, analytics (execuções), models (provedores e custos), agents (Agent Studio)
  world/                 mundo pixel art (A*, AmbientWorld, Phaser) alimentado por services/realtime.ts (SSE)
tools/pixelart           gerador procedural de sprites e mapas
```

Documentação: [Plano de adaptação](docs/PLANO_ADAPTACAO.md) · [Arquitetura](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Design System](docs/DESIGN_SYSTEM.md) · [Agentes](docs/AGENT_MODEL.md) · [CLAUDE.md](CLAUDE.md)
