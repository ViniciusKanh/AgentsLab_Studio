"""
Rotas planejadas (Fase 2+). Respondem 501 para que o frontend em modo real
exiba 'não disponível' em vez de dados inventados.
"""
from fastapi import APIRouter, HTTPException

from app.schemas import AgentDraft

router = APIRouter(prefix="/api/v1", tags=["planejado"])


def _planned(feature: str):
    raise HTTPException(status_code=501, detail=f"{feature}: planejado para a Fase 2")


@router.get("/dashboard")
def dashboard(period: str = "7d"):
    _planned("dashboard")


@router.get("/agents")
def list_agents():
    _planned("agents")


@router.post("/agents")
def create_agent(draft: AgentDraft):
    _planned("agents.create")


@router.get("/workflows")
def list_workflows():
    _planned("workflows")


@router.get("/providers")
def list_providers():
    _planned("providers")


@router.get("/events")
def events():
    _planned("events (SSE)")
