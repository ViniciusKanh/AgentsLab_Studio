"""
Ponto de entrada da API. Execução local: uvicorn app.main:app --reload --port 8000

Na inicialização: cria tabelas, cria organizações iniciais (se o banco estiver vazio) e
retoma projetos que estavam em execução quando o processo foi encerrado.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.config import settings
from app.routers import credentials, health, organizations, projects, system


def init_db():
    from app import models  # noqa: F401 — registra as tabelas

    db.Base.metadata.create_all(db.engine)
    if settings.seed_demo_organizations:
        from app.services.seed import seed_organizations

        seed_organizations()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from app.services.orchestrator import orchestrator

    orchestrator.recover()
    yield


app = FastAPI(title="AgentsLab_Studio API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (health, credentials, organizations, projects, system):
    app.include_router(r.router)
