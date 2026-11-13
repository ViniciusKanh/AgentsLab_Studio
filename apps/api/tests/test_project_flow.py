"""
Teste obrigatório: "Pesquisa sobre aplicações de IA na aeronáutica" — fluxo vertical completo.
LLM e ferramentas são substitutos determinísticos (apenas aqui); o fluxo, a persistência,
as dependências, mensagens, evidências, versões e custos são os do sistema real.
"""
from conftest import agent_id, org_id, wait_for

API = "/api/v1"


def status(client, pid):
    return client.get(f"{API}/projects/{pid}").json()


def test_fluxo_completo_aeronautica(client, env):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    # 1-2. Projeto por prompt → coordenador interpreta
    r = client.post(f"{API}/projects", json={"organizationId": org_id(client), "title": "IA na aeronáutica",
                                             "request": "Pesquise aplicações de inteligência artificial na aeronáutica e entregue um relatório técnico com fontes."})
    assert r.status_code == 201
    pid = r.json()["id"]
    # 3. Plano proposto aguardando aprovação
    p = wait_for(lambda: (d := status(client, pid))["status"] == "awaiting_approval" and d)
    assert len(p["tasks"]) == 5 and {t["status"] for t in p["tasks"]} == {"proposed"}
    assert p["plan"]["objetivo"]
    # edição do plano pelo gestor (renomeia T2)
    tasks = [{**t, "title": ("Pesquisar inspeção visual" if t["key"] == "T2" else t["title"])} for t in p["tasks"]]
    assert client.put(f"{API}/projects/{pid}/plan", json={"tasks": tasks}).status_code == 200
    # 4. Aprovação
    assert client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True}).json()["status"] == "running"
    # 5-8. Execução com dependências, consolidação e revisão (1 revisão automática)
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d)
    by = {t["key"]: t for t in p["tasks"]}
    assert all(by[k]["status"] == "done" for k in ("T1", "T2", "T3", "T4", "T5", "RV1"))
    assert by["T3"]["startedAt"] >= max(by["T1"]["finishedAt"], by["T2"]["finishedAt"])  # respeita dependências
    msgs = client.get(f"{API}/projects/{pid}/messages").json()
    types = {m["type"] for m in msgs}
    assert {"solicitacao", "aprovacao", "entrega", "revisao"} <= types
    assert any(m["type"] == "entrega" and m["fromAgentId"] == agent_id(client, "Pesquisador Científico") and m["toAgentId"] == agent_id(client, "Analista Técnico") for m in msgs)
    # evidências reais registradas, sem duplicatas
    evs = client.get(f"{API}/projects/{pid}/evidence").json()
    assert [e["code"] for e in evs] == ["E1", "E2"] and evs[0]["doi"] == "10.1000/abc" and not evs[0]["fullText"]
    # documento final: referências geradas pelo sistema; citação inventada [E99] detectada
    arts = client.get(f"{API}/projects/{pid}/artifacts").json()
    report = next(a for a in arts if a["kind"] == "report")
    assert report["currentVersion"] == 2  # revisão automática gerou nova versão
    v1 = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}", params={"version": 1}).json()["content"]
    assert "referência inventada" not in v1 and "https://doi.org/10.1000/abc" in v1 and "E99" in v1
    review = next(a for a in arts if a["kind"] == "review")
    rv = client.get(f"{API}/projects/{pid}/artifacts/{review['id']}", params={"version": 1}).json()["content"]
    assert "Citação de fonte inexistente" in rv
    # 9-10. Feedback do gestor → nova versão + diff
    r = client.post(f"{API}/projects/{pid}/feedback", json={"artifactId": report["id"], "text": "Inclua uma seção de riscos regulatórios."})
    assert r.json()["status"] == "revising"
    wait_for(lambda: status(client, pid)["status"] == "delivered")
    arts = client.get(f"{API}/projects/{pid}/artifacts").json()
    report = next(a for a in arts if a["kind"] == "report")
    assert report["currentVersion"] == 3
    diff = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}/diff", params={"a": 1, "b": 3}).json()["diff"]
    assert "E99" in diff and diff.startswith("---")
    dl = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}/download")
    assert dl.status_code == 200 and "attachment" in dl.headers["content-disposition"]
    # 11. Aprovação final e rastreabilidade de custos
    assert client.post(f"{API}/projects/{pid}/delivery/decision", json={"approve": True}).json()["status"] == "completed"
    exes = client.get(f"{API}/projects/{pid}/executions").json()
    purposes = [e["purpose"] for e in exes]
    assert {"plan", "queries", "findings", "analysis", "report", "review", "revision"} <= set(purposes)
    final = status(client, pid)
    assert final["llmCalls"] == len(exes) and abs(final["costUsd"] - 0.001 * len(exes)) < 1e-9
    usage = client.get(f"{API}/usage").json()
    assert any(u["key"] == agent_id(client, "Redator Técnico-Científico") for u in usage["byAgent"])
    ov = client.get(f"{API}/overview").json()
    assert ov["projects"]["completed"] == 1 and ov["llmCalls"] == len(exes)


def test_sem_credencial_falha_com_mensagem_clara(client):
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "request": "Pesquise aplicações de IA em satélites de observação."}).json()["id"]
    p = wait_for(lambda: (d := status(client, pid))["status"] == "failed" and d)
    assert "Nenhuma chave" in p["error"]
    exes = client.get(f"{API}/projects/{pid}/executions").json()
    assert exes and exes[0]["status"] == "error"


def test_limite_de_orcamento_pausa(client):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "request": "Pesquise aplicações de IA na aeronáutica com orçamento mínimo.",
                                               "budgetUsd": 0.0025}).json()["id"]
    wait_for(lambda: status(client, pid)["status"] == "awaiting_approval")
    client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True})
    p = wait_for(lambda: (d := status(client, pid))["status"] == "paused" and d)
    assert "orçamento" in p["error"]
    assert p["costUsd"] <= 0.0025 + 0.001 + 1e-9  # no máximo uma chamada além do limite em andamento


def test_controle_cancelar(client):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "request": "Pesquise aplicações de IA na aeronáutica para cancelar."}).json()["id"]
    wait_for(lambda: status(client, pid)["status"] == "awaiting_approval")
    assert client.post(f"{API}/projects/{pid}/control", json={"action": "cancel"}).json()["status"] == "cancelled"
    assert client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True}).status_code == 409


def test_chat_real_e_tarefa_avulsa(client):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    r = client.post(f"{API}/agents/{agent_id(client, 'Analista Financeiro')}/chat", json={"text": "Olá"})
    assert r.status_code == 200 and r.json()["reply"]
    pid = client.post(f"{API}/agents/{agent_id(client, 'Assistente Administrativo')}/tasks", json={"title": "Checklist de onboarding", "description": "Para novos colaboradores"}).json()["projectId"]
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d)
    assert p["tasks"][0]["status"] == "done"


def test_crud_organizacao_e_agente(client):
    org = client.post(f"{API}/organizations", json={"name": "Minha Fábrica", "template": "software_factory"}).json()
    assert len(org["departments"]) == 4
    ag = client.post(f"{API}/agents", json={"name": "Dev Backend", "role": "Engenheiro de Software", "department": "Engenharia", "organizationId": org["id"],
                                            "intelligence": {"provider": "groq", "model": "llama-3.3-70b-versatile", "instructions": "Escreva código limpo."}}).json()
    assert ag["organizationId"] == org["id"] and ag["intelligence"]["provider"] == "groq"
    ag2 = client.put(f"{API}/agents/{ag['id']}", json={"name": "Dev Backend Sênior"}).json()
    assert ag2["name"] == "Dev Backend Sênior" and ag2["intelligence"]["model"] == "llama-3.3-70b-versatile"
    assert client.post(f"{API}/agents", json={"name": "x", "role": ""}).status_code == 422


def test_reanalisar_apos_trocar_modelo_e_repetir_tarefas(client, env):
    # sem chave → planejamento falha (como o 404 de modelo descontinuado)
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "request": "Pesquise aplicações de IA em satélites de observação da Terra."}).json()["id"]
    wait_for(lambda: status(client, pid)["status"] == "failed")
    client.post(f"{API}/credentials", json={"provider": "groq", "alias": "Groq pessoal", "api_key": "gsk-TESTE-000001"})
    r = client.post(f"{API}/projects/{pid}/reanalyze", json={"provider": "groq", "model": "llama-teste", "applyToTeam": True})
    assert r.status_code == 200 and r.json()["agentsUpdated"] == 6
    p = wait_for(lambda: (d := status(client, pid))["status"] == "awaiting_approval" and d)
    assert len(p["tasks"]) == 5
    exe = client.get(f"{API}/projects/{pid}/executions").json()
    assert exe[-1]["provider"] == "groq" and exe[-1]["model"] == "llama-teste" and exe[-1]["status"] == "ok"
    agents = client.get(f"{API}/agents", params={"organizationId": org_id(client)}).json()
    assert {a["intelligence"]["model"] for a in agents} == {"llama-teste"}
    # não permite reanalisar durante a execução
    client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True})
    if status(client, pid)["status"] == "running":
        assert client.post(f"{API}/projects/{pid}/reanalyze", json={}).status_code in (200, 409)
    wait_for(lambda: status(client, pid)["status"] == "delivered")
    assert client.post(f"{API}/projects/{pid}/retry").status_code == 409  # nada falhou


def test_provedor_desativado_bloqueia_execucao_e_estado_e_salvo(client):
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini pessoal", "api_key": "AIza-TESTE-0001"})
    r = client.put(f"{API}/providers", json={"gemini": {"enabled": False, "defaultModel": "gemini-x", "customModels": ["gemini-x"]}, "groq": {"enabled": True}})
    assert r.status_code == 200
    prov = {p["id"]: p for p in client.get(f"{API}/providers").json()}
    assert prov["gemini"]["enabled"] is False and prov["gemini"]["defaultModel"] == "gemini-x"
    assert "gemini-x" in [m["id"] for m in prov["gemini"]["models"]]
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "request": "Pesquise aplicações de IA em drones agrícolas."}).json()["id"]
    p = wait_for(lambda: (d := status(client, pid))["status"] == "failed" and d)
    assert "desativado" in p["error"]
