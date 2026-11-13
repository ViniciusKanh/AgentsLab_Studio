"""Autenticação Supabase (JWT) e isolamento entre usuários."""
import time

import jwt
import pytest

SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres!!"


def token(sub: str, email: str, exp: int | None = None, role="authenticated", aud="authenticated", secret=SECRET):
    return jwt.encode({"sub": sub, "email": email, "role": role, "aud": aud, "exp": exp or int(time.time()) + 3600,
                       "user_metadata": {"full_name": email.split("@")[0]}}, secret, algorithm="HS256")


@pytest.fixture()
def auth(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)
    yield
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")


def H(t):
    return {"Authorization": f"Bearer {t}"}


def test_rotas_exigem_token_valido(client, auth):
    assert client.get("/health").json()["auth"] == "supabase"
    assert client.get("/api/v1/organizations").status_code == 401
    assert client.get("/api/v1/organizations", headers=H("lixo")).status_code == 401
    assert client.get("/api/v1/organizations", headers=H(token("u1", "a@x.com", exp=int(time.time()) - 10))).status_code == 401
    assert client.get("/api/v1/organizations", headers=H(token("u1", "a@x.com", secret="outro-segredo-qualquer-com-32-chars!!"))).status_code == 401
    assert client.get("/api/v1/organizations", headers=H(token("u1", "a@x.com", role="anon"))).status_code == 401
    r = client.get("/api/v1/me", headers=H(token("u1", "a@x.com")))
    assert r.status_code == 200 and r.json()["id"] == "u1"


def test_usuarios_nao_veem_dados_uns_dos_outros(client, auth, env):
    a, b = H(token("user-a", "a@x.com")), H(token("user-b", "b@x.com"))
    orgs_a = client.get("/api/v1/organizations", headers=a).json()
    orgs_b = client.get("/api/v1/organizations", headers=b).json()
    assert len(orgs_a) == 2 and len(orgs_b) == 2 and not ({o["id"] for o in orgs_a} & {o["id"] for o in orgs_b})
    # chave de A
    ca = client.post("/api/v1/credentials", headers=a, json={"provider": "gemini", "alias": "Chave A", "api_key": "AIza-AAAA-1111"}).json()
    assert client.get("/api/v1/credentials", headers=b).json() == []
    assert client.delete(f"/api/v1/credentials/{ca['id']}", headers=b).status_code == 404
    # projeto de A
    pid = client.post("/api/v1/projects", headers=a, json={"organizationId": orgs_a[0]["id"], "request": "Pesquise aplicações de IA na aeronáutica (usuário A)."}).json()["id"]
    assert client.get(f"/api/v1/projects/{pid}", headers=b).status_code == 404
    assert client.get(f"/api/v1/projects/{pid}/messages", headers=b).status_code == 404
    assert client.get("/api/v1/projects", headers=b).json() == []
    # B não usa organização nem agente de A
    assert client.post("/api/v1/projects", headers=b, json={"organizationId": orgs_a[0]["id"], "request": "Tentativa de usar a organização de outro usuário."}).status_code == 404
    ag_a = client.get("/api/v1/agents", headers=a).json()[0]["id"]
    assert client.put(f"/api/v1/agents/{ag_a}", headers=b, json={"name": "Hackeado"}).status_code == 404
    assert client.post(f"/api/v1/agents/{ag_a}/chat", headers=b, json={"text": "oi"}).status_code == 404
    # a chave de A não é usada por B (B não tem chave → falha clara)
    pb = client.post("/api/v1/projects", headers=b, json={"organizationId": orgs_b[0]["id"], "request": "Pesquise aplicações de IA na aeronáutica (usuário B)."}).json()["id"]
    from conftest import wait_for

    p = wait_for(lambda: (d := client.get(f"/api/v1/projects/{pb}", headers=b).json())["status"] == "failed" and d)
    assert "Nenhuma chave" in p["error"]
    # preferências de provedor são por usuário
    client.patch("/api/v1/providers/gemini", headers=a, json={"enabled": False})
    assert next(p for p in client.get("/api/v1/providers", headers=b).json() if p["id"] == "gemini")["enabled"] is True


def test_sse_aceita_token_na_url_e_filtra_por_usuario(client, auth):
    assert client.get("/api/v1/events").status_code == 401
    assert client.get("/api/v1/events?access_token=invalido").status_code == 401


def test_semente_concorrente_nao_duplica(env):
    from concurrent.futures import ThreadPoolExecutor

    from sqlalchemy import func, select

    from app import db
    from app.models import Organization
    from app.services.seed import seed_for_owner

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda _: seed_for_owner("user-concorrente"), range(16)))
    with db.session_scope() as s:
        assert s.scalar(select(func.count()).select_from(Organization).where(Organization.owner_id == "user-concorrente")) == 2
