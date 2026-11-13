"""Sessão SQLAlchemy. SQLite local por padrão (desktop), PostgreSQL via AGENTSLAB_DATABASE_URL."""
from __future__ import annotations

import os
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import db_url, settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None):
    url = url or db_url()
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        if path and path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        eng = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(eng, "connect")
        def _pragmas(conn, _rec):  # WAL melhora concorrência do worker com a API
            cur = conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        return eng
    # Supabase (pooler/PgBouncer em modo transação) não aceita prepared statements do psycopg 3
    args = {"prepare_threshold": None} if url.startswith("postgresql+psycopg") else {}
    eng = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, connect_args=args)
    if eng.dialect.name == "postgresql" and settings.db_schema:
        # tabelas do app em um schema próprio (não exposto pela Data API/PostgREST do Supabase)
        with eng.begin() as conn:
            conn.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{settings.db_schema}"')
        eng = eng.execution_options(schema_translate_map={None: settings.db_schema})
    return eng


def schema() -> str | None:
    return settings.db_schema if engine.dialect.name == "postgresql" and settings.db_schema else None


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def configure(url: str):
    """Troca o banco (usado nos testes)."""
    global engine
    engine = make_engine(url)
    SessionLocal.configure(bind=engine)
    return engine


@contextmanager
def session_scope():
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def get_db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


_ = settings
