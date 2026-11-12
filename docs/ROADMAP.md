# Roadmap

| Fase | Escopo | Status |
|---|---|---|
| 1 — Prototipação e frontend | Mundo virtual imersivo (escritório e laboratório), agentes autônomos, Agent Studio, workflows, modelos, gamificação, modo demo, deploy estático, CI | **Implementada (v1.1)** |
| 2 — Infraestrutura e persistência | FastAPI, PostgreSQL, autenticação, CRUD real de agentes/workflows/projetos, `apiDataSource` ativo | Estrutura preparada (`apps/api`, contratos, rotas 501) |
| 3 — Integrações com LLMs | LiteLLM, credenciais no backend, teste de conexão, limites e registro de consumo/custo | Parcial: cofre de credenciais (multi-chave por provedor) implementado |
| 4 — Execução multiagente | LangGraph, filas/workers, ferramentas com permissões, memória, RAG (pgvector), aprovação humana, SSE | Planejada |
| 5 — Simulação integrada | Eventos reais → personagens; novos ambientes (Biblioteca, Arena, Automação, Projetos) | Planejada |
| 6 — Pesquisa e otimização | Experimentos, benchmarks, relatórios comparativos | Planejada |

## Histórico de decisões
- **2026-11-12** — Vite + React Router (sem Next.js) para build estático; Phaser apenas para salas; rótulos DOM sobre o canvas.
- **2026-11-12** — Assets pixel art procedurais em Python (`tools/pixelart`) (v1.0: `rooms.json`; v1.1: `world_maps.py` → `src/world/data`).
- **2026-11-12** — Estado de execução centralizado por eventos (`SimulationEvent`), compartilhado entre demo e modo real.
- **2026-11-12** — Gamificação apenas por ações verificáveis; XP/créditos separados de tokens reais.
- **2026-11-12** — Sem `_redirects` no Cloudflare Pages (fallback SPA nativo); `vercel.json` com rewrite para `index.html`.
- **2026-11-12 (v1.1)** — Redesign “Environment First”: mapas 40×23 em grade, A*, AmbientWorld separado da camada operacional, painel contextual e faixa de eventos; dashboard virou ferramenta de apoio (`/painel`).
- **2026-11-12 (v1.1)** — Central de Orquestração passou a “planejada” (será portada ao novo motor). Dados demo migrados de v1 → v2 automaticamente.
- **2026-11-12 (v1.1)** — Perfis de credencial por agente; segredos só no backend (Fernet).
- **2026-11-12 (v1.1)** — GitHub Actions: CI, Showcase (prints/vídeo/GIF commitados em docs/media) e Release (bundle zip).
