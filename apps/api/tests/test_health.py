def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_organizacoes_iniciais(client):
    orgs = client.get("/api/v1/organizations").json()
    names = {o["name"] for o in orgs}
    assert {"Laboratório de Pesquisa em IA", "Escritório Empresarial"} <= names
    agents = client.get("/api/v1/agents", params={"organizationId": "org-pesquisa-ia"}).json()
    assert len(agents) == 6 and sum(a["isCoordinator"] for a in agents) == 1
    assert all("xp" not in a and "level" not in a for a in agents)


def test_cabecalho_http_das_ferramentas_e_ascii():
    from app.services.tools import UA

    UA["User-Agent"].encode("ascii")  # regressão: acento no User-Agent quebrava as buscas reais
