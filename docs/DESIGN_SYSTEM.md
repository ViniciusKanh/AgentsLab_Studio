# Design System

## Identidade
Pixel art 16 bits + RPG de gerenciamento + cyberpunk retrô. Referências: 5 imagens anexadas ao projeto (dashboard neon, ambientes, protótipos, escritório imersivo, logotipo).

## Tokens (src/styles/index.css → `@theme`)
| Token | Cor | Uso |
|---|---|---|
| `lab-bg` | `#080E1A` | fundo |
| `lab-surface` | `#141F39` | superfícies |
| `neon-green` | `#00F5A0` | ação primária, sucesso, ativo |
| `neon-purple` | `#9D62FF` | bordas principais, colaboração |
| `neon-cyan` | `#39D6FF` | informação, planejamento |
| `neon-gold` | `#FFB800` | gamificação, revisão, DEMO |
| `neon-pink` | `#FF537A` | erro, latência, exclusão |

Tipografia: **Press Start 2P** (`title-pixel`) para títulos e valores; **JetBrains Mono** para todo o resto. Fontes servidas localmente via `@fontsource`.

## Componentes (`src/components`)
- `px-panel` + `c-{accent}`: painel com borda neon, brilho interno e cantos pixelados. Componente React `Panel` (título, ícone, ações, selo DEMO, faixas).
- `px-btn` (`solid`, `ghost`, `sm`), `px-input`, `px-label`, `px-chip`, `px-bar` (barra segmentada HP/XP), `px-inset`.
- `StatCard` (KPI), `Avatar` (retrato pixel), `PixelIcon`, `Toggle`, `Tabs`, `Field`, `Chip`, `ProgressBar`, `Modal`/`ConfirmModal`, `Toaster`, `DemoTag`, `PlannedBadge`.
- Layout: `ProfileCard`, `Sidebar`, `TopBar` (cena panorâmica + logotipo + contadores), `StatusBar`.

## Assets (`public/assets`, gerados por `tools/pixelart`)
| Pasta | Conteúdo |
|---|---|
| `branding/` | logo horizontal, wordmark, emblema, ícones 192/512 (recortes do original) |
| `sprites/` | `characters.png` (13 personagens × 17 quadros 16×24), mesas (3 paletas × 4), globo, gato, ícones de estado 8×8 |
| `avatars/` | retratos 24×24 (×4) |
| `environments/` | fundos 384×192, previews compostos e miniaturas |
| `ui/` | ícones 16×16 (×2), provedores, baú, banner do cabeçalho, decoração da sidebar |

Renderização sempre `image-rendering: pixelated` e Phaser com `pixelArt: true`.

## Estados visuais dos agentes
Ocioso (cinza) · Planejando (ciano, “…”) · Executando (verde, engrenagem + barra) · Colaborando (roxo, caminha até a reunião) · Revisando (dourado, lupa) · Concluído (verde, comemora) · Falhou (rosa, tinta vermelha) · Pausado (cinza, dessaturado).

## Limitações conhecidas
- Logotipos dos provedores são glifos pixel genéricos (não reproduzem marcas registradas).
- Os personagens são originais e menores (16×24) que as ilustrações das referências, que foram geradas em alta resolução; a composição e a paleta seguem as referências.

## v1.1 — Mundo virtual
- Grade de 16 px, mapas 40×23 (`public/assets/world/<id>_ground.png` + atlas `<id>_props.png/json`).
- Personagens: 14 (incl. 2 robôs) × 27 quadros (frente, lado, costas, sentado de costas, café, leitura, conversa, comemoração).
- Emotes 8×8 (`sprites/emotes.png`) para vida ambiental; ícones de estado para a camada operacional.
- Luzes neon discretas: halos com blend ADD (`world/light_*.png`).
- Rótulos e balões são DOM (texto nítido): `.world-tag`, `.world-bubble` (borda dourada + prefixo “DEMO” para mensagens operacionais simuladas).
- Interface reduzida: menos bordas luminosas, painéis contextuais e recolhíveis.
