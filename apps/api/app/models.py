"""
Entidades persistentes da plataforma de organizações multiagentes.

Organization ─┬─ Department
              ├─ Agent (config JSON compatível com o frontend)
              └─ Project ─┬─ Task (dependências)
                          ├─ AgentMessage (comunicação estruturada)
                          ├─ Artifact ── ArtifactVersion (versionamento)
                          ├─ Evidence (fontes verificáveis)
                          ├─ Execution (chamadas de LLM: tokens/custo)
                          └─ Approval (decisões humanas)
Event: log append-only usado para SSE com replay (reconexão).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("org"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    template: Mapped[str] = mapped_column(String(40), default="custom")
    environment_id: Mapped[str] = mapped_column(String(40), default="office")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("dep"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("ag"))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(120), default="")
    is_coordinator: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("prj"))
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    request: Mapped[str] = mapped_column(Text)
    # planning | awaiting_approval | running | paused | delivered | revising | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(30), default="planning")
    plan: Mapped[dict] = mapped_column(JSON, default=dict)
    budget_usd: Mapped[float] = mapped_column(Float, default=2.0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    auto_revisions: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("tsk"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    # research | analysis | writing | review | revision | general
    kind: Mapped[str] = mapped_column(String(20), default="general")
    agent_id: Mapped[str | None] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    depends_on: Mapped[list] = mapped_column(JSON, default=list)
    deliverable: Mapped[str] = mapped_column(String(200), default="")
    # proposed | pending | running | done | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    step: Mapped[str] = mapped_column(String(200), default="")
    steps_done: Mapped[int] = mapped_column(Integer, default=0)
    steps_total: Mapped[int] = mapped_column(Integer, default=0)
    target_artifact_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    result_artifact_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("msg"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    from_kind: Mapped[str] = mapped_column(String(10), default="agent")  # agent | user | system
    from_agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_kind: Mapped[str] = mapped_column(String(10), default="agent")
    to_agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # solicitacao | resposta | delegacao | entrega | revisao | correcao | aprovacao | alerta | discussao | orientacao | feedback
    type: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    artifact_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(12), default="processed")  # pending | processed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("art"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    task_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20))  # findings | analysis | report | review
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("ver"))
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("evd"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    task_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    code: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(20))  # openalex | arxiv
    title: Mapped[str] = mapped_column(Text)
    authors: Mapped[str] = mapped_column(Text, default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doi: Mapped[str] = mapped_column(String(200), default="")
    url: Mapped[str] = mapped_column(Text, default="")
    abstract: Mapped[str] = mapped_column(Text, default="")
    full_text: Mapped[bool] = mapped_column(Boolean, default=False)
    query: Mapped[str] = mapped_column(Text, default="")
    accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Execution(Base):
    __tablename__ = "executions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("exe"))
    project_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    purpose: Mapped[str] = mapped_column(String(30))
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cost_is_estimate: Mapped[bool] = mapped_column(Boolean, default=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(12), default="ok")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("apr"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # plan | delivery
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected | changes_requested
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Credential(Base):
    """Metadados do perfil de chave. O SEGREDO fica no cofre do SO (keyring) — nunca aqui."""
    __tablename__ = "credentials"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: uid("cred"))
    provider: Mapped[str] = mapped_column(String(20))
    alias: Mapped[str] = mapped_column(String(80))
    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class KeyValue(Base):
    """Preferências simples (provedores habilitados, workflows do editor)."""
    __tablename__ = "kv"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    type: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
