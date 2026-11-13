"""Projetos: criação por prompt, plano, aprovação, execução, mensagens, documentos, evidências, custos e feedback."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.deps import user
from app.models import Organization, AgentMessage, Approval, Artifact, ArtifactVersion, Evidence, Execution, Project, Task
from app.services.orchestrator import diff_versions, execution_public, message_public, orchestrator

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def task_public(t: Task) -> dict:
    return {"id": t.id, "key": t.key, "title": t.title, "description": t.description, "kind": t.kind, "agentId": t.agent_id, "dependsOn": t.depends_on or [],
            "deliverable": t.deliverable, "status": t.status, "step": t.step, "stepsDone": t.steps_done, "stepsTotal": t.steps_total,
            "resultArtifactId": t.result_artifact_id, "targetArtifactId": t.target_artifact_id, "error": t.error, "position": t.position,
            "startedAt": t.started_at.isoformat() if t.started_at else None, "finishedAt": t.finished_at.isoformat() if t.finished_at else None}


def project_public(p: Project, db: Session, full: bool = False) -> dict:
    tasks = list(db.scalars(select(Task).where(Task.project_id == p.id).order_by(Task.position)))
    d = {"id": p.id, "organizationId": p.organization_id, "title": p.title, "request": p.request, "status": p.status, "budgetUsd": p.budget_usd,
         "costUsd": round(p.cost_usd, 6), "llmCalls": p.llm_calls, "error": p.error, "createdAt": p.created_at.isoformat(), "updatedAt": p.updated_at.isoformat(),
         "tasksTotal": len(tasks), "tasksDone": sum(t.status == "done" for t in tasks), "origin": "real"}
    if full:
        d["plan"] = p.plan or {}
        d["tasks"] = [task_public(t) for t in tasks]
        d["approvals"] = [{"id": a.id, "kind": a.kind, "status": a.status, "note": a.note, "createdAt": a.created_at.isoformat(),
                           "decidedAt": a.decided_at.isoformat() if a.decided_at else None}
                          for a in db.scalars(select(Approval).where(Approval.project_id == p.id).order_by(Approval.created_at))]
    return d


def get_project(pid: str, db: Session, u: CurrentUser) -> Project:
    p = db.get(Project, pid)
    if not p or p.owner_id != u.id:
        raise HTTPException(404, "Projeto não encontrado")
    return p


class ProjectIn(BaseModel):
    request: str = Field(min_length=15, max_length=8000)
    title: str = ""
    organizationId: str | None = None
    budgetUsd: float | None = Field(default=None, gt=0, le=100)


@router.get("")
def list_projects(organizationId: str | None = None, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    q = select(Project).where(Project.owner_id == u.id).order_by(Project.created_at.desc())
    if organizationId:
        q = q.where(Project.organization_id == organizationId)
    return [project_public(p, db) for p in db.scalars(q)]


@router.post("", status_code=201)
async def create_project(body: ProjectIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    if body.organizationId:
        o = db.get(Organization, body.organizationId)
        if not o or o.owner_id != u.id:
            raise HTTPException(404, "Organização não encontrada")
    title = body.title.strip() or body.request.strip().split("\n")[0][:80]
    pid = orchestrator.create_project(body.organizationId, title, body.request, body.budgetUsd, owner=u.id)
    return project_public(db.get(Project, pid), db, full=True)


@router.get("/{pid}")
def project(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    return project_public(get_project(pid, db, u), db, full=True)


class PlanTask(BaseModel):
    key: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    kind: str = "general"
    agentId: str | None = None
    dependsOn: list[str] = []
    deliverable: str = ""


class PlanIn(BaseModel):
    tasks: list[PlanTask] = Field(min_length=1, max_length=20)


def _wrap(fn, *args):
    try:
        return fn(*args)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.put("/{pid}/plan")
async def edit_plan(pid: str, body: PlanIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.update_plan, pid, [t.model_dump() for t in body.tasks])
    db.expire_all()
    return project_public(get_project(pid, db, u), db, full=True)


class DecisionIn(BaseModel):
    approve: bool
    note: str = ""


@router.post("/{pid}/plan/decision")
async def plan_decision(pid: str, body: DecisionIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.decide_plan, pid, body.approve, body.note)
    db.expire_all()
    return project_public(get_project(pid, db, u), db, full=True)


@router.post("/{pid}/delivery/decision")
async def delivery_decision(pid: str, body: DecisionIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.decide_delivery, pid, body.approve, body.note)
    db.expire_all()
    return project_public(get_project(pid, db, u), db, full=True)


class ReanalyzeIn(BaseModel):
    provider: str | None = Field(default=None, pattern="^(gemini|groq|openai|huggingface|ollama)$")
    model: str = Field(default="", max_length=120)
    applyToTeam: bool = False
    note: str = Field(default="", max_length=2000)


@router.post("/{pid}/reanalyze")
async def reanalyze(pid: str, body: ReanalyzeIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    """Refaz o plano do projeto — útil após trocar o modelo de IA (opcionalmente aplicado à equipe)."""
    get_project(pid, db, u)
    changed = _wrap(orchestrator.reanalyze, pid, body.provider, body.model.strip(), body.applyToTeam, body.note.strip())
    db.expire_all()
    return {**project_public(get_project(pid, db, u), db, full=True), "agentsUpdated": changed}


@router.post("/{pid}/retry")
async def retry(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.retry_failed, pid)
    db.expire_all()
    return project_public(get_project(pid, db, u), db, full=True)


class ActionIn(BaseModel):
    action: str = Field(pattern="^(pause|resume|cancel)$")


@router.post("/{pid}/control")
async def control(pid: str, body: ActionIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.set_status, pid, body.action)
    db.expire_all()
    return project_public(get_project(pid, db, u), db)


class BudgetIn(BaseModel):
    budgetUsd: float = Field(gt=0, le=100)


@router.put("/{pid}/budget")
def budget(pid: str, body: BudgetIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    orchestrator.set_budget(pid, body.budgetUsd)
    db.expire_all()
    return project_public(get_project(pid, db, u), db)


class FeedbackIn(BaseModel):
    artifactId: str
    text: str = Field(min_length=3, max_length=8000)
    agentId: str | None = None


@router.post("/{pid}/feedback")
async def feedback(pid: str, body: FeedbackIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    _wrap(orchestrator.feedback, pid, body.artifactId, body.text, body.agentId)
    db.expire_all()
    return project_public(get_project(pid, db, u), db, full=True)


class GuidanceIn(BaseModel):
    agentId: str
    text: str = Field(min_length=3, max_length=4000)


@router.post("/{pid}/guidance")
async def guidance(pid: str, body: GuidanceIn, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    from app.models import Agent

    ag = db.get(Agent, body.agentId)
    if not ag or ag.owner_id != u.id:
        raise HTTPException(404, "Agente não encontrado")
    _wrap(orchestrator.guidance, pid, body.agentId, body.text)
    return {"ok": True}


@router.get("/{pid}/messages")
def messages(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    return [message_public(m) for m in db.scalars(select(AgentMessage).where(AgentMessage.project_id == pid).order_by(AgentMessage.created_at))]


@router.get("/{pid}/artifacts")
def artifacts(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    out = []
    for a in db.scalars(select(Artifact).where(Artifact.project_id == pid).order_by(Artifact.created_at)):
        vs = list(db.scalars(select(ArtifactVersion).where(ArtifactVersion.artifact_id == a.id).order_by(ArtifactVersion.version)))
        out.append({"id": a.id, "title": a.title, "kind": a.kind, "agentId": a.agent_id, "taskId": a.task_id, "currentVersion": a.current_version,
                    "createdAt": a.created_at.isoformat(),
                    "versions": [{"version": v.version, "agentId": v.agent_id, "note": v.note, "createdAt": v.created_at.isoformat(), "chars": len(v.content)} for v in vs]})
    return out


def _version(db: Session, aid: str, version: int | None, pid: str | None = None) -> ArtifactVersion:
    art = db.get(Artifact, aid)
    if not art or (pid and art.project_id != pid):
        raise HTTPException(404, "Documento não encontrado")
    q = select(ArtifactVersion).where(ArtifactVersion.artifact_id == aid)
    q = q.where(ArtifactVersion.version == version) if version else q.order_by(ArtifactVersion.version.desc())
    v = db.scalars(q).first()
    if not v:
        raise HTTPException(404, "Versão não encontrada")
    return v


@router.get("/{pid}/artifacts/{aid}")
def artifact_content(pid: str, aid: str, version: int | None = None, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    v = _version(db, aid, version, pid)
    return {"artifactId": aid, "version": v.version, "content": v.content, "note": v.note, "agentId": v.agent_id, "createdAt": v.created_at.isoformat()}


@router.get("/{pid}/artifacts/{aid}/diff")
def artifact_diff(pid: str, aid: str, a: int, b: int, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    return {"from": a, "to": b, "diff": diff_versions(_version(db, aid, a, pid).content, _version(db, aid, b, pid).content)}


@router.get("/{pid}/artifacts/{aid}/download", response_class=PlainTextResponse)
def download(pid: str, aid: str, version: int | None = None, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    art = db.get(Artifact, aid)
    if not art:
        raise HTTPException(404, "Documento não encontrado")
    v = _version(db, aid, version, pid)
    import unicodedata
    from urllib.parse import quote

    ascii_title = unicodedata.normalize("NFKD", art.title).encode("ascii", "ignore").decode()
    name = "".join(c if c.isalnum() else "_" for c in ascii_title)[:60] or "documento"
    return PlainTextResponse(v.content, media_type="text/markdown; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="{name}_v{v.version}.md"; filename*=UTF-8\'\'{quote(art.title[:60])}_v{v.version}.md'})


@router.get("/{pid}/evidence")
def evidence(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    return [{"id": e.id, "code": e.code, "source": e.source, "title": e.title, "authors": e.authors, "year": e.year, "doi": e.doi, "url": e.url,
             "abstract": e.abstract, "fullText": e.full_text, "query": e.query, "taskId": e.task_id, "agentId": e.agent_id, "accessedAt": e.accessed_at.isoformat()}
            for e in db.scalars(select(Evidence).where(Evidence.project_id == pid).order_by(Evidence.accessed_at))]


@router.get("/{pid}/executions")
def executions(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    get_project(pid, db, u)
    return [execution_public(e) for e in db.scalars(select(Execution).where(Execution.project_id == pid).order_by(Execution.created_at))]
