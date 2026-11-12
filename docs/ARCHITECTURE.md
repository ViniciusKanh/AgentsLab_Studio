# Arquitetura

## Visão geral (v1.1 — Environment First)

```
┌──────────────────────────── apps/web (SPA estática) ────────────────────────────┐
│ React (menus, painéis, formulários)          Phaser (somente o ambiente 2D)      │
│  features/world/WorldPage ──► world/render/WorldCanvas ──► WorldScene            │
│        ▲  painel, feed, missões      ▲ overlay DOM (rótulos/balões, sem React)   │
│        │                             │                                           │
│   worldBus (eventos tipados React ↔ Phaser: seleção, câmera, fala, feed)         │
│        │                                                                         │
│  CAMADA 1 — world/ambient/AmbientWorld (puro TS, testável)                       │
│    tilemap de navegação + A* · pontos de interação com reserva · personalidade  │
│    decisões com limite de frequência · conversas · emotes                        │
│        ▲ setOperational(estado)   (prioridade da camada 2)                       │
│  CAMADA 2 — stores/simulationStore.ingest(SimulationEvent)                       │
│    demo: simulation/demoSimulator   |   real: SSE /api/v1/events (Fase 4/5)      │
│  stores/labStore ── services/dataSource (demo: localStorage | real: FastAPI)     │
└─────────────────────────────────────────────────────────────────────────────────┘
                 │ HTTPS
┌────────────── apps/api (FastAPI) ──────────────┐
│ /health · /api/v1/credentials (cofre Fernet)    │
│ rotas planejadas → 501 · LangGraph/LiteLLM (F3+) │
└─────────────────────────────────────────────────┘
```

## Separação de responsabilidades

| Sistema | Onde | Observação |
|---|---|---|
| Estado operacional | `stores/simulationStore` | só muda por `SimulationEvent`; mesma fonte para demo e real |
| Estado visual / UI do mundo | `stores/worldStore` | velocidade ambiental, rótulos, modos, feed |
| Movimentação | `world/nav/astar.ts` + `AmbientWorld.move` | grade 4-direções, sem atravessar paredes/móveis |
| Interações e objetos | pontos `work/meet/coffee/rest/read/observe/window` em `world/data/*.json` | reserva evita dois agentes no mesmo lugar |
| Diálogos | `world/ambient/dialogues.ts` | frases locais; mensagens profissionais marcadas como demo/real |
| Animações | `world/render/WorldScene.ts` (ANIMS) | 12 animações por personagem |
| Cenas | `world/maps.ts` + `tools/pixelart/world_maps.py` | novo ambiente = novo JSON + entrada no mapa |
| Eventos | `world/events/bus.ts` | barramento tipado, sem dependências |
| Tarefas/missões | `stores/missionStore` + `demoSimulator.runMission` | real: POST /missions (Fase 4) |

## Desempenho
- Posições não passam pelo React: a cena atualiza sprites e a camada DOM diretamente.
- Decisões ambientais com intervalo mínimo de 1,5 s por agente; `dt` limitado a 100 ms.
- Atlas único de props por ambiente; animações compartilhadas; cena e overlay destruídos no unmount.
- O Phaser pausa o loop quando a aba fica inativa (VisibilityHandler).

## Credenciais
`apps/api/app/services/vault.py`: SQLite + Fernet (`AGENTSLAB_MASTER_KEY`). Endpoints `GET/POST/DELETE /api/v1/credentials` nunca devolvem a chave. `Agent.intelligence.credentialId` liga o agente ao perfil; na Fase 3 o LiteLLM usará `vault.reveal()` apenas no backend.

## Contratos
`src/types/domain.ts` ↔ `apps/api/app/schemas`: Agent (com `personality` e `credentialId`), CredentialProfile, Mission, ChatMessage, Provider, Workflow, ExecutionRun, SimulationEvent, AgentRuntime, entre outros.
