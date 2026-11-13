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
    "departments": ["Coordenação", "Pesquisa", "Análise", "Redação", "Qualidade"],
    "agents": [
        ("ag-coordenador", "Coordenador de Pesquisa", "Coordenador", "Coordenação", True, "orquestradora", "#ffb800", "research-w_lab1",
         "Interpreta solicitações, define objetivo, escopo e divide o trabalho entre a equipe com dependências claras.", [], False),
        ("ag-pesq-cientifico", "Pesquisador Científico", "Pesquisador Científico", "Pesquisa", False, "pesquisadora", "#39d6ff", "research-w_lab2",
         "Busca e seleciona literatura científica (OpenAlex, arXiv), registra cada fonte como evidência e resume achados citando [E#].", ["literature_search"], True),
        ("ag-pesq-aero", "Pesquisadora de Aplicações Aeronáuticas", "Pesquisador de Aplicações", "Pesquisa", False, "rag", "#e9ecf5", "research-w_lab3",
         "Investiga aplicações práticas e casos de uso no domínio do projeto, registrando evidências verificáveis.", ["literature_search"], True),
        ("ag-analista-tec", "Analista Técnico", "Analista Técnico", "Análise", False, "analista", "#00f5a0", "research-w_banc1",
         "Compara abordagens, identifica tendências, riscos, limitações e lacunas a partir das entregas e evidências.", [], False),
        ("ag-redator", "Redatora Técnico-Científica", "Redator Técnico-Científico", "Redação", False, "redatora", "#ff537a", "research-w_banc2",
         "Consolida as entregas da equipe em um relatório estruturado, citando apenas evidências registradas.", [], False),
        ("ag-revisor-cient", "Revisor Científico", "Revisor Científico", "Qualidade", False, "revisor", "#9d62ff", "research-w_banc3",
         "Avalia coerência, rigor, cobertura do escopo e se toda afirmação relevante está sustentada por evidência.", [], False),
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
     "roles": ["Coordenador", "Pesquisador Científico", "Pesquisador de Aplicações", "Analista Técnico", "Redator Técnico-Científico", "Revisor Científico"]},
    {"id": "business_office", "name": "Escritório Empresarial", "environmentId": "office", "departments": OFFICE["departments"],
     "roles": ["Gestor", "Analista Financeiro", "Analista Contábil", "Assistente Administrativo", "Analista Comercial", "Redator de Marketing", "Engenheiro de Software"]},
    {"id": "software_factory", "name": "Fábrica de Software", "environmentId": "office", "departments": ["Produto", "Engenharia", "Qualidade", "Documentação"],
     "roles": ["Gerente de Produto", "Engenheiro de Software", "Engenheiro de Testes", "Redator Técnico"]},
]


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
            return _seed(owner)
        except IntegrityError:  # outro processo semeou ao mesmo tempo
            _seeded.add(owner)
            return False


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
                s.add(Agent(id=uid("ag"), owner_id=owner, organization_id=oid, name=name, role=role, department=dept, is_coordinator=coord, config=cfg))
    _seeded.add(owner)
    return True
