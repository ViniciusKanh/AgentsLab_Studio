# Roadmap

| Etapa | Escopo | Status |
|---|---|---|
| v1.0–1.1 | Mundo pixel art (escritório e laboratório), agentes ambientais, Agent Studio, editor de fluxos, CI/Showcase/Release | Implementada |
| **v1.2 — Plataforma de organizações** | Remoção da gamificação; organizações/departamentos; projetos por prompt com plano aprovado pelo gestor; execução real com dependências; mensagens estruturadas; evidências OpenAlex/arXiv; documentos versionados com diff; feedback/orientação; custos e limites; SSE com replay; mundo dirigido por eventos reais; chaves no cofre do SO | **Implementada e testada com LLM/ferramentas de teste.** Chamadas a provedores reais dependem da sua chave (não executadas no ambiente de desenvolvimento) |
| **v1.3 — Contas e publicação** | Supabase Auth (cadastro, verificação, login, recuperação, logout, rotas protegidas), perfis + RLS, backend multiusuário validando JWT, schema `agentslab` em PostgreSQL, cofre de chaves no banco para servidor, Dockerfile, reanalisar/repetir projeto, provedores com salvar e listagem ao vivo de modelos, layout responsivo | **Implementada e testada** com Supabase Auth falso local e PostgreSQL 16 local. Projeto Supabase real e e-mails reais: validar após configurar |
| Próxima | Reuniões visuais (vários agentes na mesa), tarefas por departamento no escritório, chat com contexto do projeto, upload de documentos (RAG/pgvector), texto completo de artigos (PDF), execução de fluxos do editor | Planejada |
| Environment Studio | Editor de ambientes (os mapas já são dados estruturados) | Planejada |
| Desktop / Microsoft Store | Tauri 2 + backend sidecar (PyInstaller) + MSIX; atualização automática; chaves no cofre do Windows | Planejada |
| Escala | PostgreSQL + fila externa (Redis/worker), autenticação multiusuário, observabilidade | Planejada |

## Histórico de decisões
- **2026-11-13 (v1.3)** — Supabase Auth + PostgreSQL (escolha do gestor). Links de e-mail com `token_hash` (`/auth/confirm` → `verifyOtp`) para funcionar entre dispositivos; PKCE no SDK.
- **2026-11-13 (v1.3)** — Tabelas do backend no schema `agentslab` (fora da Data API) com RLS ligado; isolamento aplicado no backend por `owner_id`.
- **2026-11-13 (v1.3)** — Sem Supabase configurado, o app continua em modo local de usuário único (desktop).
- **2026-11-12 (v1.2)** — Gamificação removida por decisão do gestor; pixel art mantido.
- **2026-11-12 (v1.2)** — Orquestração própria (asyncio, estado persistido, retomada no boot) em vez de LangGraph nesta etapa: fluxo vertical determinístico e auditável; LangGraph poderá ser adotado quando houver fluxos condicionais configuráveis.
- **2026-11-12 (v1.2)** — SQLite local por padrão (app desktop), PostgreSQL por URL.
- **2026-11-12 (v1.2)** — Chaves no cofre do SO via `keyring` (Windows: Gerenciador de Credenciais); Fernet só como fallback.
- **2026-11-12 (v1.2)** — Referências geradas pelo sistema a partir das evidências; o modelo só cita códigos `[E#]`.
- **2026-11-12 (v1.2)** — Backend detectado em tempo de execução (URL configurável); sem backend = modo offline somente visual.
- **2026-11-12** — Vite + React Router; Phaser apenas no mundo; assets procedurais; estado operacional por eventos.
