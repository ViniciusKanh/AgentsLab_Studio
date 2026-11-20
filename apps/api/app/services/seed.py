"""
Organizações iniciais (configuração, não dados fictícios): equipes de agentes prontos para trabalhar.
Os agentes só executam algo quando há uma credencial configurada para o provedor escolhido.
"""
from __future__ import annotations

import threading

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db import session_scope
from app.models import Agent, Department, Organization
from app.services.academic_agents import ACADEMIC_AGENTS, ACADEMIC_VERSION

# model vazio = usa o "modelo padrão" escolhido pelo usuário em Provedores e Custos
DEFAULT_MODEL = {"provider": "gemini", "model": ""}


def agent_config(*, description: str, objective: str, character: str, color: str, env: str, station: str | None, instructions: str,
                 tools: list[str], internet: bool = False, behavior: str = "analitico", temperature: float = 0.3, personality: dict | None = None) -> dict:
    return {
        "description": description, "objective": objective,
        "appearance": {"characterId": character, "accentColor": color},
        "environmentId": env, "stationId": station,
        "intelligence": {**DEFAULT_MODEL, "instructions": instructions, "behavior": behavior, "temperature": temperature, "topP": 0.9,
                         "maxOutputTokens": 4096, "credentialId": None},
        "tools": tools,
        "permissions": {"readFiles": True, "writeFiles": False, "internet": internet, "externalApis": internet, "sensitiveRequiresApproval": True},
        "integrations": [], "knowledge": {"sources": [], "documents": [], "memory": "short", "ragEnabled": False, "ragBaseId": None},
        "limits": {"maxTokensPerRun": 8000, "maxCostPerDayUsd": 2, "timeoutSec": 180, "maxRetries": 1},
        "rules": {"autonomy": "supervised", "requireHumanReview": True, "allowDelegation": True, "restrictions": ""},
        "tags": [], "status": "active", "version": "1.0.0",
        "personality": personality or {"sociability": 50, "creativity": 50, "organization": 60, "curiosity": 60, "collaboration": 60, "initiative": 55, "preference": "duplas"},
    }


RESEARCH = {
    "id": "org-pesquisa-ia", "name": "Laboratório de Pesquisa em IA", "template": "research_lab", "environment_id": "research",
    "description": "Equipe de pesquisa científica: levantamento bibliográfico, análise e redação técnica com evidências verificáveis.",
    "departments": ["Coordenação", "Pesquisa", "Pesquisa Aplicada", "Análise", "Redação Acadêmica", "Qualidade Científica",
                    "Revisão da Literatura", "Fundamentação Teórica", "Metodologia e Experimentos"],
    "agents": [
        ("ag-coordenador", "Coordenador de Pesquisa", "Coordenador", "Coordenação", True, "orquestradora", "#ffb800", "research-w_lab1",
         "Interpreta solicitações, define objetivo, escopo e divide o trabalho entre a equipe com dependências claras.", [], False),
        ("ag-pesq-cientifico", "Pesquisador Científico", "Pesquisador Científico", "Pesquisa", False, "pesquisadora", "#39d6ff", "research-w_lab2",
         "Busca e seleciona literatura científica (OpenAlex, arXiv), registra cada fonte como evidência e resume achados citando [E#].", ["literature_search"], True),
        ("ag-pesq-aero", "Pesquisadora de Aplicações Aeronáuticas", "Pesquisador de Aplicações", "Pesquisa Aplicada", False, "rag", "#39d6ff", "research-w_lab3",
         "Investiga aplicações práticas e casos de uso no domínio do projeto, registrando evidências verificáveis.", ["literature_search"], True),
        ("ag-analista-tec", "Analista Técnico", "Analista Técnico", "Análise", False, "analista", "#00f5a0", "research-w_banc1",
         "Compara abordagens, identifica tendências, riscos, limitações e lacunas a partir das entregas e evidências.", [], False),
        ("ag-redator", "Redatora Técnico-Científica", "Redator Técnico-Científico", "Redação", False, "redatora", "#ff537a", "research-w_banc2",
         "Consolida as entregas da equipe em um relatório estruturado, citando apenas evidências registradas.", [], False),
        ("ag-revisor-cient", "Revisor Científico", "Revisor Científico", "Qualidade", False, "revisor", "#9d62ff", "research-w_banc3",
         "Avalia coerência, rigor, cobertura do escopo e se toda afirmação relevante está sustentada por evidência.", [], False),
        ("ag-rev-lit", "Especialista em Revisão da Literatura", "Especialista em Revisões Bibliográficas e Trabalhos Relacionados", "Revisão da Literatura", False,
         "pesquisadora", "#b48cff", "research-w_banc4", "Seleciona, classifica e sintetiza estudos.", ["literature_search"], True),
        ("ag-fund-teo", "Especialista em Fundamentação Teórica", "Especialista em Bases Conceituais e Fundamentação Científica", "Fundamentação Teórica", False,
         "planejador", "#ffb800", None, "Estrutura conceitos, princípios e bases teóricas.", ["literature_search"], True),
        ("ag-metodo", "Especialista em Metodologia Científica", "Especialista em Metodologia, Experimentos e Validação Científica", "Metodologia e Experimentos", False,
         "engenheiro", "#7fe3ff", None, "Planeja métodos, protocolos e avaliação.", ["literature_search"], True),
    ],
}

OFFICE = {
    "id": "org-escritorio", "name": "Escritório Empresarial", "template": "business_office", "environment_id": "office",
    "description": "Departamentos administrativos de uma empresa. Ações sensíveis (pagamentos, lançamentos, declarações) exigem integração configurada e aprovação humana.",
    "departments": ["Gestão", "Financeiro", "Contábil", "Administrativo", "Comercial", "Marketing", "Tecnologia"],
    "agents": [
        ("ag-gestor", "Gestora Executiva", "Gestor", "Gestão", True, "planejador", "#ffb800", "office-w_mesa0",
         "Interpreta demandas da diretoria, prioriza e distribui o trabalho entre departamentos.", [], False),
        ("ag-financeiro", "Analista Financeiro", "Analista Financeiro", "Financeiro", False, "bi", "#00f5a0", "office-w_dados1",
         "Elabora análises financeiras, orçamentos e projeções. Não executa pagamentos nem movimentações sem integração e aprovação.", [], False),
        ("ag-contabil", "Analista Contábil", "Analista Contábil", "Contábil", False, "analista", "#39d6ff", "office-w_dados2",
         "Organiza informações contábeis e prepara rascunhos de demonstrativos. Não realiza lançamentos oficiais nem declarações.", [], False),
        ("ag-administrativo", "Assistente Administrativo", "Assistente Administrativo", "Administrativo", False, "assistente", "#ff537a", "office-w_mesa1",
         "Organiza processos, documentos internos, checklists e comunicações.", [], False),
        ("ag-comercial", "Executiva Comercial", "Analista Comercial", "Comercial", False, "redatora", "#9d62ff", "office-w_mesa2",
         "Prepara propostas, análises de clientes e estratégias comerciais.", [], False),
        ("ag-marketing", "Estrategista de Marketing", "Redator de Marketing", "Marketing", False, "pesquisadora", "#ff537a", "office-w_mesa3",
         "Cria planos de comunicação, conteúdos e campanhas.", [], False),
        ("ag-tecnologia", "Engenheiro de Tecnologia", "Engenheiro de Software", "Tecnologia", False, "engenheiro", "#9d62ff", "office-w_dev1",
         "Avalia sistemas, propõe soluções técnicas e documenta arquitetura.", [], False),
    ],
}

TEMPLATES = [
    {"id": "research_lab", "name": "Laboratório de Pesquisa", "environmentId": "research", "departments": RESEARCH["departments"],
     "roles": ["Coordenador", "Pesquisador Científico"] + [a["role"] for a in ACADEMIC_AGENTS]},
    {"id": "business_office", "name": "Escritório Empresarial", "environmentId": "office", "departments": OFFICE["departments"],
     "roles": ["Gestor", "Analista Financeiro", "Analista Contábil", "Assistente Administrativo", "Analista Comercial", "Redator de Marketing", "Engenheiro de Software"]},
    {"id": "software_factory", "name": "Fábrica de Software", "environmentId": "office", "departments": ["Produto", "Engenharia", "Qualidade", "Documentação"],
     "roles": ["Gerente de Produto", "Engenheiro de Software", "Engenheiro de Testes", "Redator Técnico"]},
]


ACADEMIC = {a["name"]: a for a in ACADEMIC_AGENTS}
_ACADEMIC_TOOLS = {"Pesquisadora de Aplicações Aeronáuticas", "Especialista em Revisão da Literatura", "Especialista em Fundamentação Teórica",
                   "Especialista em Metodologia Científica", "Analista Técnico", "Revisor Científico"}  # Busca acadêmica (OpenAlex + arXiv) — funcional


def apply_academic(cfg: dict, spec: dict) -> dict:
    """Aplica identidade, inteligência, limites e regras do documento de configuração (preserva avatar/estação)."""
    cfg = dict(cfg)
    intel = dict(cfg.get("intelligence") or {})
    intel.update({"instructions": spec["instructions"], "behavior": "analitico", "temperature": spec["temperature"], "topP": spec["topP"], "maxOutputTokens": 4096})
    tools = list(cfg.get("tools") or [])
    if spec["name"] in _ACADEMIC_TOOLS and "literature_search" not in tools:
        tools.append("literature_search")
    cfg.update({
        "description": spec["description"], "objective": spec["objective"], "intelligence": intel, "tools": tools, "tags": spec["tags"],
        "permissions": {"readFiles": True, "writeFiles": False, "internet": "literature_search" in tools, "externalApis": "literature_search" in tools,
                        "sensitiveRequiresApproval": True},
        "knowledge": {"sources": ["Artigos científicos", "Documentação técnica"], "documents": [], "memory": "short", "ragEnabled": False, "ragBaseId": None},
        "limits": {"maxTokensPerRun": 8000, "maxCostPerDayUsd": spec["maxCostPerDayUsd"], "timeoutSec": 240, "maxRetries": 1},
        "rules": {"autonomy": "supervised", "requireHumanReview": True, "allowDelegation": False, "restrictions": spec["restrictions"]},
        "personality": {**spec["personality"], "preference": "duplas"}, "version": "2.0.0",
    })
    appearance = dict(cfg.get("appearance") or {})
    if not appearance.get("accentColor"):
        appearance["accentColor"] = spec["color"]
    cfg["appearance"] = appearance
    return cfg


def upgrade_research_team(owner: str) -> int:
    """Atualização ÚNICA das organizações de pesquisa existentes: edita os 4 agentes do documento (mesmo id,
    avatar e histórico) e cria os 3 novos. Coordenador e Pesquisador Científico não são alterados."""
    from app.models import KeyValue, uid

    flag = f"{ACADEMIC_VERSION}:{owner}"
    changed = 0
    with session_scope() as s:
        if s.get(KeyValue, flag):
            return 0
        s.add(KeyValue(key=flag, value={"at": "upgrade"}))
        s.flush()
        for org in s.scalars(select(Organization).where(Organization.owner_id == owner, Organization.template == "research_lab")):
            agents = {a.name: a for a in s.scalars(select(Agent).where(Agent.owner_id == owner, Agent.organization_id == org.id))}
            depts = {d.name for d in s.scalars(select(Department).where(Department.organization_id == org.id))}
            for spec in ACADEMIC_AGENTS:
                if spec["department"] not in depts:
                    s.add(Department(organization_id=org.id, name=spec["department"]))
                    depts.add(spec["department"])
                a = agents.get(spec["name"])
                if a is not None:
                    a.role, a.department, a.config = spec["role"], spec["department"], apply_academic(a.config or {}, spec)
                    changed += 1
                elif spec["create"]:
                    row = next(r for r in RESEARCH["agents"] if r[1] == spec["name"])
                    base = agent_config(description=spec["description"], objective=spec["objective"], character=spec.get("character") or row[5], color=spec["color"],
                                        env=org.environment_id, station=row[7], instructions=spec["instructions"], tools=row[9], internet=row[10])
                    s.add(Agent(id=uid("ag"), owner_id=owner, organization_id=org.id, name=spec["name"], role=spec["role"], department=spec["department"],
                                is_coordinator=False, config=apply_academic(base, spec)))
                    changed += 1
    return changed


_seeded: set[str] = set()
_lock = threading.Lock()


def seed_for_owner(owner: str = "local") -> bool:
    """Cria as organizações iniciais do usuário uma única vez (se ele apagá-las, não voltam).
    Requisições simultâneas do mesmo usuário são serializadas (lock) e o marcador `seeded:<id>`
    é gravado na mesma transação — em vários processos, a chave única evita duplicação."""
    if owner in _seeded:
        return False
    with _lock:
        if owner in _seeded:
            return False
        try:
            created = _seed(owner)
        except IntegrityError:  # outro processo semeou ao mesmo tempo
            _seeded.add(owner)
            return False
        try:
            upgrade_research_team(owner)
        except IntegrityError:
            pass
        return created


def _seed(owner: str) -> bool:
    from app.models import KeyValue, uid

    with session_scope() as s:
        flag = f"seeded:{owner}"
        if s.get(KeyValue, flag) or s.scalars(select(Organization).where(Organization.owner_id == owner)).first():
            if not s.get(KeyValue, flag):
                s.add(KeyValue(key=flag, value={"at": "pre-existente"}))
            _seeded.add(owner)
            return False
        s.add(KeyValue(key=flag, value={"at": "seed"}))
        s.flush()  # garante o marcador antes de criar as organizações
        for org in (RESEARCH, OFFICE):
            oid = uid("org")
            s.add(Organization(id=oid, owner_id=owner, name=org["name"], description=org["description"], template=org["template"], environment_id=org["environment_id"]))
            s.flush()
            for d in org["departments"]:
                s.add(Department(organization_id=oid, name=d))
            for (_aid, name, role, dept, coord, char, color, station, desc, tools, internet) in org["agents"]:
                cfg = agent_config(description=desc, objective=desc, character=char, color=color, env=org["environment_id"], station=station,
                                   instructions=f"Atue como {role}. {desc} Explique decisões e limitações.", tools=tools, internet=internet)
                spec = ACADEMIC.get(name) if org is RESEARCH else None
                if spec:
                    role, dept, cfg = spec["role"], spec["department"], apply_academic(cfg, spec)
                s.add(Agent(id=uid("ag"), owner_id=owner, organization_id=oid, name=name, role=role, department=dept, is_coordinator=coord, config=cfg))
        s.add(KeyValue(key=f"{ACADEMIC_VERSION}:{owner}", value={"at": "seed"}))
    _seeded.add(owner)
    return True
