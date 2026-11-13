"""
Motor multiagente: planejamento → aprovação humana → execução com dependências →
comunicação estruturada → consolidação → revisão → feedback → novas versões.

Tudo é persistido (Project/Task/AgentMessage/Artifact/Evidence/Execution/Approval) e
publicado como eventos (SSE). Nada aqui é simulado: chamadas vão ao LLM de cada agente
e as fontes vêm de ferramentas reais. Em testes, gateway e ferramentas são substituídos.
"""
from __future__ import annotations

import asyncio
import difflib
import re
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.config import settings
from app.db import session_scope
from app.models import Agent, AgentMessage, Approval, Artifact, ArtifactVersion, Evidence, Execution, Project, Task
from app.services import prompts as P
from app.services.events import hub
from app.services.llm import LLMError, get_gateway, parse_json
from app.services.tools import get_tools
from app.services.providers import resolve_model
from app.services.vault import CredentialService

KIND_MAP = {"pesquisa": "research", "analise": "analysis", "análise": "analysis", "redacao": "writing", "redação": "writing", "revisao": "review", "revisão": "review", "geral": "general"}
STEPS = {"research": 4, "analysis": 2, "writing": 3, "review": 2, "revision": 3, "general": 2}


class StopProject(Exception):
    """Interrompe a execução (pausa, cancelamento ou limite de orçamento)."""


def utcnow():
    return datetime.now(timezone.utc)


def agent_public(a: Agent) -> dict:
    cfg = dict(a.config or {})
    cfg.update({"id": a.id, "name": a.name, "role": a.role, "department": a.department, "organizationId": a.organization_id,
                "isCoordinator": a.is_coordinator, "origin": "real", "createdAt": a.created_at.isoformat(), "updatedAt": a.updated_at.isoformat()})
    return cfg


class Orchestrator:
    def __init__(self):
        self.runners: dict[str, asyncio.Task] = {}
        self._owners: dict[str, str] = {}

    # ------------------------------------------------------------------ utilidades
    def owner_of(self, project_id: str | None) -> str:
        if not project_id:
            return "local"
        if project_id not in self._owners:
            with session_scope() as s:
                p = s.get(Project, project_id)
                self._owners[project_id] = p.owner_id if p else "local"
        return self._owners[project_id]

    def emit(self, type_: str, payload: dict, project_id: str | None = None, owner: str | None = None):
        return hub.publish(type_, payload, project_id, owner or self.owner_of(project_id))

    def agent_state(self, agent_id: str | None, state: str, task: Task | None = None, partner: str | None = None, project_id: str | None = None):
        if agent_id:
            self.emit("agent.state", {"agentId": agent_id, "state": state, "taskId": task.id if task else None,
                                      "taskTitle": task.title if task else None, "partnerId": partner}, project_id)

    def message(self, project_id: str | None, type_: str, content: str, *, from_agent: str | None = None, to_agent: str | None = None,
                from_kind: str = "agent", to_kind: str = "agent", task_id: str | None = None, artifact_ids: list | None = None, status: str = "processed",
                owner: str | None = None) -> dict:
        owner = owner or self.owner_of(project_id)
        with session_scope() as s:
            m = AgentMessage(owner_id=owner, project_id=project_id, task_id=task_id, from_kind=from_kind, from_agent_id=from_agent, to_kind=to_kind,
                             to_agent_id=to_agent, type=type_, content=content, artifact_ids=artifact_ids or [], status=status)
            s.add(m)
            s.flush()
            data = message_public(m)
        self.emit("agent.message", data, project_id, owner)
        return data

    def project_event(self, project_id: str):
        with session_scope() as s:
            p = s.get(Project, project_id)
            if p:
                self.emit("project.updated", {"id": p.id, "status": p.status, "costUsd": round(p.cost_usd, 6), "llmCalls": p.llm_calls, "error": p.error}, project_id)

    def set_project(self, project_id: str, **fields):
        with session_scope() as s:
            p = s.get(Project, project_id)
            for k, v in fields.items():
                setattr(p, k, v)
        self.project_event(project_id)

    def check_running(self, project_id: str):
        with session_scope() as s:
            p = s.get(Project, project_id)
            if p.status not in ("running", "revising"):
                raise StopProject(p.status)

    async def llm(self, *, project_id: str | None, task_id: str | None, agent: Agent, purpose: str, messages: list[dict], json_mode: bool = False, max_tokens: int | None = None):
        cfg = agent.config or {}
        intel = cfg.get("intelligence", {})
        provider = intel.get("provider", "gemini")
        owner = agent.owner_id
        with session_scope() as s:
            model, enabled = resolve_model(s, owner, provider, intel.get("model"))
        if not enabled:
            raise LLMError(f"O provedor {provider} está desativado em Provedores e Custos. Ative-o ou troque o modelo do agente ({agent.name}).")
        if project_id:
            with session_scope() as s:
                p = s.get(Project, project_id)
                if p.cost_usd >= p.budget_usd:
                    raise StopProject("budget")
                if p.llm_calls >= settings.max_llm_calls_per_project:
                    raise StopProject("calls")
        with session_scope() as s:
            key = CredentialService(s, owner_id=owner).resolve(provider, intel.get("credentialId"))
        try:
            r = await get_gateway().complete(provider=provider, model=model, api_key=key, messages=messages, temperature=float(intel.get("temperature", 0.3)),
                                             max_tokens=int(max_tokens or intel.get("maxOutputTokens", 2048)), json_mode=json_mode, purpose=purpose)
        except LLMError as exc:
            with session_scope() as s:
                s.add(Execution(owner_id=owner, project_id=project_id, task_id=task_id, agent_id=agent.id, purpose=purpose, provider=provider, model=model, status="error", error=str(exc)[:2000]))
            raise
        with session_scope() as s:
            e = Execution(owner_id=owner, project_id=project_id, task_id=task_id, agent_id=agent.id, purpose=purpose, provider=r.provider, model=r.model, input_tokens=r.input_tokens,
                          output_tokens=r.output_tokens, cost_usd=r.cost_usd, cost_is_estimate=r.cost_is_estimate, latency_ms=r.latency_ms)
            s.add(e)
            if project_id:
                p = s.get(Project, project_id)
                p.cost_usd += r.cost_usd
                p.llm_calls += 1
            s.flush()
            exe = execution_public(e)
        self.emit("execution", exe, project_id, owner)
        return r

    # ------------------------------------------------------------------ projetos
    def create_project(self, organization_id: str | None, title: str, request: str, budget_usd: float | None = None, owner: str = "local") -> str:
        with session_scope() as s:
            p = Project(owner_id=owner, organization_id=organization_id, title=title.strip()[:200], request=request.strip(), budget_usd=budget_usd or settings.default_project_budget_usd)
            s.add(p)
            s.flush()
            pid = p.id
        self.message(pid, "solicitacao", request, from_kind="user", to_kind="agent")
        self.project_event(pid)
        self.spawn(pid, self.plan(pid))
        return pid

    def spawn(self, project_id: str, coro):
        t = asyncio.get_running_loop().create_task(coro)
        self.runners[project_id] = t
        t.add_done_callback(lambda _t: self.runners.pop(project_id, None) if self.runners.get(project_id) is _t else None)
        return t

    @staticmethod
    def team_of(s, p: Project) -> list[Agent]:
        q = select(Agent).where(Agent.owner_id == p.owner_id)
        if p.organization_id:
            q = q.where(Agent.organization_id == p.organization_id)
        return list(s.scalars(q.order_by(Agent.created_at)))

    def coordinator_for(self, s, p: Project) -> Agent | None:
        agents = self.team_of(s, p)
        return next((a for a in agents if a.is_coordinator), agents[0] if agents else None)

    async def plan(self, project_id: str, note: str = ""):
        with session_scope() as s:
            p = s.get(Project, project_id)
            coord = self.coordinator_for(s, p)
            team = self.team_of(s, p)
            team = [a for a in team if (a.config or {}).get("status", "active") == "active"]
            request, title = p.request, p.title
        if not coord or not team:
            self.set_project(project_id, status="failed", error="A organização não possui agentes ativos.")
            return
        self.agent_state(coord.id, "planning", project_id=project_id)
        roster = [{"id": a.id, "name": a.name, "role": a.role, "department": a.department, "tools": (a.config or {}).get("tools", [])} for a in team]
        user = P.plan_prompt(request + (f"\n\nAjustes pedidos pelo gestor: {note}" if note else ""), roster, settings.max_tasks_per_project)
        try:
            r = await self.llm(project_id=project_id, task_id=None, agent=coord, purpose="plan", json_mode=True, max_tokens=3000,
                               messages=[{"role": "system", "content": P.agent_system(coord.config or {}, coord.name, coord.role)}, {"role": "user", "content": user}])
            plan = parse_json(r.text)
            tasks = self.validate_plan(plan, team)
        except (LLMError, ValueError, StopProject) as exc:
            self.agent_state(coord.id, "failed", project_id=project_id)
            self.set_project(project_id, status="failed", error=f"Falha no planejamento: {exc}")
            self.message(project_id, "alerta", f"Não consegui montar o plano: {exc}", from_agent=coord.id, to_kind="user")
            return
        with session_scope() as s:
            for t in s.scalars(select(Task).where(Task.project_id == project_id, Task.status == "proposed")):
                s.delete(t)
            for i, t in enumerate(tasks):
                s.add(Task(project_id=project_id, position=i, status="proposed", steps_total=STEPS[t["kind"]], **{k: t[k] for k in ("key", "title", "description", "kind", "agent_id", "depends_on", "deliverable")}))
            p = s.get(Project, project_id)
            plan["estimativa_custo_usd"] = round(len(tasks) * 0.02, 4)
            plan["estimativa_e_aproximada"] = True
            p.plan = plan
            p.status = "awaiting_approval"
            s.add(Approval(project_id=project_id, kind="plan"))
        self.agent_state(coord.id, "idle", project_id=project_id)
        self.message(project_id, "solicitacao", f"Plano proposto com {len(tasks)} tarefas para '{title}'. Revise, ajuste e aprove para iniciar.", from_agent=coord.id, to_kind="user")
        self.project_event(project_id)

    @staticmethod
    def validate_plan(plan: dict, team: list[Agent]) -> list[dict]:
        by_id = {a.id: a for a in team}
        raw = plan.get("tarefas") or []
        if not raw:
            raise ValueError("o plano não contém tarefas")
        tasks: list[dict] = []
        keys: set[str] = set()
        for i, t in enumerate(raw[: settings.max_tasks_per_project]):
            key = str(t.get("chave") or f"T{i + 1}")[:20]
            if key in keys:
                key = f"T{i + 1}"
            keys.add(key)
            kind = KIND_MAP.get(str(t.get("tipo", "geral")).lower().strip(), "general")
            aid = t.get("agente_id")
            if aid not in by_id:  # mapeia por papel se o modelo errar o id
                aid = next((a.id for a in team if kind == "review" and "revis" in a.role.lower()), None) or \
                      next((a.id for a in team if kind == "writing" and "redat" in a.role.lower()), None) or \
                      next((a.id for a in team if kind in ("research", "analysis") and ("pesquis" in a.role.lower() or "analis" in a.role.lower())), team[0].id)
            if kind == "research" and "literature_search" not in ((by_id[aid].config or {}).get("tools") or []):
                # ferramenta não autorizada para o agente: realoca para quem possui a integração
                aid = next((a.id for a in team if "literature_search" in ((a.config or {}).get("tools") or [])), aid)
            tasks.append({"key": key, "title": str(t.get("titulo", f"Tarefa {i + 1}"))[:200], "description": str(t.get("descricao", "")),
                          "kind": kind, "agent_id": aid, "depends_on": [str(d) for d in (t.get("depende_de") or [])], "deliverable": str(t.get("entregavel", ""))[:200]})
        valid = {t["key"] for t in tasks}
        for t in tasks:
            t["depends_on"] = [d for d in t["depends_on"] if d in valid and d != t["key"]]
        # garante redação e revisão (critério de conclusão)
        if not any(t["kind"] == "writing" for t in tasks):
            writer = next((a for a in team if "redat" in a.role.lower()), team[0])
            tasks.append({"key": "TW", "title": "Consolidar documento final", "description": "Integrar as entregas no relatório.", "kind": "writing",
                          "agent_id": writer.id, "depends_on": [t["key"] for t in tasks], "deliverable": "Relatório"})
        writing = next(t for t in tasks if t["kind"] == "writing")
        if not any(t["kind"] == "review" for t in tasks):
            rev = next((a for a in team if "revis" in a.role.lower()), team[-1])
            tasks.append({"key": "TR", "title": "Revisar relatório", "description": "Verificar evidências e qualidade.", "kind": "review",
                          "agent_id": rev.id, "depends_on": [writing["key"]], "deliverable": "Parecer de revisão"})
        # sem ciclos (ordenação topológica)
        order, seen, temp = [], set(), set()
        by_key = {t["key"]: t for t in tasks}

        def visit(k):
            if k in seen:
                return
            if k in temp:
                raise ValueError("dependências circulares no plano")
            temp.add(k)
            for d in by_key[k]["depends_on"]:
                visit(d)
            temp.discard(k); seen.add(k); order.append(by_key[k])

        for t in tasks:
            visit(t["key"])
        return order

    def update_plan(self, project_id: str, tasks: list[dict]):
        with session_scope() as s:
            p = s.get(Project, project_id)
            if p.status != "awaiting_approval":
                raise ValueError("O plano só pode ser alterado antes da aprovação")
            team = self.team_of(s, p)
            norm = self.validate_plan({"tarefas": [{"chave": t.get("key"), "titulo": t.get("title"), "descricao": t.get("description", ""), "tipo": {v: k for k, v in KIND_MAP.items()}.get(t.get("kind"), "geral"),
                                                    "agente_id": t.get("agentId"), "depende_de": t.get("dependsOn", []), "entregavel": t.get("deliverable", "")} for t in tasks]}, team)
            for t in s.scalars(select(Task).where(Task.project_id == project_id)):
                s.delete(t)
            for i, t in enumerate(norm):
                s.add(Task(project_id=project_id, position=i, status="proposed", steps_total=STEPS[t["kind"]], **{k: t[k] for k in ("key", "title", "description", "kind", "agent_id", "depends_on", "deliverable")}))
        self.message(project_id, "correcao", "Plano ajustado pelo gestor.", from_kind="user", to_kind="agent")
        self.project_event(project_id)

    def decide_plan(self, project_id: str, approve: bool, note: str = ""):
        with session_scope() as s:
            p = s.get(Project, project_id)
            if p.status != "awaiting_approval":
                raise ValueError("Não há plano aguardando aprovação")
            a = s.scalars(select(Approval).where(Approval.project_id == project_id, Approval.kind == "plan", Approval.status == "pending")).first()
            if a:
                a.status = "approved" if approve else "changes_requested"
                a.note, a.decided_at = note, utcnow()
            if approve:
                for t in s.scalars(select(Task).where(Task.project_id == project_id, Task.status == "proposed")):
                    t.status = "pending"
                p.status = "running"
            else:
                p.status = "planning"
        self.message(project_id, "aprovacao", ("Plano aprovado. " if approve else "Plano devolvido para ajustes. ") + note, from_kind="user", to_kind="agent")
        self.project_event(project_id)
        self.spawn(project_id, self.run(project_id) if approve else self.plan(project_id, note))

    # ------------------------------------------------------------------ execução
    async def run(self, project_id: str):
        sem = asyncio.Semaphore(settings.task_concurrency)
        running: dict[str, asyncio.Task] = {}

        async def guarded(task_id: str):
            async with sem:
                await self.execute_task(project_id, task_id)

        try:
            while True:
                with session_scope() as s:
                    p = s.get(Project, project_id)
                    if p.status not in ("running", "revising"):
                        break
                    tasks = list(s.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.position)))
                    done = {t.key for t in tasks if t.status == "done"}
                    failed = {t.key for t in tasks if t.status in ("failed", "cancelled")}
                    ready = [t.id for t in tasks if t.status == "pending" and t.id not in running and all(d in done for d in t.depends_on)]
                    blocked = [t for t in tasks if t.status == "pending" and any(d in failed for d in t.depends_on)]
                    for t in blocked:
                        t.status = "cancelled"
                        t.error = "Dependência falhou"
                    remaining = [t for t in tasks if t.status in ("pending", "running")]
                for tid in ready:
                    running[tid] = asyncio.create_task(guarded(tid))
                if not running and not ready:
                    if remaining and not blocked:
                        await asyncio.sleep(0.2)
                        continue
                    await self.finish(project_id)
                    break
                finished, _ = await asyncio.wait(running.values(), return_when=asyncio.FIRST_COMPLETED)
                for tid in [k for k, v in running.items() if v in finished]:
                    running.pop(tid)
        except StopProject:
            pass
        finally:
            for t in running.values():
                t.cancel()

    async def finish(self, project_id: str):
        with session_scope() as s:
            p = s.get(Project, project_id)
            tasks = list(s.scalars(select(Task).where(Task.project_id == project_id)))
            report = s.scalars(select(Artifact).where(Artifact.project_id == project_id, Artifact.kind == "report")).first()
            coord = self.coordinator_for(s, p)
            ok = report is not None and any(t.kind == "writing" and t.status == "done" for t in tasks)
            p.status = "delivered" if ok else "failed"
            if not ok:
                p.error = p.error or "Execução encerrada sem documento final (verifique tarefas com falha)."
            else:
                s.add(Approval(project_id=project_id, kind="delivery"))
            rid = report.id if report else None
        self.project_event(project_id)
        if coord:
            self.message(project_id, "entrega" if rid else "alerta",
                         "Documento final consolidado e revisado. Aguarda sua avaliação: aprove ou envie feedback." if rid else "O projeto terminou sem documento final.",
                         from_agent=coord.id, to_kind="user", artifact_ids=[rid] if rid else [])

    def _task_ctx(self, project_id: str, task_id: str):
        with session_scope() as s:
            t = s.get(Task, task_id)
            p = s.get(Project, project_id)
            a = s.get(Agent, t.agent_id) if t.agent_id else None
            if a is None:
                a = self.coordinator_for(s, p)
            dep_tasks = list(s.scalars(select(Task).where(Task.project_id == project_id, Task.key.in_(t.depends_on or []))))
            inputs = []
            for d in dep_tasks:
                if d.result_artifact_id:
                    art = s.get(Artifact, d.result_artifact_id)
                    v = latest_version(s, art.id)
                    inputs.append((d, art, v.content if v else ""))
            guidance_msgs = list(s.scalars(select(AgentMessage).where(AgentMessage.project_id == project_id, AgentMessage.to_agent_id == a.id,
                                                                      AgentMessage.type.in_(["orientacao", "feedback"]), AgentMessage.status == "pending")))
            for m in guidance_msgs:
                m.status = "processed"
            guidance = "\n".join(f"Orientação do gestor: {m.content}" for m in guidance_msgs)
            evs = list(s.scalars(select(Evidence).where(Evidence.project_id == project_id).order_by(Evidence.accessed_at)))
            return t, p, a, inputs, guidance, evs

    def step(self, task: Task, agent_id: str, project_id: str, n: int, label: str, tokens: int = 0):
        with session_scope() as s:
            t = s.get(Task, task.id)
            t.steps_done, t.step = n, label
            total = t.steps_total or 1
        self.emit("task.progress", {"agentId": agent_id, "taskId": task.id, "progress": round(n / total, 3), "step": label, "stepsDone": n, "stepsTotal": total, "tokens": tokens}, project_id)

    async def execute_task(self, project_id: str, task_id: str):
        t, p, agent, inputs, guidance, evs = self._task_ctx(project_id, task_id)
        with session_scope() as s:
            tt = s.get(Task, task_id)
            tt.status, tt.started_at, tt.error, tt.steps_done = "running", utcnow(), "", 0
        self.agent_state(agent.id, "planning", t, project_id=project_id)
        system = {"role": "system", "content": P.agent_system(agent.config or {}, agent.name, agent.role)}
        try:
            self.check_running(project_id)
            if t.kind == "research":
                art_id = await self._research(t, p, agent, system, guidance)
            elif t.kind in ("analysis", "general"):
                art_id = await self._analysis(t, p, agent, system, inputs, guidance)
            elif t.kind == "writing":
                art_id = await self._writing(t, p, agent, system, inputs, guidance)
            elif t.kind == "review":
                art_id = await self._review(t, p, agent, system)
            else:
                art_id = await self._revision(t, p, agent, system, guidance)
        except StopProject as exc:
            reason = str(exc)
            with session_scope() as s:
                tt = s.get(Task, task_id)
                tt.status = "pending" if reason in ("paused", "cancelled") else "failed"
                tt.error = {"budget": "Orçamento do projeto atingido", "calls": "Limite de chamadas de LLM atingido"}.get(reason, "")
            if reason in ("budget", "calls"):
                self.set_project(project_id, status="paused", error=f"Execução pausada: {'orçamento' if reason == 'budget' else 'limite de chamadas'} atingido. Aumente o limite para continuar.")
                self.message(project_id, "alerta", "Limite de custo/chamadas atingido — execução pausada aguardando o gestor.", from_kind="system", to_kind="user")
            self.agent_state(agent.id, "paused", t, project_id=project_id)
            raise
        except Exception as exc:  # falha real da tarefa (provedor, rede, JSON...)
            with session_scope() as s:
                tt = s.get(Task, task_id)
                tt.status, tt.error, tt.finished_at = "failed", str(exc)[:2000], utcnow()
            self.agent_state(agent.id, "failed", t, project_id=project_id)
            self.message(project_id, "alerta", f"Falha em '{t.title}': {exc}", from_agent=agent.id, to_kind="user", task_id=t.id)
            self.emit("task.finished", {"agentId": agent.id, "taskId": t.id, "status": "failed", "title": t.title}, project_id)
            return
        with session_scope() as s:
            tt = s.get(Task, task_id)
            tt.status, tt.finished_at, tt.result_artifact_id, tt.step = "done", utcnow(), art_id, "concluída"
            tt.steps_done = tt.steps_total
            dependents = [d for d in s.scalars(select(Task).where(Task.project_id == project_id)) if t.key in (d.depends_on or [])]
            art = s.get(Artifact, art_id)
            art_title = art.title
            dep_agents = {d.agent_id for d in dependents if d.agent_id and d.agent_id != agent.id}
        self.agent_state(agent.id, "completed", t, project_id=project_id)
        self.emit("task.finished", {"agentId": agent.id, "taskId": t.id, "status": "done", "title": t.title, "artifactId": art_id}, project_id)
        for target in dep_agents:  # transferência real de trabalho (visual: caminhar até o colega)
            self.message(project_id, "entrega", f"Entreguei “{art_title}” para você continuar.", from_agent=agent.id, to_agent=target, task_id=t.id, artifact_ids=[art_id])
        await asyncio.sleep(0)
        self.agent_state(agent.id, "idle", project_id=project_id)

    # --------------------------- tipos de tarefa
    def _save_artifact(self, project_id: str, task: Task, agent: Agent, title: str, kind: str, content: str, note: str = "", artifact_id: str | None = None) -> str:
        with session_scope() as s:
            if artifact_id:
                art = s.get(Artifact, artifact_id)
                art.current_version += 1
            else:
                art = Artifact(project_id=project_id, task_id=task.id, agent_id=agent.id, title=title, kind=kind)
                s.add(art)
                s.flush()
            s.add(ArtifactVersion(artifact_id=art.id, version=art.current_version, content=content, agent_id=agent.id, note=note))
            data = {"artifactId": art.id, "version": art.current_version, "title": art.title, "kind": art.kind, "agentId": agent.id}
        self.emit("artifact.version", data, project_id)
        return data["artifactId"]

    async def _research(self, t, p, agent, system, guidance) -> str:
        if "literature_search" not in ((agent.config or {}).get("tools") or []):
            raise RuntimeError(f"{agent.name} não tem a ferramenta 'Busca acadêmica' autorizada. Habilite-a no Agent Studio ou atribua a tarefa a outro agente.")
        self.step(t, agent.id, p.id, 0, "gerando consultas")
        r = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="queries", json_mode=True, max_tokens=400,
                           messages=[system, {"role": "user", "content": P.queries_prompt(t.title, t.description, p.request, guidance)}])
        q = parse_json(r.text)
        queries = [str(x)[:200] for x in (q.get("consultas") or [])][:3] or [t.title]
        year = q.get("ano_minimo") if isinstance(q.get("ano_minimo"), int) else None
        self.step(t, agent.id, p.id, 1, f"buscando fontes ({len(queries)} consultas)", r.input_tokens + r.output_tokens)
        self.agent_state(agent.id, "working", t, project_id=p.id)
        found = []
        for query in queries:
            self.check_running(p.id)
            for src in await get_tools().search(query, limit=5, from_year=year):
                found.append((query, src))
        self.step(t, agent.id, p.id, 2, f"registrando {len(found)} evidências")
        new_evs = []
        with session_scope() as s:
            existing = {(e.doi or e.title.lower()) for e in s.scalars(select(Evidence).where(Evidence.project_id == p.id))}
            n = s.scalar(select(func.count()).select_from(Evidence).where(Evidence.project_id == p.id)) or 0
            for query, src in found:
                k = src.doi or src.title.lower()
                if k in existing:
                    continue
                existing.add(k)
                n += 1
                e = Evidence(project_id=p.id, task_id=t.id, agent_id=agent.id, code=f"E{n}", source=src.source, title=src.title, authors=", ".join(src.authors),
                             year=src.year, doi=src.doi, url=src.url, abstract=src.abstract, query=query)
                s.add(e)
                new_evs.append(e)
            s.flush()
            evs = list(s.scalars(select(Evidence).where(Evidence.task_id == t.id)))
        self.emit("evidence", {"taskId": t.id, "count": len(new_evs), "agentId": agent.id}, p.id)
        self.message(p.id, "discussao", f"Encontrei {len(evs)} fontes para “{t.title}”.", from_agent=agent.id, to_kind="agent", task_id=t.id)
        self.step(t, agent.id, p.id, 3, "redigindo achados")
        r2 = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="findings",
                            messages=[system, {"role": "user", "content": P.findings_prompt(t.title, t.description, P.evidence_block(evs), guidance)}])
        return self._save_artifact(p.id, t, agent, f"Achados: {t.title}", "findings", r2.text, note=f"{len(evs)} fontes (resumos)")

    async def _analysis(self, t, p, agent, system, inputs, guidance) -> str:
        self.step(t, agent.id, p.id, 0, "reunindo entregas")
        self.agent_state(agent.id, "working", t, project_id=p.id)
        with session_scope() as s:
            evs = list(s.scalars(select(Evidence).where(Evidence.project_id == p.id)))
        block = "\n\n".join(f"<documento autor=\"{a.title}\">\n{c[:6000]}\n</documento>" for _, a, c in inputs) or "(sem entregas anteriores)"
        self.step(t, agent.id, p.id, 1, "analisando")
        r = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="analysis",
                           messages=[system, {"role": "user", "content": P.analysis_prompt(t.title, t.description, block, P.evidence_block(evs), guidance)}])
        return self._save_artifact(p.id, t, agent, f"Análise: {t.title}", "analysis", r.text)

    async def _writing(self, t, p, agent, system, inputs, guidance) -> str:
        self.step(t, agent.id, p.id, 0, "reunindo entregas da equipe")
        self.agent_state(agent.id, "working", t, project_id=p.id)
        with session_scope() as s:
            evs = list(s.scalars(select(Evidence).where(Evidence.project_id == p.id)))
        block = "\n\n".join(f"<documento titulo=\"{a.title}\">\n{c[:7000]}\n</documento>" for _, a, c in inputs)
        self.step(t, agent.id, p.id, 1, "redigindo relatório")
        r = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="report", max_tokens=6000,
                           messages=[system, {"role": "user", "content": P.report_prompt(p.title, p.request, p.plan or {}, block, P.evidence_block(evs), guidance)}])
        self.step(t, agent.id, p.id, 2, "gerando referências a partir das evidências")
        content, note = with_references(r.text, evs)
        return self._save_artifact(p.id, t, agent, f"Relatório: {p.title}", "report", content, note=note)

    async def _review(self, t, p, agent, system) -> str:
        self.step(t, agent.id, p.id, 0, "lendo documento")
        self.agent_state(agent.id, "reviewing", t, project_id=p.id)
        with session_scope() as s:
            report = s.scalars(select(Artifact).where(Artifact.project_id == p.id, Artifact.kind == "report")).first()
            if not report:
                raise RuntimeError("Não há relatório para revisar")
            content = latest_version(s, report.id).content
            evs = list(s.scalars(select(Evidence).where(Evidence.project_id == p.id)))
            writer_id = report.agent_id
        self.step(t, agent.id, p.id, 1, "verificando evidências e citações")
        r = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="review", json_mode=True, max_tokens=2500,
                           messages=[system, {"role": "user", "content": P.review_prompt(content, P.evidence_block(evs), (p.plan or {}).get("criterios_qualidade", []))}])
        rv = parse_json(r.text)
        bad = invalid_citations(content, evs)
        problems = rv.get("problemas") or []
        if bad:
            problems.append({"trecho": ", ".join(bad), "problema": "Citação de fonte inexistente", "sugestao": "Remover ou substituir por fonte registrada"})
        approved = bool(rv.get("aprovado")) and not bad
        md = [f"# Parecer de revisão — {'APROVADO' if approved else 'REVISÃO NECESSÁRIA'}", "", rv.get("resumo", ""), ""]
        if problems:
            md += ["## Problemas", "", "| Trecho | Problema | Sugestão |", "|---|---|---|"] + [f"| {x.get('trecho','')} | {x.get('problema','')} | {x.get('sugestao','')} |" for x in problems]
        if rv.get("afirmacoes_sem_evidencia"):
            md += ["", "## Afirmações sem evidência suficiente", ""] + [f"- {x}" for x in rv["afirmacoes_sem_evidencia"]]
        art = self._save_artifact(p.id, t, agent, "Parecer de revisão", "review", "\n".join(md))
        self.message(p.id, "revisao", f"Revisão concluída: {'aprovado' if approved else f'{len(problems)} problema(s) a corrigir'}.", from_agent=agent.id, to_agent=writer_id, task_id=t.id, artifact_ids=[art, report.id])
        with session_scope() as s:
            pp = s.get(Project, p.id)
            if not approved and pp.auto_revisions < settings.max_auto_revisions and writer_id:
                pp.auto_revisions += 1
                n = s.scalar(select(func.count()).select_from(Task).where(Task.project_id == p.id)) or 0
                req = "\n".join(f"- {x.get('problema')}: {x.get('sugestao')} (trecho: {x.get('trecho')})" for x in problems) + "\n" + "\n".join(f"- Fundamentar ou remover: {x}" for x in rv.get("afirmacoes_sem_evidencia") or [])
                s.add(Task(project_id=p.id, key=f"RV{pp.auto_revisions}", title="Aplicar revisão do revisor", description=req, kind="revision", agent_id=writer_id,
                           depends_on=[t.key], status="pending", steps_total=STEPS["revision"], target_artifact_id=report.id, position=n))
        return art

    async def _revision(self, t, p, agent, system, guidance) -> str:
        self.step(t, agent.id, p.id, 0, "lendo solicitações de revisão")
        self.agent_state(agent.id, "working", t, project_id=p.id)
        with session_scope() as s:
            art = s.get(Artifact, t.target_artifact_id) if t.target_artifact_id else s.scalars(select(Artifact).where(Artifact.project_id == p.id, Artifact.kind == "report")).first()
            if not art:
                raise RuntimeError("Artefato a revisar não encontrado")
            content = latest_version(s, art.id).content
            evs = list(s.scalars(select(Evidence).where(Evidence.project_id == p.id)))
            art_id, art_kind = art.id, art.kind
        body = content.split("\n## Referências")[0]
        self.step(t, agent.id, p.id, 1, "revisando documento")
        r = await self.llm(project_id=p.id, task_id=t.id, agent=agent, purpose="revision", max_tokens=6000,
                           messages=[system, {"role": "user", "content": P.revision_prompt(body, (t.description + "\n" + guidance).strip(), P.evidence_block(evs))}])
        self.step(t, agent.id, p.id, 2, "registrando nova versão")
        new, note = (with_references(r.text, evs) if art_kind == "report" else (r.text, ""))
        return self._save_artifact(p.id, t, agent, "", art_kind, new, note=f"Revisão: {t.title}. {note}".strip(), artifact_id=art_id)

    # ------------------------------------------------------------------ gestão humana
    def feedback(self, project_id: str, artifact_id: str, text: str, agent_id: str | None = None):
        with session_scope() as s:
            p = s.get(Project, project_id)
            art = s.get(Artifact, artifact_id)
            if not art or art.project_id != project_id:
                raise ValueError("Artefato não encontrado")
            target = agent_id or art.agent_id
            for a in s.scalars(select(Approval).where(Approval.project_id == project_id, Approval.kind == "delivery", Approval.status == "pending")):
                a.status, a.note, a.decided_at = "changes_requested", text, utcnow()
            n = s.scalar(select(func.count()).select_from(Task).where(Task.project_id == project_id)) or 0
            s.add(Task(project_id=project_id, key=f"FB{n + 1}", title=f"Feedback do gestor em “{art.title}”", description=text, kind="revision", agent_id=target,
                       depends_on=[], status="pending", steps_total=STEPS["revision"], target_artifact_id=artifact_id, position=n))
            p.status, p.error = "revising", ""
        self.message(project_id, "feedback", text, from_kind="user", to_agent=target, artifact_ids=[artifact_id])
        self.project_event(project_id)
        if project_id not in self.runners:
            self.spawn(project_id, self.run(project_id))

    def guidance(self, project_id: str, agent_id: str, text: str):
        with session_scope() as s:
            p = s.get(Project, project_id)
            open_tasks = list(s.scalars(select(Task).where(Task.project_id == project_id, Task.agent_id == agent_id, Task.status.in_(["pending", "running", "proposed"]))))
            pending = bool(open_tasks)
            status = p.status
        self.message(project_id, "orientacao", text, from_kind="user", to_agent=agent_id, status="pending" if pending else "processed")
        if not pending and status in ("delivered", "completed", "running", "revising", "paused"):
            with session_scope() as s:
                last = s.scalars(select(Artifact).where(Artifact.project_id == project_id, Artifact.agent_id == agent_id).order_by(Artifact.created_at.desc())).first()
            if last:
                self.feedback(project_id, last.id, text, agent_id)

    def decide_delivery(self, project_id: str, approve: bool, note: str = ""):
        with session_scope() as s:
            p = s.get(Project, project_id)
            for a in s.scalars(select(Approval).where(Approval.project_id == project_id, Approval.kind == "delivery", Approval.status == "pending")):
                a.status, a.note, a.decided_at = ("approved" if approve else "rejected"), note, utcnow()
            p.status = "completed" if approve else "delivered"
        self.message(project_id, "aprovacao", "Entrega aprovada pelo gestor." if approve else f"Entrega rejeitada: {note}", from_kind="user", to_kind="agent")
        self.project_event(project_id)

    def set_status(self, project_id: str, action: str):
        with session_scope() as s:
            p = s.get(Project, project_id)
            if action == "pause" and p.status in ("running", "revising"):
                p.status = "paused"
            elif action == "resume" and p.status == "paused":
                p.status, p.error = "running", ""
                for t in s.scalars(select(Task).where(Task.project_id == project_id, Task.status == "failed")):
                    if "Orçamento" in t.error or "Limite" in t.error:
                        t.status, t.error = "pending", ""
            elif action == "cancel":
                p.status = "cancelled"
                for t in s.scalars(select(Task).where(Task.project_id == project_id, Task.status.in_(["pending", "proposed"]))):
                    t.status = "cancelled"
            else:
                raise ValueError("Ação inválida para o estado atual")
            status = p.status
        self.project_event(project_id)
        if status == "running" and project_id not in self.runners:
            self.spawn(project_id, self.run(project_id))

    def set_budget(self, project_id: str, budget: float):
        self.set_project(project_id, budget_usd=max(0.01, budget))

    def assign_task(self, agent_id: str, title: str, description: str, kind: str = "general") -> str:
        """Tarefa avulsa atribuída diretamente pelo gestor a um agente (sem planejamento)."""
        with session_scope() as s:
            a = s.get(Agent, agent_id)
            if not a:
                raise ValueError("Agente não encontrado")
            p = Project(owner_id=a.owner_id, organization_id=a.organization_id, title=title[:200], request=description or title, status="running", budget_usd=settings.default_project_budget_usd,
                        plan={"objetivo": title, "tarefa_avulsa": True})
            s.add(p)
            s.flush()
            s.add(Task(project_id=p.id, key="T1", title=title[:200], description=description, kind=kind if kind in STEPS and kind != "revision" else "general",
                       agent_id=agent_id, status="pending", steps_total=STEPS.get(kind, 2)))
            pid = p.id
        self.message(pid, "delegacao", f"{title}\n{description}".strip(), from_kind="user", to_agent=agent_id)
        self.project_event(pid)
        self.spawn(pid, self.run_single(pid))
        return pid

    async def run_single(self, project_id: str):
        with session_scope() as s:
            t = s.scalars(select(Task).where(Task.project_id == project_id)).first()
            tid = t.id
        try:
            await self.execute_task(project_id, tid)
        except StopProject:
            return
        with session_scope() as s:
            t = s.get(Task, tid)
            p = s.get(Project, project_id)
            p.status = "delivered" if t.status == "done" else "failed"
            if t.status == "done":
                s.add(Approval(project_id=project_id, kind="delivery"))
        self.project_event(project_id)

    async def chat(self, agent_id: str, text: str, history: list[dict]) -> dict:
        with session_scope() as s:
            a = s.get(Agent, agent_id)
            if not a:
                raise ValueError("Agente não encontrado")
            s.expunge(a)
        self.message(None, "solicitacao", text, from_kind="user", to_agent=agent_id, owner=a.owner_id)
        msgs = [{"role": "system", "content": P.agent_system(a.config or {}, a.name, a.role)}] + [m for m in history[-10:] if m.get("role") in ("user", "assistant")] + [{"role": "user", "content": text}]
        r = await self.llm(project_id=None, task_id=None, agent=a, purpose="chat", messages=msgs, max_tokens=1200)
        reply = self.message(None, "resposta", r.text, from_agent=agent_id, to_kind="user", owner=a.owner_id)
        return {"reply": r.text, "message": reply, "tokens": r.input_tokens + r.output_tokens, "costUsd": r.cost_usd}

    def reanalyze(self, project_id: str, provider: str | None = None, model: str | None = None, apply_to_team: bool = False, note: str = ""):
        """Refaz o planejamento do projeto (ex.: depois de trocar o modelo de IA).
        Opcionalmente aplica provedor/modelo a todos os agentes da equipe antes de replanejar."""
        with session_scope() as s:
            p = s.get(Project, project_id)
            if p.status in ("running", "revising") or project_id in self.runners:
                raise ValueError("Pause ou aguarde a execução antes de reanalisar.")
            if p.status == "completed":
                raise ValueError("Projeto já concluído; crie um novo projeto.")
            changed = 0
            if apply_to_team and provider:
                for a in self.team_of(s, p):
                    cfg = dict(a.config or {})
                    intel = dict(cfg.get("intelligence") or {})
                    if intel.get("provider") != provider:
                        intel["credentialId"] = None
                    intel["provider"], intel["model"] = provider, (model or "")
                    cfg["intelligence"] = intel
                    a.config = cfg
                    changed += 1
            for t in s.scalars(select(Task).where(Task.project_id == project_id, Task.status.in_(["proposed", "pending", "failed", "cancelled"]))):
                s.delete(t)
            for a in s.scalars(select(Approval).where(Approval.project_id == project_id, Approval.status == "pending")):
                a.status, a.decided_at, a.note = "superseded", utcnow(), "Projeto reanalisado"
            p.status, p.error = "planning", ""
        txt = "Reanálise solicitada pelo gestor" + (f" com {provider}/{model or 'modelo padrão'} aplicado a {changed} agente(s)" if changed else "") + (f". {note}" if note else ".")
        self.message(project_id, "correcao", txt, from_kind="user", to_kind="agent")
        self.project_event(project_id)
        self.spawn(project_id, self.plan(project_id, note))
        return changed

    def retry_failed(self, project_id: str):
        """Reexecuta tarefas que falharam (ex.: erro do provedor) mantendo as concluídas."""
        with session_scope() as s:
            p = s.get(Project, project_id)
            if project_id in self.runners:
                raise ValueError("O projeto já está em execução.")
            tasks = list(s.scalars(select(Task).where(Task.project_id == project_id)))
            again = [t for t in tasks if t.status in ("failed", "cancelled")]
            if not tasks or p.status == "planning" or not again and p.status != "failed":
                raise ValueError("Não há tarefas com falha para repetir. Use Reanalisar para refazer o plano.")
            for t in again:
                t.status, t.error, t.steps_done, t.step = "pending", "", 0, ""
            p.status, p.error = "running", ""
        self.message(project_id, "correcao", f"Gestor pediu nova tentativa de {len(again)} tarefa(s).", from_kind="user", to_kind="agent")
        self.project_event(project_id)
        self.spawn(project_id, self.run(project_id))

    def recover(self):
        """Retoma projetos interrompidos (ex.: reinício do app)."""
        with session_scope() as s:
            ids = []
            for p in s.scalars(select(Project).where(Project.status.in_(["running", "revising", "planning"]))):
                for t in s.scalars(select(Task).where(Task.project_id == p.id, Task.status == "running")):
                    t.status = "pending"
                ids.append((p.id, p.status))
        for pid, st in ids:
            self.spawn(pid, self.plan(pid) if st == "planning" else self.run(pid))


# ---------------------------------------------------------------------- helpers puros
def latest_version(s, artifact_id: str) -> ArtifactVersion | None:
    return s.scalars(select(ArtifactVersion).where(ArtifactVersion.artifact_id == artifact_id).order_by(ArtifactVersion.version.desc())).first()


def cited_codes(text: str) -> list[str]:
    seen = []
    for m in re.findall(r"\[E(\d+)\]", text):
        c = f"E{m}"
        if c not in seen:
            seen.append(c)
    return seen


def invalid_citations(text: str, evs: list[Evidence]) -> list[str]:
    valid = {e.code for e in evs}
    return [c for c in cited_codes(text) if c not in valid]


def with_references(text: str, evs: list[Evidence]) -> tuple[str, str]:
    """Referências geradas pelo SISTEMA a partir das evidências citadas (evita referências inventadas)."""
    body = re.split(r"\n#{1,3}\s*Refer[êe]ncias", text)[0].rstrip()
    by = {e.code: e for e in evs}
    refs = []
    for c in cited_codes(body):
        e = by.get(c)
        if e:
            loc = f"https://doi.org/{e.doi}" if e.doi else e.url
            refs.append(f"- **[{c}]** {e.authors or 'Autoria não informada'} ({e.year or 's.d.'}). *{e.title}*. {loc} — fonte: {e.source}; consultado apenas o resumo.")
    bad = invalid_citations(body, evs)
    note = f"{len(refs)} referências verificadas" + (f"; citações inexistentes: {', '.join(bad)}" if bad else "")
    return body + "\n\n## Referências\n\n" + ("\n".join(refs) or "_Nenhuma fonte citada._") + "\n", note


def diff_versions(a: str, b: str) -> str:
    return "\n".join(difflib.unified_diff(a.splitlines(), b.splitlines(), "versão anterior", "nova versão", lineterm=""))


def message_public(m: AgentMessage) -> dict:
    return {"id": m.id, "projectId": m.project_id, "taskId": m.task_id, "fromKind": m.from_kind, "fromAgentId": m.from_agent_id, "toKind": m.to_kind,
            "toAgentId": m.to_agent_id, "type": m.type, "content": m.content, "artifactIds": m.artifact_ids or [], "status": m.status, "createdAt": m.created_at.isoformat()}


def execution_public(e: Execution) -> dict:
    return {"id": e.id, "projectId": e.project_id, "taskId": e.task_id, "agentId": e.agent_id, "purpose": e.purpose, "provider": e.provider, "model": e.model,
            "inputTokens": e.input_tokens, "outputTokens": e.output_tokens, "costUsd": round(e.cost_usd, 6), "costIsEstimate": e.cost_is_estimate,
            "latencyMs": e.latency_ms, "status": e.status, "error": e.error, "createdAt": e.created_at.isoformat()}


orchestrator = Orchestrator()
