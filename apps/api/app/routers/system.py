"""Eventos em tempo real (SSE com replay), provedores, consumo real, visão geral e workflows — por usuário."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, current_user_sse
from app.db import get_db, session_scope
from app.deps import user
from app.models import Agent, AgentMessage, Credential, Event, Execution, KeyValue, Project, Task
from app.services.events import hub
from app.services.orchestrator import execution_public, message_public
from app.services.providers import CATALOG, PROVIDER_IDS, get_prefs, list_remote_models, provider_state, save_prefs
from app.services.vault import CredentialService, VaultError

router = APIRouter(prefix="/api/v1", tags=["system"])


def kv_get(db: Session, key: str, default):
    row = db.get(KeyValue, key)
    return row.value if row else default


def kv_set(db: Session, key: str, value):
    row = db.get(KeyValue, key)
    if row:
        row.value = value
    else:
        db.add(KeyValue(key=key, value=value))
    db.commit()


def _public(ev: dict) -> dict:
    return {k: v for k, v in ev.items() if k != "_owner"}


# ------------------------------------------------------------------ SSE
@router.get("/events")
async def events(request: Request, after: int | None = None, projectId: str | None = None, u: CurrentUser = Depends(current_user_sse)):
    """Stream SSE do usuário. Reconexão: o navegador reenvia Last-Event-ID e recebe os eventos perdidos."""
    last = request.headers.get("last-event-id")
    start = int(last) if last and last.isdigit() else after
    q = hub.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            if start is not None:
                with session_scope() as s:
                    stmt = select(Event).where(Event.id > start, Event.owner_id == u.id).order_by(Event.id).limit(500)
                    if projectId:
                        stmt = stmt.where(Event.project_id == projectId)
                    backlog = [{"id": e.id, "type": e.type, "projectId": e.project_id, "payload": e.payload, "ts": e.created_at.isoformat()} for e in s.scalars(stmt)]
                for ev in backlog:
                    yield f"id: {ev['id']}\nevent: message\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if ev.get("_owner") != u.id:
                    continue
                if projectId and ev["projectId"] not in (projectId, None):
                    continue
                yield f"id: {ev['id']}\nevent: message\ndata: {json.dumps(_public(ev), ensure_ascii=False)}\n\n"
        finally:
            hub.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/me")
def me(u: CurrentUser = Depends(user)):
    return {"id": u.id, "email": u.email, "name": u.name}


# ------------------------------------------------------------------ provedores
def _providers(db: Session, owner: str) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=30)
    out = []
    for p in CATALOG:
        st = provider_state(db, owner, p["id"])
        has_cred = db.scalars(select(Credential).where(Credential.provider == p["id"], Credential.owner_id == owner)).first() is not None
        tokens = db.scalar(select(func.coalesce(func.sum(Execution.input_tokens + Execution.output_tokens), 0)).where(Execution.provider == p["id"], Execution.owner_id == owner, Execution.created_at >= since))
        cost = db.scalar(select(func.coalesce(func.sum(Execution.cost_usd), 0.0)).where(Execution.provider == p["id"], Execution.owner_id == owner, Execution.created_at >= since))
        out.append({**p, **st, "status": "connected" if (has_cred or p["id"] == "ollama") else "not_configured",
                    "usage": {"tokensMonth": int(tokens or 0), "quotaMonth": 0, "costUsdMonth": round(float(cost or 0), 6)}, "origin": "real"})
    return out


@router.get("/providers")
def providers(db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    return _providers(db, u.id)


class ProviderPatch(BaseModel):
    enabled: bool | None = None
    defaultModel: str | None = Field(default=None, max_length=120)
    customModels: list[str] | None = Field(default=None, max_length=50)


def _apply(prefs: dict, pid: str, patch: ProviderPatch, db: Session, owner: str):
    if pid not in PROVIDER_IDS:
        raise HTTPException(404, "Provedor desconhecido")
    cur = dict(prefs.get(pid, {}))
    if patch.enabled is not None:
        cur["enabled"] = patch.enabled
    if patch.customModels is not None:
        models = list(cur.get("models") or provider_state(db, owner, pid)["models"])
        known = {m["id"] for m in models}
        for mid in (m.strip() for m in patch.customModels):
            if mid and mid not in known:
                models.append({"id": mid, "name": mid, "contextWindow": None, "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["adicionado manualmente"]})
                known.add(mid)
        cur["models"] = models
    if patch.defaultModel is not None:
        cur["defaultModel"] = patch.defaultModel.strip()
    prefs[pid] = cur


@router.patch("/providers/{pid}")
def update_provider(pid: str, patch: ProviderPatch, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    prefs = get_prefs(db, u.id)
    _apply(prefs, pid, patch, db, u.id)
    save_prefs(db, u.id, prefs)
    return next(p for p in _providers(db, u.id) if p["id"] == pid)


@router.put("/providers")
def save_providers(body: dict[str, ProviderPatch], db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    """Salva de uma vez o estado de todos os provedores (ativo/desativado e modelo padrão)."""
    prefs = get_prefs(db, u.id)
    for pid, patch in body.items():
        _apply(prefs, pid, patch, db, u.id)
    save_prefs(db, u.id, prefs)
    return _providers(db, u.id)


@router.post("/providers/{pid}/models/refresh")
async def refresh_models(pid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    """Atualiza a lista de modelos consultando a API do provedor com a chave padrão do usuário."""
    if pid not in PROVIDER_IDS:
        raise HTTPException(404, "Provedor desconhecido")
    key = None
    if pid != "ollama":
        try:
            key = CredentialService(db, owner_id=u.id).resolve(pid, None)
        except VaultError as exc:
            raise HTTPException(503, str(exc)) from exc
        if not key:
            raise HTTPException(422, "Cadastre uma chave deste provedor para listar os modelos.")
    try:
        models = await list_remote_models(pid, key)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:  # rede/credencial
        raise HTTPException(502, f"Não foi possível consultar {pid}: {exc}") from exc
    if not models:
        raise HTTPException(502, "O provedor não retornou modelos de texto para esta chave.")
    prefs = get_prefs(db, u.id)
    cur = dict(prefs.get(pid, {}))
    cur["models"] = models
    cur["modelsSyncedAt"] = datetime.now(timezone.utc).isoformat()
    if cur.get("defaultModel") not in {m["id"] for m in models}:
        cur["defaultModel"] = models[0]["id"]
    prefs[pid] = cur
    save_prefs(db, u.id, prefs)
    return next(p for p in _providers(db, u.id) if p["id"] == pid)


# ------------------------------------------------------------------ consumo e visão geral
@router.get("/executions")
def all_executions(limit: int = 200, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    q = select(Execution).where(Execution.owner_id == u.id).order_by(Execution.created_at.desc()).limit(min(limit, 1000))
    return [execution_public(e) for e in db.scalars(q)]


@router.get("/messages")
def recent_messages(limit: int = 50, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    rows = list(db.scalars(select(AgentMessage).where(AgentMessage.owner_id == u.id).order_by(AgentMessage.created_at.desc()).limit(min(limit, 500))))
    return [message_public(m) for m in reversed(rows)]


@router.get("/usage")
def usage(db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    def group(col):
        rows = db.execute(select(col, func.count(), func.sum(Execution.input_tokens), func.sum(Execution.output_tokens), func.sum(Execution.cost_usd))
                          .where(Execution.owner_id == u.id).group_by(col)).all()
        return [{"key": r[0], "calls": r[1], "inputTokens": int(r[2] or 0), "outputTokens": int(r[3] or 0), "costUsd": round(float(r[4] or 0), 6)} for r in rows]

    return {"byAgent": group(Execution.agent_id), "byProject": group(Execution.project_id), "byModel": group(Execution.model),
            "byProvider": group(Execution.provider), "costIsEstimate": True}


@router.get("/overview")
def overview(db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    projects = list(db.scalars(select(Project).where(Project.owner_id == u.id)))
    pids = [p.id for p in projects]
    running_tasks = list(db.scalars(select(Task).where(Task.status == "running", Task.project_id.in_(pids)))) if pids else []
    ex = select(Execution).where(Execution.owner_id == u.id).subquery()
    return {
        "projects": {s: sum(p.status == s for p in projects) for s in ("planning", "awaiting_approval", "running", "paused", "delivered", "revising", "completed", "failed", "cancelled")},
        "projectsTotal": len(projects),
        "agentsTotal": db.scalar(select(func.count()).select_from(Agent).where(Agent.owner_id == u.id)) or 0,
        "runningTasks": [{"id": t.id, "title": t.title, "agentId": t.agent_id, "projectId": t.project_id, "step": t.step, "stepsDone": t.steps_done, "stepsTotal": t.steps_total} for t in running_tasks],
        "pendingApprovals": sum(p.status in ("awaiting_approval", "delivered") for p in projects),
        "costUsd": round(float(db.scalar(select(func.coalesce(func.sum(ex.c.cost_usd), 0.0))) or 0), 6),
        "llmCalls": db.scalar(select(func.count()).select_from(ex)) or 0,
        "tokens": int(db.scalar(select(func.coalesce(func.sum(ex.c.input_tokens + ex.c.output_tokens), 0))) or 0),
        "errors": db.scalar(select(func.count()).select_from(ex).where(ex.c.status == "error")) or 0,
        "credentials": db.scalar(select(func.count()).select_from(Credential).where(Credential.owner_id == u.id)) or 0,
        "origin": "real",
    }


# ------------------------------------------------------------------ workflows (editor visual)
def _wf_key(owner: str) -> str:
    return "workflows" if owner == "local" else f"workflows:{owner}"


@router.get("/workflows")
def workflows(db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    return list(kv_get(db, _wf_key(u.id), {"items": []})["items"])


@router.put("/workflows/{wid}")
def save_workflow(wid: str, wf: dict, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    items = [w for w in kv_get(db, _wf_key(u.id), {"items": []})["items"] if w.get("id") != wid]
    wf = {**wf, "id": wid, "origin": "real"}
    kv_set(db, _wf_key(u.id), {"items": items + [wf]})
    return wf


@router.delete("/workflows/{wid}", status_code=204)
def delete_workflow(wid: str, db: Session = Depends(get_db), u: CurrentUser = Depends(user)):
    kv_set(db, _wf_key(u.id), {"items": [w for w in kv_get(db, _wf_key(u.id), {"items": []})["items"] if w.get("id") != wid]})
    return Response(status_code=204)
