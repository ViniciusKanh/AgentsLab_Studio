# CLAUDE.md — Diretrizes permanentes do AgentsLab_Studio

## Princípio
O AgentsLab_Studio é um **sistema real de agentes com interface de jogo de gerenciamento**, não um jogo que simula IA. Os personagens representam agentes cadastrados; seus estados vêm **exclusivamente** do `simulationStore` alimentado por eventos (`SimulationEvent`) — demo hoje, backend amanhã.

## Regras
1. Comunicação, comentários e docs em **português do Brasil**.
2. Fase atual: **Fase 1 concluída** (frontend + modo demo). Não antecipar fases sem pedido explícito.
3. Todo dado fictício leva `origin: 'demo'` e o selo visual `<DemoTag />`. Nunca apresentar demo como real.
4. Funcionalidade não implementada → `<PlannedBadge />` ou página `PlannedPage`. Nada de botões decorativos.
5. **Segurança:** nenhuma chave de API no frontend nem em `VITE_*`. Credenciais só no backend.
6. Páginas consomem dados via `src/services/dataSource.ts` (`LabDataSource`). Trocar demo→real não exige mudar páginas.
7. Phaser só para o mundo virtual (`src/game`). Painéis, formulários e métricas em React.
8. Uma instância `Phaser.Game` por ambiente montado; destruir no unmount (`world/render/WorldCanvas.tsx`).
9. Assets e mapas são gerados por `tools/pixelart/generate.py` (layout em `world_maps.py` → `src/world/data/*.json`). Não editar PNGs/JSONs gerados à mão — alterar o gerador.
10. Logotipo: somente os recortes do original em `tools/branding/source`. Não substituir por ícones/emoji.
11. Classes visuais compartilhadas ficam em `@layer components` (`src/styles/index.css`) para não sobrescrever utilitários Tailwind.
12. Seletores Zustand não devem criar arrays/objetos novos (`filter`/`map` dentro do seletor) — use `useMemo`.
13. Compatibilidade com Windows; sem commits/push/deploy sem autorização.

14. **Duas camadas:** comportamento ambiental (`world/ambient`) nunca consome tokens; estados operacionais têm prioridade e vêm de eventos.
15. Velocidade da simulação afeta só a camada ambiental.
16. Chaves de API: apenas via backend (`/api/v1/credentials`, Fernet). Nunca em `localStorage`, `VITE_*` ou no repositório.
17. Em efeitos React, use corpo com chaves `useEffect(() => { ... })` — `scrollIntoView` pode retornar Promise.

## Verificação antes de concluir
```
cd apps/web
npm run build && npm test && npm run e2e && npm run media
```
Comparar screenshots (`e2e/.results`) com os protótipos em `docs/SCREENS.md`.

## Paleta
Fundo `#080E1A` · Superfície `#141F39` · Verde `#00F5A0` · Roxo `#9D62FF` · Ciano `#39D6FF` · Dourado `#FFB800` · Rosa `#FF537A`
Fontes: Press Start 2P (títulos/valores retrô) e JetBrains Mono (texto funcional).
