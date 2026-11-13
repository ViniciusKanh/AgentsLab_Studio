"""
Organizações iniciais (configuração, não dados fictícios): equipes de agentes prontos para trabalhar.
Os agentes só executam algo quando há uma credencial configurada para o provedor escolhido.
"""
from __future__ import annotations

from sqlalchemy import select

from app.db import session_scope
from app.models import Agent, Department, Organization

DEFAULT_MODEL = {"provider": "gemini", "model": "gemini-2.5-flash"}


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


def seed_organizations():
    with session_scope() as s:
        if s.scalars(select(Organization)).first():
            return False
        for org in (RESEARCH, OFFICE):
            s.add(Organization(id=org["id"], name=org["name"], description=org["description"], template=org["template"], environment_id=org["environment_id"]))
            s.flush()
            for d in org["departments"]:
                s.add(Department(organization_id=org["id"], name=d))
            for (aid, name, role, dept, coord, char, color, station, desc, tools, internet) in org["agents"]:
                cfg = agent_config(description=desc, objective=desc, character=char, color=color, env=org["environment_id"], station=station,
                                   instructions=f"Atue como {role}. {desc} Explique decisões e limitações.", tools=tools, internet=internet)
                s.add(Agent(id=aid, organization_id=org["id"], name=name, role=role, department=dept, is_coordinator=coord, config=cfg))
    return True
