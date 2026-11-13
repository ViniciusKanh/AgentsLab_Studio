"""
Execução multiagente real — caso de validação "IA na aeronáutica".

LLM e ferramentas de busca são substitutos determinísticos (somente nos testes); orquestração,
paralelismo, dependências, contexto, verificação de referências, ferramentas registradas,
feedback com propagação, retentativas, tempo limite e cancelamento são o código real do sistema.
"""
import time

from conftest import agent_id, org_id, wait_for
from fakes import FakeLLM, FakeTools

from app.config import settings
from app.services import llm as llm_mod, tools as tools_mod
from app.services.tools import Source

API = "/api/v1"
REQUEST = ("Pesquise aplicações de inteligência artificial na aeronáutica: T1 revisão de literatura com fontes, "
           "T2 investigação técnica de modelos e datasets, T3 análise comparativa, T4 relatório estruturado e T5 revisão.")


class TopicLLM(FakeLLM):
    """Gera a consulta a partir do título da tarefa (cada pesquisa encontra fontes diferentes)."""

    async def complete(self, **kw):
        r = await super().complete(**kw)
        if kw.get("purpose") == "queries":
            prompt = kw["messages"][-1]["content"]
            topic = "inspection" if "inspe" in prompt.lower() else "maintenance"
            r.text = '{"consultas": ["aircraft %s machine learning"], "ano_minimo": 2019}' % topic
        return r


class TopicTools(FakeTools):
    async def search(self, query, limit=5, from_year=None):
        self.searches.append(query)
        t = "inspection" if "inspection" in query else "maintenance"
        return [Source("openalex", f"Deep learning for aircraft {t} A", ["A. Silva"], 2021, f"10.1000/{t}-a", f"https://doi.org/10.1000/{t}-a", f"{t} A"),
                Source("arxiv", f"Neural approaches to aircraft {t} B", ["B. Souza"], 2022, "", f"https://arxiv.org/abs/2201.0000{len(t)}", f"{t} B"),
                Source("openalex", f"Benchmark datasets for aircraft {t} C", ["C. Lima"], 2023, f"10.1000/{t}-c", f"https://doi.org/10.1000/{t}-c", f"{t} C")]


def status(client, pid):
    return client.get(f"{API}/projects/{pid}").json()


def start(client, env, llm=None, tools=None, approve=True):
    if llm is not None:
        llm_mod.set_gateway(llm)
        env["llm"] = llm
    if tools is not None:
        tools_mod.set_tools(tools)
    client.post(f"{API}/credentials", json={"provider": "gemini", "alias": "Gemini", "api_key": "AIza-TESTE-0002"})
    pid = client.post(f"{API}/projects", json={"organizationId": org_id(client), "title": "IA na aeronáutica", "request": REQUEST}).json()["id"]
    wait_for(lambda: status(client, pid)["status"] == "awaiting_approval")
    if approve:
        assert client.post(f"{API}/projects/{pid}/plan/decision", json={"approve": True}).json()["status"] == "running"
    return pid


def overlap(a, b):
    return a[1] < b[2] and b[1] < a[2]


def test_execucao_paralela_contexto_minimo_e_verificacao(client, env):
    llm, tools = TopicLLM(delay=0.15), TopicTools()
    pid = start(client, env, llm, tools)
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d, timeout=30)
    by = {t["key"]: t for t in p["tasks"]}

    # plano aprovado persistido (registro imutável)
    assert [t["key"] for t in p["plan"]["plano_aprovado"]["tarefas"]] == ["T1", "T2", "T3", "T4", "T5"]
    # T1 e T2 são independentes → executadas em paralelo; T3 só depois das duas
    findings = [s for s in llm.spans if s[0] == "findings"]
    assert len(findings) == 2 and overlap(findings[0], findings[1])
    assert llm.max_active >= 2
    assert by["T3"]["startedAt"] >= max(by["T1"]["finishedAt"], by["T2"]["finishedAt"])
    assert by["T4"]["startedAt"] >= by["T3"]["finishedAt"] and by["T5"]["startedAt"] >= by["T4"]["finishedAt"]

    evs = client.get(f"{API}/projects/{pid}/evidence").json()
    assert len(evs) == 6
    code_by_title = {e["title"]: e["code"] for e in evs}
    # verificação independente: com DOI → verificada; arXiv sem confirmação → não confirmada
    assert {e["verification"] for e in evs if "doi.org" in e["url"]} == {"verificada"}
    assert {e["verification"] for e in evs if "arxiv" in e["url"]} == {"nao_confirmada"}

    # contexto mínimo: T3 recebe só as evidências de T1+T2; T4 só as citadas na análise; T5 só as citadas no relatório
    assert sorted(by["T3"]["context"]["evidence"]) == sorted(code_by_title.values())
    assert [i["fromTask"] for i in by["T3"]["context"]["inputs"]] == ["T1", "T2"]
    assert sorted(by["T4"]["context"]["evidence"]) == ["E1", "E2"]
    assert by["T4"]["context"]["inputs"][0]["fromTask"] == "T3"
    report_prompt = next(c for purpose, c in llm.calls if purpose == "report")
    assert '<fonte codigo="E1">' in report_prompt and '<fonte codigo="E5">' not in report_prompt
    assert sorted(by["T5"]["context"]["evidence"]) == ["E1", "E2"]

    # ferramentas usadas registradas (busca + verificação), por agente e tarefa
    calls = client.get(f"{API}/projects/{pid}/tool-calls").json()
    assert sum(c["tool"] == "literature_search" for c in calls) == 2
    assert sum(c["tool"] == "reference_verify" for c in calls) == 6
    assert {c["taskId"] for c in calls} == {by["T1"]["id"], by["T2"]["id"]}

    # documentos identificados: código, autoria, versão, data, projeto e tarefa de origem
    arts = client.get(f"{API}/projects/{pid}/artifacts").json()
    report = next(a for a in arts if a["kind"] == "report")
    assert report["code"].startswith("D") and report["metadata"]["author"] not in ("", "—") and report["metadata"]["version"] == report["currentVersion"]
    assert report["metadata"]["originTask"].startswith("T4") and report["metadata"]["project"] == "IA na aeronáutica"
    content = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}").json()["content"]
    assert "referência verificada" in content or "NÃO CONFIRMADA" in content
    dl = client.get(f"{API}/projects/{pid}/artifacts/{report['id']}/download").text
    assert dl.startswith("---\ndocumento: D") and "tarefa_de_origem: T4" in dl

    # coordenador sinalizou decisão humana (entrega pronta) e a mensagem é resolvida ao decidir
    msgs = client.get(f"{API}/projects/{pid}/messages").json()
    assert any(m["needsDecision"] and m["status"] == "pending" and "Entrega pronta" in m["content"] for m in msgs)
    client.post(f"{API}/projects/{pid}/delivery/decision", json={"approve": True})
    msgs = client.get(f"{API}/projects/{pid}/messages").json()
    assert not any(m["needsDecision"] and m["status"] == "pending" for m in msgs)

    # painel do agente: tarefas, documentos, ferramentas e custos reais
    act = client.get(f"{API}/agents/{agent_id(client, 'Pesquisador Científico')}/activity").json()
    assert act["history"][0]["key"] in ("T1", "T2") and act["toolCalls"] and act["totals"]["tokens"] > 0
    assert act["artifacts"][0]["code"].startswith("D")


def test_feedback_em_tarefa_propaga_para_dependentes(client, env):
    pid = start(client, env, TopicLLM(), TopicTools())
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d, timeout=30)
    by = {t["key"]: t for t in p["tasks"]}
    arts = {a["id"]: a for a in client.get(f"{API}/projects/{pid}/artifacts").json()}
    analysis_id, report_id = by["T3"]["resultArtifactId"], by["T4"]["resultArtifactId"]
    report_v = arts[report_id]["currentVersion"]

    r = client.post(f"{API}/projects/{pid}/feedback", json={"taskId": by["T3"]["id"], "text": "Inclua métricas de precisão por dataset na comparação."})
    assert r.status_code == 200
    routed = r.json()["feedback"]
    assert routed["tasks"] == ["FB1", "UP1", "RR1"] and routed["agentId"] == agent_id(client, "Analista Técnico")
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d, timeout=30)
    by = {t["key"]: t for t in p["tasks"]}
    assert by["FB1"]["agentId"] == agent_id(client, "Analista Técnico") and by["FB1"]["targetArtifactId"] == analysis_id
    assert by["UP1"]["agentId"] == agent_id(client, "Redator Técnico-Científico") and by["UP1"]["dependsOn"] == ["FB1"]
    assert by["UP1"]["startedAt"] >= by["FB1"]["finishedAt"] and by["RR1"]["startedAt"] >= by["UP1"]["finishedAt"]
    assert by["RR1"]["kind"] == "review" and by["RR1"]["status"] == "done"
    arts = {a["id"]: a for a in client.get(f"{API}/projects/{pid}/artifacts").json()}
    assert arts[analysis_id]["currentVersion"] == 2 and arts[report_id]["currentVersion"] == report_v + 1
    assert [v["version"] for v in arts[analysis_id]["versions"]] == [1, 2]  # versões anteriores preservadas
    diff = client.get(f"{API}/projects/{pid}/artifacts/{analysis_id}/diff", params={"a": 1, "b": 2}).json()["diff"]
    assert diff.startswith("---")
    # o redator recebeu a nova versão da análise como entrada
    assert by["UP1"]["context"]["inputs"][0]["artifactId"] == analysis_id and by["UP1"]["context"]["inputs"][0]["version"] == 2
    msgs = client.get(f"{API}/projects/{pid}/messages").json()
    assert any(m["type"] == "feedback" and m["taskId"] == by["T3"]["id"] for m in msgs)
    assert any(m["type"] == "delegacao" and "UP1" in m["content"] for m in msgs)


def test_retentativa_em_erro_transitorio(client, env, monkeypatch):
    monkeypatch.setattr(settings, "llm_retry_base_sec", 0.01)
    pid = start(client, env, FakeLLM(transient_failures=1), approve=False)
    exes = client.get(f"{API}/projects/{pid}/executions").json()
    assert [e["status"] for e in exes][:2] == ["retry", "ok"] and "429" in exes[0]["error"]


def test_tempo_limite_falha_isolada_e_feedback_reabre_tarefa(client, env, monkeypatch):
    monkeypatch.setattr(settings, "task_timeout_sec", 1)
    llm = TopicLLM(slow={"analysis": 3})
    pid = start(client, env, llm, TopicTools())
    p = wait_for(lambda: (d := status(client, pid))["status"] == "failed" and d, timeout=30)
    by = {t["key"]: t for t in p["tasks"]}
    assert by["T1"]["status"] == by["T2"]["status"] == "done"
    assert by["T3"]["status"] == "failed" and "Tempo limite" in by["T3"]["error"]
    assert by["T4"]["status"] == by["T5"]["status"] == "cancelled"
    msgs = client.get(f"{API}/projects/{pid}/messages").json()
    assert any(m["needsDecision"] and "T3" in m["content"] for m in msgs)
    # gestor dá feedback na TAREFA com falha → reabre T3 (e as dependentes) sem refazer T1/T2
    monkeypatch.setattr(settings, "task_timeout_sec", 900)
    llm.slow = {}
    r = client.post(f"{API}/projects/{pid}/feedback", json={"taskId": by["T3"]["id"], "text": "Seja mais objetivo na comparação."})
    assert r.json()["feedback"]["tasks"] == ["T3", "T4", "T5"]
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d, timeout=30)
    by2 = {t["key"]: t for t in p["tasks"]}
    assert by2["T1"]["finishedAt"] == by["T1"]["finishedAt"]  # trabalho concluído preservado
    assert by2["T3"]["attempts"] == 2 and "Seja mais objetivo" in by2["T3"]["description"]


def test_cancelamento_imediato_preserva_historico(client, env):
    llm = TopicLLM(slow={"findings": 10})
    pid = start(client, env, llm, TopicTools())
    wait_for(lambda: any(c[0] == "findings" for c in llm.calls), timeout=10)
    t0 = time.time()
    assert client.post(f"{API}/projects/{pid}/control", json={"action": "cancel"}).json()["status"] == "cancelled"
    p = wait_for(lambda: (d := status(client, pid)) and all(t["status"] != "running" for t in d["tasks"]) and d, timeout=5)
    assert time.time() - t0 < 3  # não esperou a chamada de 10 s terminar
    by = {t["key"]: t for t in p["tasks"]}
    assert by["T1"]["status"] == "cancelled" and "Cancelada pelo gestor" in by["T1"]["error"]
    assert client.get(f"{API}/projects/{pid}/tool-calls").json()  # buscas já feitas continuam registradas
    assert client.get(f"{API}/projects/{pid}/evidence").json()


def test_pausa_e_retomada(client, env):
    llm = TopicLLM(delay=0.3)
    pid = start(client, env, llm, TopicTools())
    wait_for(lambda: any(t["status"] == "running" for t in status(client, pid)["tasks"]))
    assert client.post(f"{API}/projects/{pid}/control", json={"action": "pause"}).json()["status"] == "paused"
    wait_for(lambda: all(t["status"] != "running" for t in status(client, pid)["tasks"]), timeout=10)
    assert status(client, pid)["status"] == "paused"
    assert client.post(f"{API}/projects/{pid}/control", json={"action": "resume"}).json()["status"] == "running"
    p = wait_for(lambda: (d := status(client, pid))["status"] == "delivered" and d, timeout=30)
    assert all(t["status"] == "done" for t in p["tasks"] if t["key"].startswith("T"))


def test_isolamento_de_atividade_entre_usuarios(client, env):
    # sem autenticação, o modo local é de usuário único; rotas inexistentes/alheias retornam 404
    assert client.get(f"{API}/projects/proj_inexistente/tool-calls").status_code == 404
    assert client.get(f"{API}/agents/agent_inexistente/activity").status_code == 404
