"""
Entrega acadêmica: engenharia do pedido leigo (briefing), tipo de entrega, estimativa de tempo,
redação seção por seção, reavaliação entre agentes e equipe acadêmica do documento de configuração.
LLM e ferramentas são substitutos determinísticos (somente nos testes).
"""
from conftest import org_id, wait_for

API = "/api/v1"


def _status(client, pid):
    return client.get(f"{API}/projects/{pid}").json()


def test_pedido_leigo_vira_briefing_com_tempo_e_documento_extenso(client, env):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    r = client.post(f"{API}/projects", json={"organizationId": org_id(client), "deliverableType": "monografia", "length": "extensa",
                                             "request": "quero entender como a IA ajuda na manutenção de avião"})
    assert r.status_code == 201
    pid = r.json()["id"]
    p = wait_for(lambda: (d := _status(client, pid))["status"] == "awaiting_approval" and d)
    plan = p["plan"]
    b = plan["briefing"]
    assert b["tipo_entrega"] == "monografia" and b["tipo_nome"] == "Monografia" and b["pergunta_pesquisa"]
    assert p["title"] == "Inteligência Artificial na aeronáutica"  # título gerado pelo briefing (gestor não informou)
    assert len(plan["estrutura"]) == 3 and all(350 <= s["palavras"] <= 2500 for s in plan["estrutura"])
    assert plan["estimativa_tempo_min"]["e_estimativa"] and plan["estimativa_tempo_min"]["max"] > plan["estimativa_tempo_min"]["min"] >= 1
    assert {x["tarefa"] for x in plan["papeis"]} == {t["key"] for t in p["tasks"]}
    assert client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True}).status_code == 200
    p = wait_for(lambda: (d := _status(client, pid))["status"] == "delivered" and d)
    # uma chamada de redação por seção + resumo
    report_calls = [c for c in env["llm"].calls if c[0] == "report"]
    assert len(report_calls) == 3 and any(c[0] == "abstract" for c in env["llm"].calls)
    report = next(a for a in client.get(f"{API}/projects/{pid}/artifacts").json() if a["kind"] == "report")
    v1 = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}", params={"version": 1}).json()["content"]
    for part in ("## Resumo", "## Sumário", "## 1. Introdução", "## 2. Manutenção preditiva", "## 3. Conclusão", "## Referências", "Palavras-chave"):
        assert part in v1
    assert v1.count("## Referências") == 1  # referências do modelo descartadas; só as do sistema
    # reavaliação: revisão por seção removeu a citação inexistente sem perder seções
    v2 = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}", params={"version": 2}).json()["content"]
    assert "[E99]" not in v2 and v2.count("## ") >= v1.count("## ") - 0
    parecer = next(a for a in client.get(f"{API}/projects/{pid}/artifacts").json() if a["kind"] == "review")
    assert parecer["currentVersion"] >= 1


def test_tipos_de_entrega_e_validacao(client):
    types = client.get(f"{API}/projects/deliverable-types").json()["types"]
    assert {t["id"] for t in types} >= {"pesquisa", "monografia", "tese", "estudo_de_caso"}
    bad = client.post(f"{API}/projects", json={"request": "quero um estudo qualquer sobre IA", "deliverableType": "romance"})
    assert bad.status_code == 422


def test_equipe_academica_e_provedores(client):
    agents = {a["name"]: a for a in client.get(f"{API}/agents").json()}
    for n in ("Especialista em Revisão da Literatura", "Especialista em Fundamentação Teórica", "Especialista em Metodologia Científica"):
        assert n in agents and not agents[n]["isCoordinator"]
    red = agents["Redatora Técnico-Científica"]
    assert red["role"] == "Especialista em Redação Acadêmica e Documentação Científica"
    assert "REDATORA TÉCNICO-CIENTÍFICA" in red["intelligence"]["instructions"] and red["intelligence"]["temperature"] == 0.4
    assert red["rules"]["autonomy"] == "supervised" and red["rules"]["requireHumanReview"] and not red["rules"]["allowDelegation"]
    assert sum(a["isCoordinator"] for a in agents.values() if a["organizationId"] == red["organizationId"]) == 1
    ids = {p["id"] for p in client.get(f"{API}/providers").json()}
    assert ids == {"gemini", "groq", "openai"}
    assert client.post(f"{API}/credentials", json={"provider": "ollama", "alias": "local", "api_key": "x"}).status_code == 422


def test_atualizacao_unica_da_equipe_existente(env):
    """Organização criada antes do documento: edita os 4 agentes (mesmo id) e cria os 3 novos, uma única vez."""
    from sqlalchemy import delete, select

    from app.db import session_scope
    from app.models import Agent, KeyValue, Organization
    from app.services.academic_agents import ACADEMIC_VERSION
    from app.services.seed import upgrade_research_team

    with session_scope() as s:
        org = s.scalars(select(Organization).where(Organization.owner_id == "local", Organization.template == "research_lab")).first()
        s.execute(delete(Agent).where(Agent.organization_id == org.id, Agent.name.like("Especialista em%")))
        red = s.scalars(select(Agent).where(Agent.organization_id == org.id, Agent.name == "Redatora Técnico-Científica")).first()
        red.role, red.config = "Redator Técnico-Científico", {**red.config, "intelligence": {**red.config["intelligence"], "instructions": "antiga"}}
        red_id = red.id
        s.execute(delete(KeyValue).where(KeyValue.key == f"{ACADEMIC_VERSION}:local"))
    assert upgrade_research_team("local") == 7
    assert upgrade_research_team("local") == 0  # idempotente
    with session_scope() as s:
        red = s.get(Agent, red_id)
        assert red.role.startswith("Especialista em Redação") and "REDATORA" in red.config["intelligence"]["instructions"]
        assert s.scalars(select(Agent).where(Agent.name == "Especialista em Metodologia Científica")).first() is not None
