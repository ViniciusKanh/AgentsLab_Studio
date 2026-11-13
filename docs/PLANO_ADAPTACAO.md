# Diagnóstico e plano de adaptação — de “jogo de agentes” para plataforma de organizações multiagentes

Data: 12/11/2026 · Base analisada: commit `6f0b471` (v1.1)

## 1. Diagnóstico da arquitetura existente

| Área | Situação na v1.1 | Decisão |
|---|---|---|
| Motor visual (`apps/web/src/world`) | Mapas em grade, A*, `AmbientWorld` separado da camada operacional, cena Phaser, overlay DOM, câmera | **Preservar.** Já recebe estados por `setOperational`; passa a ser alimentado por eventos reais do backend |
| Assets (`tools/pixelart`) | Gerador procedural de personagens (27 quadros), escritório e laboratório | **Preservar** |
| Agent Studio | Assistente em 6 etapas com validação, personalidade e perfil de chave | **Preservar e adaptar** (organização, remover nível/XP da exibição) |
| Workflow Studio (React Flow) | Editor visual + validação | **Preservar** (base para dependências de tarefas) |
| Contratos (`types/domain.ts`, `LabDataSource`) | Interface única demo/real | **Preservar**; a implementação real passa a ser a principal |
| `simulation/demoSimulator` | Gerava tarefas fictícias com progresso inventado | **Remover** (contraria “trabalho real”) |
| Gamificação (`gameStore`, Missões, XP, níveis, créditos, conquistas, recompensas, desbloqueio de salas) | Espalhada em topbar, sidebar, perfil, página própria | **Remover** |
| Painel de métricas demo | Números fictícios | **Substituir** por visão geral com dados reais do backend |
| Backend (`apps/api`) | `/health`, cofre Fernet, rotas 501 | **Evoluir** para o motor real |
| CI | Job do backend falhava: `ModuleNotFoundError: app` | **Corrigir** (`pyproject.toml` com `pythonpath`) |

## 2. Credenciais “direto no app” (requisito do gestor)

A chave é digitada na própria interface e guardada **no cofre do sistema operacional**:
- Windows: **Gerenciador de Credenciais** (DPAPI, atrelado ao usuário do Windows) via biblioteca `keyring`;
- macOS: Keychain · Linux: Secret Service.

O frontend envia a chave **uma única vez** ao backend local; o backend nunca a devolve. Esse modelo é o mesmo que será usado no aplicativo desktop para a Microsoft Store (Tauri 2 + backend Python como *sidecar*, empacotado em MSIX). Em ambientes sem cofre (CI, servidores Linux) usa-se arquivo criptografado com Fernet.

## 3. Plano incremental (reaproveitamento máximo)

| Fase | Entrega | Estado nesta etapa |
|---|---|---|
| 1 | Remover gamificação, nova navegação, organizações/departamentos | **Implementada** |
| 2 | Entidades persistentes: organizações, departamentos, agentes, projetos, tarefas, mensagens, artefatos+versões, evidências, execuções, aprovações, eventos | **Implementada** (SQLAlchemy; SQLite local, PostgreSQL por URL) |
| 3 | Motor real: LiteLLM por agente/chave, ferramentas reais (OpenAlex, arXiv), custos, limites | **Implementada** (núcleo) |
| 4 | Projeto por linguagem natural: coordenador planeja → aprovação humana → execução com dependências → consolidação → revisão → feedback → nova versão | **Implementada (fluxo vertical)** |
| 5 | Integração visual: estados e mensagens reais nos personagens, entregas representadas | **Implementada** (estados, balões com mensagens reais, caminhada de entrega); reuniões com vários agentes: planejada |
| 6 | Environment Studio (editor de ambientes) | Planejada — mapas já são dados estruturados, base para o editor |
| 7 | Desktop/Store, Postgres + fila externa, observabilidade | Planejada |

## 4. Riscos e mitigação

- **Custo/loops de LLM:** orçamento por projeto, limite de chamadas, de tarefas, de rodadas de revisão e de profundidade; parada automática.
- **Referências inventadas:** evidências só vêm das ferramentas (OpenAlex/arXiv com DOI/URL). O revisor recebe a lista de evidências e deve marcar afirmações sem suporte. Resumos ≠ texto completo (sinalizado).
- **Prompt injection em fontes:** conteúdo externo é delimitado como dado não confiável nas instruções.
- **Execução longa:** worker em segundo plano no processo da API, estado persistido; ao reiniciar, execuções interrompidas são retomadas. Fila externa (Redis) na Fase 7.
- **Disponibilidade de rede/provedores:** falhas viram eventos e estado `failed` da tarefa, com mensagem clara; nada é simulado.

## 5. Validação desta entrega

| Item | Como foi validado | Resultado |
|---|---|---|
| Fluxo obrigatório “IA na aeronáutica” (11 passos) | `apps/api/tests/test_project_flow.py` + E2E no navegador | Passa: plano → edição → aprovação → 2 pesquisas em paralelo → análise após ambas → relatório → revisão (citação inventada `[E99]` detectada) → revisão automática (v2) → feedback do gestor (v3) → diff → aprovação → custos por agente/projeto/modelo |
| Limites | testes de orçamento (pausa) e cancelamento | Passa |
| Cofre de chaves | testes da API e E2E (chave digitada no app; só `••••9876` volta; nada no `localStorage`) | Passa (cofre em arquivo no ambiente de teste; no Windows usa o Gerenciador de Credenciais) |
| Mundo dirigido por eventos | Vitest (SSE → estados/etapas/balões; entrega com caminhada; ambientação sem falso progresso) + vídeo gerado | Passa |
| **Chamadas reais** a Gemini/Groq/OpenAI/HF/Ollama e buscas reais no OpenAlex/arXiv | Não executadas aqui: o ambiente de desenvolvimento bloqueia a rede (HTTP 403) e não há chaves | **Pendente de validação na sua máquina** com uma chave real |

Correção encontrada durante a validação: o cabeçalho `User-Agent` das buscas tinha acento e quebrava as requisições reais (teste de regressão adicionado).
