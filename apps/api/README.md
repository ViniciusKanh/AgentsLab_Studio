# AgentsLab_Studio — API (estrutura da Fase 2)

Backend planejado em **FastAPI + Pydantic**, com LangGraph (orquestração), LiteLLM (provedores), PostgreSQL/pgvector e Redis/workers nas fases seguintes.

**Estado atual:** somente `GET /health` funciona. As demais rotas respondem `501` de propósito — o frontend não deve exibir dados inventados no modo real.

```powershell
cd apps\api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
pytest
```

Deploy previsto: Railway ou Render (processo Python persistente). Não executar no Cloudflare Pages/Vercel estático.
