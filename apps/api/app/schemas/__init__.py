"""
Contratos Pydantic — espelham apps/web/src/types/domain.ts.
Manter os dois arquivos sincronizados ao evoluir a API.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

DataOrigin = Literal["demo", "real"]
ProviderId = Literal["gemini", "groq", "openai", "huggingface", "ollama"]
AgentRuntimeState = Literal["idle", "planning", "working", "collaborating", "reviewing", "completed", "failed", "paused"]


class AgentAppearance(BaseModel):
    characterId: str
    accentColor: str


class AgentIntelligence(BaseModel):
    provider: ProviderId
    model: str
    instructions: str = Field(min_length=20)
    behavior: Literal["analitico", "criativo", "preciso", "didatico", "executor"]
    temperature: float = Field(ge=0, le=2)
    topP: float = Field(ge=0, le=1)
    maxOutputTokens: int = Field(ge=64, le=32000)


class AgentPermissions(BaseModel):
    readFiles: bool
    writeFiles: bool
    internet: bool
    externalApis: bool
    sensitiveRequiresApproval: bool = True


class AgentKnowledge(BaseModel):
    sources: list[str] = []
    documents: list[str] = []
    memory: Literal["none", "short", "long"] = "short"
    ragEnabled: bool = False
    ragBaseId: Optional[str] = None


class AgentLimits(BaseModel):
    maxTokensPerRun: int = Field(ge=256)
    maxCostPerDayUsd: float = Field(ge=0, le=500)
    timeoutSec: int = Field(ge=5, le=3600)
    maxRetries: int = Field(ge=0, le=5)


class AgentRules(BaseModel):
    autonomy: Literal["manual", "supervised", "autonomous"]
    requireHumanReview: bool
    allowDelegation: bool
    restrictions: str = ""


class AgentDraft(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=3, max_length=60)
    role: str
    department: str
    description: str = ""
    objective: str = Field(min_length=10)
    appearance: AgentAppearance
    environmentId: str
    stationId: Optional[str] = None
    intelligence: AgentIntelligence
    tools: list[str] = []
    permissions: AgentPermissions
    integrations: list[str] = []
    knowledge: AgentKnowledge
    limits: AgentLimits
    rules: AgentRules
    tags: list[str] = []
    status: Literal["active", "paused", "archived"] = "active"


class SimulationEvent(BaseModel):
    """Evento emitido via SSE (GET /api/v1/events) e consumido pelo frontend."""
    type: Literal["agent.state", "task.progress", "task.finished", "log"]
    agentId: Optional[str] = None
    state: Optional[AgentRuntimeState] = None
    taskId: Optional[str] = None
    progress: Optional[float] = None
    tokens: Optional[int] = None
    ts: datetime
    origin: DataOrigin = "real"
