# AgentsLab_Studio — API

FastAPI + SQLAlchemy + LiteLLM. Motor real de organizações multiagentes: planejamento pelo coordenador, aprovação humana, execução com dependências, mensagens estruturadas, evidências (OpenAlex/arXiv), documentos versionados, custos e eventos em tempo real (SSE).

```powershell
cd apps\api
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000      # documentação interativa: http://localhost:8000/docs
pytest
```

- Banco: SQLite em `./data/agentslab.db` (padrão) ou PostgreSQL via `AGENTSLAB_DATABASE_URL`.
- Chaves: cadastradas pelo app; guardadas no cofre do SO (`keyring`). Fallback: `AGENTSLAB_SECRET_BACKEND=file` + `AGENTSLAB_MASTER_KEY`.
- Na inicialização: cria tabelas, cria as organizações iniciais (banco vazio) e **retoma** projetos interrompidos.
- Limites (orçamento, chamadas, tarefas, revisões, concorrência): ver `app/config.py` / `.env.example`.
- `tests/fakes.py` e `tests/e2e_server.py` são exclusivos de testes (LLM e ferramentas determinísticos).

Principais rotas (`/api/v1`): `credentials`, `organizations`, `agents` (+ `/chat`, `/tasks`), `projects` (+ `plan`, `plan/decision`, `control`, `budget`, `feedback`, `guidance`, `messages`, `artifacts` com versões/diff/download, `evidence`, `executions`, `delivery/decision`), `events` (SSE), `providers`, `usage`, `overview`, `executions`, `messages`, `workflows`.
