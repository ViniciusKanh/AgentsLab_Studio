# Modelo conceitual dos agentes

Definido em `apps/web/src/types/domain.ts` (`Agent`) e espelhado em `apps/api/app/schemas` (`AgentDraft`).

| Grupo | Campos |
|---|---|
| Identidade | id, name, role, department, description, objective, tags, appearance (characterId, accentColor), environmentId, stationId |
| Inteligência | provider, model, instructions (sistema), behavior, temperature, topP, maxOutputTokens |
| Ferramentas | tools[], permissions (readFiles, writeFiles, internet, externalApis, sensitiveRequiresApproval), integrations[] |
| Conhecimento | sources[], documents[], memory (none/short/long), ragEnabled, ragBaseId |
| Limites | maxTokensPerRun, maxCostPerDayUsd, timeoutSec, maxRetries (0–5) |
| Regras | autonomy (manual/supervised/autonomous), requireHumanReview, allowDelegation, restrictions |
| Evolução | status, level, xp, version, stats (runs, successRate, tokens30d, costUsd30d, avgLatencySec) |
| Rastreabilidade | createdAt, updatedAt, origin (demo/real) |

## Regras de validação (Agent Studio)
- Nome 3–60 caracteres; objetivo ≥ 10; instruções ≥ 20.
- Modelo deve pertencer ao provedor.
- `maxTokensPerRun ≥ maxOutputTokens` e ≥ 256; retentativas ≤ 5 (evita loops); timeout 5–3600 s.
- Escrita de arquivos ou modo autônomo exigem aprovação humana para operações sensíveis.
- RAG ativo exige base selecionada.

## Ciclo de execução (estados)
`idle → planning → working → (collaborating) → reviewing → completed | failed → idle`; `paused` quando o agente está pausado/inativo.
No modo demo o ciclo é gerado pelo `DemoSimulator`; no modo real virá do LangGraph via SSE.

## Colaboração
Agentes com `allowDelegation` podem chamar outro agente livre do mesmo ambiente; ambos vão ao ponto de reunião da sala. Workflows (pesquisador → analista → redator → revisor) são modelados no Workflow Studio com nós de condição e revisão humana.

## v1.1 — Personalidade e credenciais
- `personality`: sociabilidade, criatividade, organização, curiosidade, colaboração, iniciativa (0–100) e preferência (individual/duplas/grupos). Influencia a escolha de atividades ambientais (trabalhar, conversar, café, ler, observar, descansar, explorar). Futuramente poderá compor as instruções de sistema.
- `intelligence.credentialId`: perfil de chave do provedor (vários por provedor). `null` = chave padrão.

## Camadas
1. **Ambiental (local):** caminhar, sentar, café, leitura, conversas, emotes — sem LLM.
2. **Operacional:** planning → working → (collaborating) → reviewing → completed/failed. Sempre tem prioridade sobre a camada 1.
