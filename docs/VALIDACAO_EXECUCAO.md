# Validação — execução multiagente real (v1.4)

Data: 2026-11-13 · Caso de teste: **"Pesquisa sobre aplicações de IA na aeronáutica"** (T1 revisão de literatura, T2 investigação técnica de modelos/datasets, T3 análise comparativa, T4 relatório estruturado, T5 revisão).

## 1. Diagnóstico inicial (o que já funcionava antes desta etapa)

| Item | Situação encontrada | O que foi feito |
|---|---|---|
| Aprovar plano → execução real no backend | Funcionava (asyncio, estado persistido, `recover()` no boot) | Mantido; plano aprovado agora é congelado em `plan.plano_aprovado` |
| Paralelismo de tarefas independentes | Funcionava (semáforo `task_concurrency`) | Adicionado limite **por provedor** e teste que comprova sobreposição real |
| Bloqueio de dependentes quando algo falha | Só a dependente **direta** era cancelada; a cadeia ficava "pendente" e o projeto encerrava inconsistente | **Corrigido**: bloqueio propagado por toda a cadeia |
| Retentativas / tempo limite | Não existiam (`maxRetries`/`timeoutSec` do agente eram ignorados) | Retentativa com espera exponencial em 429/5xx/timeout; tempo limite por tarefa e por chamada |
| Cancelar | Cooperativo: chamadas em curso continuavam gastando | Cancelamento imediato; pausa continua cooperativa (próxima etapa) |
| Contexto dos agentes | Análise, redação e revisão recebiam **todas** as evidências do projeto | Contexto mínimo por tarefa, registrado em `Task.context` |
| Ferramentas usadas | Não eram registradas | Tabela `tool_calls` + evento `tool.call` + endpoint |
| Referências | Geradas pelo sistema a partir das evidências (sem verificação externa) | Verificação no Crossref/arXiv; relatório marca verificadas e não confirmadas |
| Documentos | Versões e diff já existiam | Código `D#`, autoria, editor, versão, data, projeto e tarefa de origem (tela + cabeçalho no download) |
| Feedback | Só em documento, sem propagação | Documento **ou** tarefa; responsável identificado/reatribuível; propagação `FB → UP → RR` |
| Decisão humana | Não sinalizada | Mensagens `decisao` do coordenador (plano pronto, entrega pronta, falha, orçamento, revisão esgotada), resolvidas quando o gestor age |
| Mundo 2D | Estados reais já vinham do backend | Estado "aguardando dependência", rótulos Pesquisando/Analisando/Redigindo/Revisando, aba **Trabalho** no painel do agente |
| Tela de projetos | 5 abas compactas (11–12 px) | 6 áreas, texto 13–15 px, painéis contextuais, seleção na URL |

## 2. Testes executados (resultados reais desta máquina)

| Suíte | Resultado |
|---|---|
| `pytest` (SQLite) | **29/29** aprovados |
| `pytest` (PostgreSQL 16 real, schema `agentslab`) | **29/29** aprovados |
| `tests/test_execucao_multiagente.py` repetido 3× (estabilidade) | 7/7 nas 3 rodadas |
| Migração de banco existente (colunas removidas e recriadas no PostgreSQL) | OK |
| Vitest | **30/30** |
| Playwright (Chromium, Supabase Auth falso + API de teste) | **17/17** |
| `npm run build` (tsc + Vite) | OK |

### Cobertura do fluxo pedido (`apps/api/tests/test_execucao_multiagente.py`)

| Etapa | Verificação automatizada |
|---|---|
| Plano aprovado → execução | `plano_aprovado` com T1–T5 persistido |
| Execução paralela | Intervalos das chamadas de T1 e T2 se sobrepõem; T3 só começa após T1 e T2; T4 após T3; T5 após T4 |
| Transferência de resultados | T3 recebe D1/D2 (versões registradas); T4 recebe D3; mensagens `entrega` entre agentes |
| Contexto mínimo | T3: só evidências de T1+T2; T4: só as citadas na análise (E1, E2) — o prompt do redator **não** contém E5; T5: só as citadas no relatório |
| Ferramentas | 2 buscas + 6 verificações registradas, por tarefa e agente |
| Referências | DOI → "verificada"; arXiv sem confirmação → "não confirmada"; marcação no relatório |
| Documentos | Código, autoria, versão, projeto, tarefa de origem; cabeçalho YAML no `.md` baixado |
| Revisão → aprovação do gestor | Mensagem `decisao` pendente; resolvida após aprovar |
| Feedback em **tarefa** (T3) | Cria FB1 (analista, D3 v2) → UP1 (redator, depende de FB1, recebe D3 v2) → RR1 (nova revisão); versões preservadas e diff |
| Falha + tempo limite | T3 estoura o limite; T4 e T5 canceladas em cadeia; coordenador pede decisão; feedback na tarefa reabre T3–T5 sem refazer T1/T2 |
| Retentativa | 429 simulado → `Execution(retry)` → sucesso na segunda tentativa |
| Cancelamento imediato | Chamada de 10 s interrompida em menos de 3 s; buscas e evidências já registradas permanecem |
| Pausa e retomada | Pausa na próxima etapa; retomada conclui o projeto |
| Painel do agente | `/agents/{id}/activity` com histórico, ferramentas, documentos e tokens |

**Importante:** nesses testes o LLM e as ferramentas de busca são substitutos determinísticos (`tests/fakes.py`), usados somente em teste. A orquestração, persistência, paralelismo, contexto, propagação e limites testados são o código real.

## 3. O que NÃO foi validado neste ambiente

- **Chamadas reais** a Gemini/Groq/OpenAI, OpenAlex, arXiv e Crossref: o ambiente de desenvolvimento não tem acesso à internet. A verificação de referências real (`WebResearchTools.verify`) está implementada, mas não foi exercitada contra os serviços reais.
- Qualidade do conteúdo gerado por um modelo real (o teste confere estrutura e rastreabilidade, não a qualidade do texto).
- Comportamento sob limites reais de taxa do plano gratuito do Gemini (o mecanismo de retentativa foi testado com 429 simulado).
- Projeto Supabase real (já configurado pelo gestor) com esta versão — requer reiniciar o backend para aplicar as novas colunas (a migração é automática).

### Como validar com dados reais (no seu computador)
1. Reinicie o backend (`uvicorn app.main:app --reload`): as colunas novas são criadas automaticamente.
2. Em **Projetos → Novo projeto**, use o exemplo "IA na aeronáutica", aprove o plano.
3. Acompanhe **Execução** (T1 e T2 devem rodar juntas), **Documentos → Evidências** (coluna Verificação) e **Custos**.
4. Na **Revisão**, envie feedback sobre a tarefa T3 e confira a nova versão de D3 e do relatório (Diff).

## 4. Funcionalidades ainda não implementadas

- Leitura de texto completo de artigos (PDF) — só resumos/metadados (`full_text = false`).
- Upload de documentos do usuário / RAG com pgvector.
- Delegação dinâmica decidida pelo próprio agente durante a execução (hoje as tarefas vêm do plano aprovado, das revisões e do feedback).
- Reuniões visuais com vários agentes; o mundo mostra entregas entre pares.
- Fila externa (Redis/worker): a execução roda no processo da API; com vários servidores seria necessário um worker dedicado.
- Limite de requisições por minuto configurável por provedor (hoje: concorrência por provedor + retentativa).
- Verificação de referências sem DOI nem arXiv (ficam "não confirmadas").
