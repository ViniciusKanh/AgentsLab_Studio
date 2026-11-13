"""
Ponto de entrada da API. Execução local: uvicorn app.main:app --port 8000

Na inicialização: cria/atualiza tabelas, cria as organizações iniciais do usuário local (modo
desktop sem conta) e retoma projetos interrompidos. Com Supabase Auth configurado, cada usuário
recebe suas organizações no primeiro acesso.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app import db
from app.config import auth_enabled, settings
from app.routers import credentials, health, organizations, projects, system

# colunas adicionadas depois da v1.2 (bancos existentes são atualizados sem perder dados)
_NEW_COLUMNS = {
    "organizations": ["owner_id"], "agents": ["owner_id"], "projects": ["owner_id"], "agent_messages": ["owner_id"],
    "executions": ["owner_id"], "credentials": ["owner_id"], "events": ["owner_id"],
}


def migrate():
    sch = db.schema()
    insp = inspect(db.engine)
    tables = set(insp.get_table_names(schema=sch))
    prefix = f'"{sch}".' if sch else ""
    with db.engine.begin() as conn:
        for table, cols in _NEW_COLUMNS.items():
            if table not in tables:
                continue
            have = {c["name"] for c in insp.get_columns(table, schema=sch)}
            for col in cols:
                if col not in have:
                    conn.execute(text(f"ALTER TABLE {prefix}{table} ADD COLUMN {col} VARCHAR(64) NOT NULL DEFAULT 'local'"))
        if sch:
            # defesa em profundidade: RLS ligado em todas as tabelas (o backend, dono das tabelas, não é afetado;
            # papéis anon/authenticated do Supabase ficam sem acesso salvo políticas explícitas — ver supabase/migrations)
            for table in insp.get_table_names(schema=sch):
                conn.execute(text(f'ALTER TABLE {prefix}"{table}" ENABLE ROW LEVEL SECURITY'))


def init_db():
    from app import models  # noqa: F401 — registra as tabelas

    db.Base.metadata.create_all(db.engine)
    migrate()
    if settings.seed_demo_organizations and not auth_enabled():
        from app.services.seed import seed_for_owner

        seed_for_owner("local")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from app.services.orchestrator import orchestrator

    orchestrator.recover()
    yield


app = FastAPI(title="AgentsLab_Studio API", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (health, credentials, organizations, projects, system):
    app.include_router(r.router)
