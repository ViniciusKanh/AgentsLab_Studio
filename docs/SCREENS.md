# Especificação das telas (v1.1)

Desktop primeiro: 1366×768, 1440×900, 1920×1080. Capturas reais em `docs/media` (geradas por `npm run media` / Action *Showcase*).

| Tela | Referência | Conteúdo |
|---|---|---|
| Início / Escritório `/`, `/escritorio` | Redesign — imagem 1 | Cenário ocupa ~80% da área: mezanino com lounge e estantes, escada, globo holográfico, cantos de pesquisa e desenvolvimento, mesa colaborativa, análise de dados junto às janelas, tanque neural, cafeteria, quadro do sprint. Toolbar flutuante (ambiente, pausa/normal/acelerada, zoom, rótulos, gerenciamento, observador), Novo agente, Novo projeto; card de visão geral com números reais do backend |
| Laboratório `/laboratorio` | Redesign — imagem 2 | Núcleo neural com cérebro holográfico animado, passarelas com guarda-corpo de vidro e escadas, quadro de experimentos, terminais, bancadas químicas, prateleiras de amostras, tubo de cultivo, mesa holográfica de discussão, servidores, gato |
| Painel contextual | — | Avatar, nome, papel, estado, tarefa, progresso, modelo, chave; Conversar (LLM real), Tarefa (atribuição real), Detalhes; abas Status, Chat, Histórico, Interações |
| Faixa de eventos | — | Recolhível; filtros Todos/Operacional/Ambiente; origem sempre identificada |
| Modo observador | — | Oculta menu, barra superior e painéis (Esc sai) |
| Modo gerenciamento | — | Lista de agentes da sala + missões + autopiloto demo |
| Agentes, Agent Studio, Workflows, Modelos (Chaves), Painel de métricas, Ambientes, Conhecimento, Execuções, Gamificação, Configurações | v1.0 | Mantidos; Studio ganhou Personalidade e Chave de API |

## Validação visual
Screenshots em 1440×900 comparados com as duas referências: composição (mezanino + janelas à direita no escritório; reator central + passarelas no laboratório), paleta noturna roxo/ciano e densidade de objetos. Diferenças conhecidas: perspectiva top-down 3/4 (as referências são ilustrações pseudo-isométricas de alta resolução); personagens de 16×24 px — use o zoom para ver detalhes.

## v1.2
| Tela | Conteúdo |
|---|---|
| Projetos `/projetos` | Novo projeto por prompt (organização, orçamento), lista com status, tarefas e custo |
| Projeto `/projetos/:id` | Plano editável e aprovação; tarefas com etapas reais; mensagens; documentos (versões, diff, download .md, feedback); evidências; execuções e custos; pausar/retomar/cancelar; orientar agente |
| Organizações `/organizacoes` | Departamentos, equipe (coordenador), ambiente, novo projeto/agente |
| Provedores e Custos `/provedores` | Provedores, chaves (cofre do SO), consumo real, limites, catálogo |
