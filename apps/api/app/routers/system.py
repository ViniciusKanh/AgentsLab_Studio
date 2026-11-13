"""Eventos em tempo real (SSE com replay), provedores, consumo real, visão geral e workflows."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db, session_scope
from app.models import Agent, AgentMessage, Credential, Event, Execution, KeyValue, Project, Task
from app.services.events import hub
from app.services.orchestrator import execution_public, message_public

router = APIRouter(prefix="/api/v1", tags=["system"])

# Catálogo de modelos. Preços são REFERÊNCIAS para estimativa (US$/1M tokens); o custo registrado vem do LiteLLM.
CATALOG = [
    {"id": "gemini", "name": "Gemini", "kind": "cloud", "badge": "Padrão", "defaultModel": "gemini-2.5-flash", "models": [
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "contextWindow": 1_000_000, "inputPer1M": 0.3, "outputPer1M": 2.5, "priceIsEstimate": True, "tags": ["rápido", "custo"]},
        {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "contextWindow": 1_000_000, "inputPer1M": 1.25, "outputPer1M": 10, "priceIsEstimate": True, "tags": ["raciocínio"]}]},
    {"id": "groq", "name": "Groq", "kind": "cloud", "badge": "Rápido", "defaultModel": "llama-3.3-70b-versatile", "models": [
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "contextWindow": 128_000, "inputPer1M": 0.59, "outputPer1M": 0.79, "priceIsEstimate": True, "tags": ["baixa latência"]},
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "contextWindow": 128_000, "inputPer1M": 0.05, "outputPer1M": 0.08, "priceIsEstimate": True, "tags": ["econômico"]}]},
    {"id": "openai", "name": "OpenAI", "kind": "cloud", "badge": "Alta Qualidade", "defaultModel": "gpt-4.1-mini", "models": [
        {"id": "gpt-4.1-mini", "name": "GPT-4.1 mini", "contextWindow": 1_000_000, "inputPer1M": 0.4, "outputPer1M": 1.6, "priceIsEstimate": True, "tags": ["custo"]},
        {"id": "gpt-4.1", "name": "GPT-4.1", "contextWindow": 1_000_000, "inputPer1M": 2, "outputPer1M": 8, "priceIsEstimate": True, "tags": ["qualidade"]}]},
    {"id": "huggingface", "name": "Hugging Face", "kind": "cloud", "badge": "Modelos Abertos", "defaultModel": "meta-llama/Llama-3.1-8B-Instruct", "models": [
        {"id": "meta-llama/Llama-3.1-8B-Instruct", "name": "Llama 3.1 8B Instruct", "contextWindow": 128_000, "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["open-weights"]}]},
    {"id": "ollama", "name": "Ollama (local)", "kind": "local", "badge": "Local", "defaultModel": "llama3.1:8b", "models": [
        {"id": "llama3.1:8b", "name": "Llama 3.1 8B (local)", "contextWindow": 128_000, "inputPer1M": 0, "outputPer1M": 0, "priceIsEstimate": False, "tags": ["sem custo de API"]},
        {"id": "qwen2.5:7b", "name": "Qwen 2.5 7B (local)", "contextWindow": 32_000, "inputPer1M": 0, "outputPer1M": 0, "priceIsEstimate": False, "tags": ["local"]}]},
]


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


# ------------------------------------------------------------------ SSE
@router.get("/events")
async def events(request: Request, after: int | None = None, projectId: str | None = None):
    """Stream SSE. Reconexão: o navegador reenvia Last-Event-ID e recebemos os eventos perdidos."""
    last = request.headers.get("last-event-id")
    start = int(last) if last and last.isdigit() else after
    q = hub.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            if start is not None:
                with session_scope() as s:
                    stmt = select(Event).where(Event.id > start).order_by(Event.id).limit(500)
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
                if projectId and ev["projectId"] not in (projectId, None):
                    continue
                yield f"id: {ev['id']}\nevent: message\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            hub.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/events/latest")
def latest_event(db: Session = Depends(get_db)):
    return {"id": db.scalar(select(func.max(Event.id))) or 0}


# ------------------------------------------------------------------ provedores
@router.get("/providers")
def providers(db: Session = Depends(get_db)):
    prefs = kv_get(db, "providers", {})
    since = datetime.now(timezone.utc) - timedelta(days=30)
    out = []
    for p in CATALOG:
        pref = prefs.get(p["id"], {})
        has_cred = db.scalars(select(Credential).where(Credential.provider == p["id"])).first() is not None
        tokens = db.scalar(select(func.coalesce(func.sum(Execution.input_tokens + Execution.output_tokens), 0)).where(Execution.provider == p["id"], Execution.created_at >= since))
        cost = db.scalar(select(func.coalesce(func.sum(Execution.cost_usd), 0.0)).where(Execution.provider == p["id"], Execution.created_at >= since))
        out.append({**p, "enabled": pref.get("enabled", True), "defaultModel": pref.get("defaultModel", p["defaultModel"]),
                    "status": "connected" if (has_cred or p["id"] == "ollama") else "not_configured",
                    "usage": {"tokensMonth": int(tokens or 0), "quotaMonth": 0, "costUsdMonth": round(float(cost or 0), 6)}, "origin": "real"})
    return out


@router.patch("/providers/{pid}")
def update_provider(pid: str, patch: dict, db: Session = Depends(get_db)):
    if pid not in {p["id"] for p in CATALOG}:
        raise HTTPException(404, "Provedor desconhecido")
    prefs = dict(kv_get(db, "providers", {}))
    prefs[pid] = {**prefs.get(pid, {}), **{k: v for k, v in patch.items() if k in ("enabled", "defaultModel")}}
    kv_set(db, "providers", prefs)
    return next(p for p in providers(db) if p["id"] == pid)


# ------------------------------------------------------------------ consumo e visão geral
@router.get("/executions")
def all_executions(limit: int = 200, db: Session = Depends(get_db)):
    return [execution_public(e) for e in db.scalars(select(Execution).order_by(Execution.created_at.desc()).limit(min(limit, 1000)))]


@router.get("/messages")
def recent_messages(limit: int = 50, db: Session = Depends(get_db)):
    rows = list(db.scalars(select(AgentMessage).order_by(AgentMessage.created_at.desc()).limit(min(limit, 500))))
    return [message_public(m) for m in reversed(rows)]


@router.get("/usage")
def usage(db: Session = Depends(get_db)):
    def group(col):
        rows = db.execute(select(col, func.count(), func.sum(Execution.input_tokens), func.sum(Execution.output_tokens), func.sum(Execution.cost_usd))
                          .group_by(col)).all()
        return [{"key": r[0], "calls": r[1], "inputTokens": int(r[2] or 0), "outputTokens": int(r[3] or 0), "costUsd": round(float(r[4] or 0), 6)} for r in rows]

    return {"byAgent": group(Execution.agent_id), "byProject": group(Execution.project_id), "byModel": group(Execution.model),
            "byProvider": group(Execution.provider), "costIsEstimate": True}


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    projects = list(db.scalars(select(Project)))
    running_tasks = list(db.scalars(select(Task).where(Task.status == "running")))
    return {
        "projects": {s: sum(p.status == s for p in projects) for s in ("planning", "awaiting_approval", "running", "paused", "delivered", "revising", "completed", "failed", "cancelled")},
        "projectsTotal": len(projects),
        "agentsTotal": db.scalar(select(func.count()).select_from(Agent)) or 0,
        "runningTasks": [{"id": t.id, "title": t.title, "agentId": t.agent_id, "projectId": t.project_id, "step": t.step, "stepsDone": t.steps_done, "stepsTotal": t.steps_total} for t in running_tasks],
        "pendingApprovals": sum(p.status in ("awaiting_approval", "delivered") for p in projects),
        "costUsd": round(float(db.scalar(select(func.coalesce(func.sum(Execution.cost_usd), 0.0))) or 0), 6),
        "llmCalls": db.scalar(select(func.count()).select_from(Execution)) or 0,
        "tokens": int(db.scalar(select(func.coalesce(func.sum(Execution.input_tokens + Execution.output_tokens), 0))) or 0),
        "errors": db.scalar(select(func.count()).select_from(Execution).where(Execution.status == "error")) or 0,
        "credentials": db.scalar(select(func.count()).select_from(Credential)) or 0,
        "origin": "real",
    }


# ------------------------------------------------------------------ workflows (editor visual)
@router.get("/workflows")
def workflows(db: Session = Depends(get_db)):
    return list(kv_get(db, "workflows", {"items": []})["items"])


@router.put("/workflows/{wid}")
def save_workflow(wid: str, wf: dict, db: Session = Depends(get_db)):
    items = [w for w in kv_get(db, "workflows", {"items": []})["items"] if w.get("id") != wid]
    wf = {**wf, "id": wid, "origin": "real"}
    kv_set(db, "workflows", {"items": items + [wf]})
    return wf


@router.delete("/workflows/{wid}", status_code=204)
def delete_workflow(wid: str, db: Session = Depends(get_db)):
    kv_set(db, "workflows", {"items": [w for w in kv_get(db, "workflows", {"items": []})["items"] if w.get("id") != wid]})
    return Response(status_code=204)
