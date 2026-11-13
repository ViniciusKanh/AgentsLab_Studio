"""Organizações, departamentos, agentes (CRUD), conversa real com agente e tarefas avulsas."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Agent, Department, Organization
from app.services.llm import LLMError
from app.services.orchestrator import StopProject, agent_public, orchestrator
from app.services.seed import TEMPLATES, agent_config

router = APIRouter(prefix="/api/v1", tags=["organizations"])


def org_public(o: Organization, db: Session) -> dict:
    deps = list(db.scalars(select(Department).where(Department.organization_id == o.id)))
    agents = list(db.scalars(select(Agent.id).where(Agent.organization_id == o.id)))
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


@router.get("/organizations")
def list_orgs(db: Session = Depends(get_db)):
    return [org_public(o, db) for o in db.scalars(select(Organization).order_by(Organization.created_at))]


@router.get("/organization-templates")
def templates():
    return TEMPLATES


@router.post("/organizations", status_code=201)
def create_org(body: OrgIn, db: Session = Depends(get_db)):
    tpl = next((t for t in TEMPLATES if t["id"] == body.template), None)
    o = Organization(name=body.name, description=body.description, template=body.template, environment_id=tpl["environmentId"] if tpl else body.environmentId)
    db.add(o)
    db.flush()
    for d in body.departments or (tpl["departments"] if tpl else []):
        db.add(Department(organization_id=o.id, name=d))
    db.commit()
    return org_public(o, db)


@router.put("/organizations/{oid}")
def update_org(oid: str, body: OrgIn, db: Session = Depends(get_db)):
    o = db.get(Organization, oid) or _404("Organização")
    o.name, o.description, o.environment_id = body.name, body.description, body.environmentId
    db.commit()
    return org_public(o, db)


@router.delete("/organizations/{oid}", status_code=204)
def delete_org(oid: str, db: Session = Depends(get_db)):
    o = db.get(Organization, oid) or _404("Organização")
    db.delete(o)
    db.commit()
    return Response(status_code=204)


@router.post("/organizations/{oid}/departments", status_code=201)
def add_department(oid: str, body: DepartmentIn, db: Session = Depends(get_db)):
    db.get(Organization, oid) or _404("Organização")
    d = Department(organization_id=oid, name=body.name, description=body.description)
    db.add(d)
    db.commit()
    return {"id": d.id, "name": d.name, "description": d.description}


@router.delete("/organizations/{oid}/departments/{did}", status_code=204)
def delete_department(oid: str, did: str, db: Session = Depends(get_db)):
    d = db.get(Department, did)
    if not d or d.organization_id != oid:
        _404("Departamento")
    db.delete(d)
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ agentes
CORE = {"id", "name", "role", "department", "organizationId", "isCoordinator", "origin", "createdAt", "updatedAt", "stats", "level", "xp"}


def _validate_agent(body: dict):
    for f, n in (("name", 3), ("role", 2)):
        if len(str(body.get(f, "")).strip()) < n:
            raise HTTPException(422, f"Campo '{f}' inválido")
    intel = body.get("intelligence") or {}
    if intel.get("provider") not in ("gemini", "groq", "openai", "huggingface", "ollama") or not intel.get("model"):
        raise HTTPException(422, "Provedor e modelo são obrigatórios")


@router.get("/agents")
def list_agents(organizationId: str | None = None, db: Session = Depends(get_db)):
    q = select(Agent).order_by(Agent.created_at)
    if organizationId:
        q = q.where(Agent.organization_id == organizationId)
    return [agent_public(a) for a in db.scalars(q)]


@router.get("/agents/{aid}")
def get_agent(aid: str, db: Session = Depends(get_db)):
    return agent_public(db.get(Agent, aid) or _404("Agente"))


@router.post("/agents", status_code=201)
def create_agent(body: dict, db: Session = Depends(get_db)):
    _validate_agent(body)
    base = agent_config(description="", objective="", character="analista", color="#00f5a0", env="office", station=None, instructions="", tools=[])
    cfg = {**base, **{k: v for k, v in body.items() if k not in CORE}}
    a = Agent(name=body["name"].strip(), role=body["role"].strip(), department=body.get("department", ""), organization_id=body.get("organizationId"),
              is_coordinator=bool(body.get("isCoordinator")), config=cfg)
    db.add(a)
    db.commit()
    return agent_public(a)


@router.put("/agents/{aid}")
def update_agent(aid: str, body: dict, db: Session = Depends(get_db)):
    a = db.get(Agent, aid) or _404("Agente")
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
def delete_agent(aid: str, db: Session = Depends(get_db)):
    a = db.get(Agent, aid) or _404("Agente")
    db.delete(a)
    db.commit()
    return Response(status_code=204)


class ChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    history: list[dict] = []


@router.post("/agents/{aid}/chat")
async def chat(aid: str, body: ChatIn):
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
async def assign(aid: str, body: AssignIn):
    try:
        return {"projectId": orchestrator.assign_task(aid, body.title, body.description, body.kind)}
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


def _404(what: str):
    raise HTTPException(404, f"{what} não encontrado(a)")
