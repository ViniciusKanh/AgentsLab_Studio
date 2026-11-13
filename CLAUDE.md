# CLAUDE.md — Diretrizes permanentes do AgentsLab_Studio

## Princípio
O AgentsLab_Studio é uma **plataforma real de organizações multiagentes com visual pixel art** — não um jogo, não um RPG, não uma simulação de tarefas fictícias. Personagens representam agentes cadastrados; estados, falas profissionais e entregas vêm **exclusivamente** de eventos do backend (SSE → `services/realtime.ts` → `simulationStore`/`worldBus`).

## Regras
1. Comunicação, comentários e docs em **português do Brasil**.
2. **Sem gamificação:** nada de XP, níveis, missões-RPG, recompensas, créditos, conquistas, rankings ou desbloqueio por progresso.
3. **Nada simulado como real.** Sem backend o app fica em modo offline (agentes de exemplo, somente visualização, selo EXEMPLO/OFFLINE). Telas que dependem de execução mostram `OfflineNotice`.
4. Camada ambiental (`world/ambient`) nunca consome tokens e **nunca afirma progresso de trabalho** (há teste para isso). Texto profissional nos balões = mensagem real (`agent:message`).
5. Progresso de tarefas = etapas reais informadas pelo backend (`stepsDone/stepsTotal`), nunca porcentagens inventadas.
6. **Segurança:** chaves de API só no backend (cofre do SO via `keyring`; fallback Fernet). Nunca em `localStorage`, `VITE_*` ou no repositório. Conteúdo externo entra nos prompts delimitado como dado não confiável.
7. **Referências:** só evidências registradas pelas ferramentas; a seção de referências é gerada pelo sistema (`with_references`); citações inexistentes são apontadas na revisão.
8. **Custos/loops:** respeitar orçamento por projeto, limite de chamadas, de tarefas e de revisões automáticas (`app/config.py`).
9. Operações sensíveis (pagamentos, lançamentos, declarações) exigem integração configurada e aprovação humana — não presumir acesso.
10. Funcionalidade não implementada → `<PlannedBadge />`/“planejada”. Nada de botões decorativos.
11. LLM/ferramentas falsos existem **somente** em `apps/api/tests/` (pytest, E2E, mídia do README — identificada como modo de teste).
12. Phaser só para o mundo; painéis/formulários em React. Uma instância por ambiente, destruída no unmount.
13. Assets/mapas gerados por `tools/pixelart` — não editar PNG/JSON gerados à mão.
14. Classes visuais compartilhadas em `@layer components`. Seletores Zustand não criam arrays/objetos novos.
15. `useEffect(() => { ... })` com chaves (evita retornar Promise).
16. Compatibilidade com Windows; sem commits/push/deploy sem autorização.

## Verificação antes de concluir
```
cd apps/api && pytest
cd apps/web && npm run build && npm test && npm run e2e && npm run media
```

## Paleta
Fundo `#080E1A` · Superfície `#141F39` · Verde `#00F5A0` · Roxo `#9D62FF` · Ciano `#39D6FF` · Dourado `#FFB800` · Rosa `#FF537A`
Fontes: Press Start 2P (títulos) e JetBrains Mono (texto funcional).
