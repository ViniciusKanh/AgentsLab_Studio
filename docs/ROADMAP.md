# Roadmap

| Etapa | Escopo | Status |
|---|---|---|
| v1.0–1.1 | Mundo pixel art (escritório e laboratório), agentes ambientais, Agent Studio, editor de fluxos, CI/Showcase/Release | Implementada |
| **v1.2 — Plataforma de organizações** | Remoção da gamificação; organizações/departamentos; projetos por prompt com plano aprovado pelo gestor; execução real com dependências; mensagens estruturadas; evidências OpenAlex/arXiv; documentos versionados com diff; feedback/orientação; custos e limites; SSE com replay; mundo dirigido por eventos reais; chaves no cofre do SO | **Implementada e testada com LLM/ferramentas de teste.** Chamadas a provedores reais dependem da sua chave (não executadas no ambiente de desenvolvimento) |
| Próxima | Reuniões visuais (vários agentes na mesa), tarefas por departamento no escritório, chat com contexto do projeto, upload de documentos (RAG/pgvector), texto completo de artigos (PDF), execução de fluxos do editor | Planejada |
| Environment Studio | Editor de ambientes (os mapas já são dados estruturados) | Planejada |
| Desktop / Microsoft Store | Tauri 2 + backend sidecar (PyInstaller) + MSIX; atualização automática; chaves no cofre do Windows | Planejada |
| Escala | PostgreSQL + fila externa (Redis/worker), autenticação multiusuário, observabilidade | Planejada |

## Histórico de decisões
- **2026-11-12 (v1.2)** — Gamificação removida por decisão do gestor; pixel art mantido.
- **2026-11-12 (v1.2)** — Orquestração própria (asyncio, estado persistido, retomada no boot) em vez de LangGraph nesta etapa: fluxo vertical determinístico e auditável; LangGraph poderá ser adotado quando houver fluxos condicionais configuráveis.
- **2026-11-12 (v1.2)** — SQLite local por padrão (app desktop), PostgreSQL por URL.
- **2026-11-12 (v1.2)** — Chaves no cofre do SO via `keyring` (Windows: Gerenciador de Credenciais); Fernet só como fallback.
- **2026-11-12 (v1.2)** — Referências geradas pelo sistema a partir das evidências; o modelo só cita códigos `[E#]`.
- **2026-11-12 (v1.2)** — Backend detectado em tempo de execução (URL configurável); sem backend = modo offline somente visual.
- **2026-11-12** — Vite + React Router; Phaser apenas no mundo; assets procedurais; estado operacional por eventos.
