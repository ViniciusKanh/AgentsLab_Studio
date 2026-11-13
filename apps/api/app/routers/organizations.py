"""Organizações, departamentos, agentes (CRUD), conversa real com agente e tarefas avulsas."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.deps import user
from app.models import Agent, Department, Organization
from app.services.llm import LLMError
from app.services.orchestrator import StopProject, agent_public, orchestrator
from app.services.seed import TEMPLATES, agent_config

router = APIRouter(prefix="/api/v1", tags=["organizations"])


def org_public(o: Organization, db: Session) -> dict:
    deps = list(db.scalars(select(Department).where(Department.organization_id == o.id)))
    agents = list(db.scalars(select(Agent.id).where(Agent.organization_id == o.id, Agent.owner_id == o.owner_id)))
    return {"id": o.id, "name": o.name, "description": o.description, "template": o.template, "environmentId": o.environment_id,
            "departments": [{"id": d.id, "name": d.name, "description": d.description} for d in deps], "agentIds": agents,
            "createdAt": o.created_at.isoformat(), "origin": "real"}


class OrgIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = ""
    template: str = "custom"
    environmentId: str = "office"
    departments: list[str] = []


class DepartmentIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""


def own_org(db: Session, oid: str, u: CurrentUser) -> Organization:
    o = db.get(Organization, oid)
    if not o or o.owner_id != u.id:
        _404("Organização")
    return o


def own_agent(db: Session, aid: str, u: CurrentUser) -> Agent:
    a = db.get(Agent, aid)
    if not a or a.owner_id != u.id:
        _404("Agente")
    return a


@router.get("/organizations")
def list_orgs(db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    return [org_public(o, db) for o in db.scalars(select(Organization).where(Organization.owner_id == u.id).order_by(Organization.created_at))]


@router.get("/organization-templates")
def templates(_u: CurrentUser = Depends(user)):
    return TEMPLATES


@router.post("/organizations", status_code=201)
def create_org(body: OrgIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    tpl = next((t for t in TEMPLATES if t["id"] == body.template), None)
    o = Organization(owner_id=u.id, name=body.name, description=body.description, template=body.template, environment_id=tpl["environmentId"] if tpl else body.environmentId)
    db.add(o)
    db.flush()
    for d in body.departments or (tpl["departments"] if tpl else []):
        db.add(Department(organization_id=o.id, name=d))
    db.commit()
    return org_public(o, db)


@router.put("/organizations/{oid}")
def update_org(oid: str, body: OrgIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    o = own_org(db, oid, u)
    o.name, o.description, o.environment_id = body.name, body.description, body.environmentId
    db.commit()
    return org_public(o, db)


@router.delete("/organizations/{oid}", status_code=204)
def delete_org(oid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    o = own_org(db, oid, u)
    db.delete(o)
    db.commit()
    return Response(status_code=204)


@router.post("/organizations/{oid}/departments", status_code=201)
def add_department(oid: str, body: DepartmentIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    own_org(db, oid, u)
    d = Department(organization_id=oid, name=body.name, description=body.description)
    db.add(d)
    db.commit()
    return {"id": d.id, "name": d.name, "description": d.description}


@router.delete("/organizations/{oid}/departments/{did}", status_code=204)
def delete_department(oid: str, did: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    own_org(db, oid, u)
    d = db.get(Department, did)
    if not d or d.organization_id != oid:
        _404("Departamento")
    db.delete(d)
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ agentes
CORE = {"id", "name", "role", "department", "organizationId", "isCoordinator", "origin", "createdAt", "updatedAt", "stats", "level", "xp", "ownerId"}


def _validate_agent(body: dict):
    for f, n in (("name", 3), ("role", 2)):
        if len(str(body.get(f, "")).strip()) < n:
            raise HTTPException(422, f"Campo '{f}' inválido")
    intel = body.get("intelligence") or {}
    if intel.get("provider") not in ("gemini", "groq", "openai", "huggingface", "ollama"):
        raise HTTPException(422, "Provedor obrigatório (o modelo pode ficar vazio = padrão do provedor)")


@router.get("/agents")
def list_agents(organizationId: str | None = None, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    q = select(Agent).where(Agent.owner_id == u.id).order_by(Agent.created_at)
    if organizationId:
        q = q.where(Agent.organization_id == organizationId)
    return [agent_public(a) for a in db.scalars(q)]


@router.get("/agents/{aid}")
def get_agent(aid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    return agent_public(own_agent(db, aid, u))


@router.post("/agents", status_code=201)
def create_agent(body: dict, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    _validate_agent(body)
    if body.get("organizationId"):
        own_org(db, body["organizationId"], u)
    base = agent_config(description="", objective="", character="analista", color="#00f5a0", env="office", station=None, instructions="", tools=[])
    cfg = {**base, **{k: v for k, v in body.items() if k not in CORE}}
    a = Agent(owner_id=u.id, name=body["name"].strip(), role=body["role"].strip(), department=body.get("department", ""), organization_id=body.get("organizationId"),
              is_coordinator=bool(body.get("isCoordinator")), config=cfg)
    db.add(a)
    db.commit()
    return agent_public(a)


@router.put("/agents/{aid}")
def update_agent(aid: str, body: dict, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    a = own_agent(db, aid, u)
    if body.get("organizationId"):
        own_org(db, body["organizationId"], u)
    _validate_agent({**agent_public(a), **body})
    a.name = body.get("name", a.name).strip()
    a.role = body.get("role", a.role).strip()
    a.department = body.get("department", a.department)
    if "organizationId" in body:
        a.organization_id = body["organizationId"]
    if "isCoordinator" in body:
        a.is_coordinator = bool(body["isCoordinator"])
    a.config = {**(a.config or {}), **{k: v for k, v in body.items() if k not in CORE}}
    db.commit()
    return agent_public(a)


@router.delete("/agents/{aid}", status_code=204)
def delete_agent(aid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    a = own_agent(db, aid, u)
    db.delete(a)
    db.commit()
    return Response(status_code=204)


class ChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    history: list[dict] = []


@router.post("/agents/{aid}/chat")
async def chat(aid: str, body: ChatIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    own_agent(db, aid, u)
    try:
        return await orchestrator.chat(aid, body.text, body.history)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    except (LLMError, StopProject) as exc:
        raise HTTPException(502, str(exc)) from exc


class AssignIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    kind: str = "general"


@router.post("/agents/{aid}/tasks", status_code=201)
async def assign(aid: str, body: AssignIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    own_agent(db, aid, u)
    try:
        return {"projectId": orchestrator.assign_task(aid, body.title, body.description, body.kind)}
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


def _404(what: str):
    raise HTTPException(404, f"{what} não encontrado(a)")


@router.get("/agents/{aid}/activity")
def agent_activity(aid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    """Trabalho real do agente: tarefas (atual e histórico), documentos, ferramentas usadas, mensagens e chamadas de modelo."""
    from app.models import AgentMessage, Artifact, Execution, Project, Task, ToolCall
    from app.services.orchestrator import execution_public, message_public, tool_call_public

    a = own_agent(db, aid, u)
    projects = {p.id: p for p in db.scalars(select(Project).where(Project.owner_id == u.id))}
    tasks = [t for t in db.scalars(select(Task).where(Task.agent_id == a.id).order_by(Task.started_at.desc().nulls_last(), Task.position)) if t.project_id in projects]

    def tp(t):
        p = projects[t.project_id]
        return {"id": t.id, "key": t.key, "title": t.title, "kind": t.kind, "status": t.status, "step": t.step, "stepsDone": t.steps_done, "stepsTotal": t.steps_total,
                "projectId": p.id, "projectTitle": p.title, "projectStatus": p.status, "error": t.error, "dependsOn": t.depends_on or [],
                "startedAt": t.started_at.isoformat() if t.started_at else None, "finishedAt": t.finished_at.isoformat() if t.finished_at else None,
                "resultArtifactId": t.result_artifact_id, "context": t.context or {}}

    current = [tp(t) for t in tasks if t.status == "running"]
    waiting = [tp(t) for t in tasks if t.status == "pending" and projects[t.project_id].status in ("running", "revising")]
    arts = list(db.scalars(select(Artifact).where(Artifact.agent_id == a.id).order_by(Artifact.created_at.desc()).limit(20)))
    msgs = list(db.scalars(select(AgentMessage).where(AgentMessage.owner_id == u.id, (AgentMessage.from_agent_id == a.id) | (AgentMessage.to_agent_id == a.id))
                           .order_by(AgentMessage.created_at.desc()).limit(30)))
    tools = list(db.scalars(select(ToolCall).where(ToolCall.agent_id == a.id, ToolCall.owner_id == u.id).order_by(ToolCall.created_at.desc()).limit(30)))
    exes = list(db.scalars(select(Execution).where(Execution.agent_id == a.id, Execution.owner_id == u.id).order_by(Execution.created_at.desc()).limit(30)))
    return {
        "agentId": a.id, "current": current, "waiting": waiting,
        "history": [tp(t) for t in tasks if t.status in ("done", "failed", "cancelled")][:20],
        "artifacts": [{"id": x.id, "code": x.code, "title": x.title, "kind": x.kind, "projectId": x.project_id, "projectTitle": projects[x.project_id].title if x.project_id in projects else "",
                       "currentVersion": x.current_version, "createdAt": x.created_at.isoformat()} for x in arts if x.project_id in projects],
        "messages": [message_public(m) for m in reversed(msgs)],
        "toolCalls": [tool_call_public(c) for c in tools],
        "executions": [execution_public(e) for e in exes],
        "totals": {"tokens": sum(e.input_tokens + e.output_tokens for e in exes), "costUsd": round(sum(e.cost_usd for e in exes), 6), "toolCalls": len(tools)},
    }
