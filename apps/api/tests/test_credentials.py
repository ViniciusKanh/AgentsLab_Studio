def test_multiplas_chaves_por_provedor_sem_expor_segredo(client, env):
    r1 = client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "Gemini · chave 1", "api_key": "AIza-SECRETA-1111"})
    r2 = client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "Gemini · chave 2", "api_key": "AIza-SECRETA-2222"})
    assert r1.status_code == 201 and r2.status_code == 201
    body = client.get("/api/v1/credentials").json()
    assert [c["last4"] for c in body] == ["1111", "2222"]
    assert [c["isDefault"] for c in body] == [True, False]
    assert "SECRETA" not in str(body)
    assert env["store"].get(r1.json()["id"]) == "AIza-SECRETA-1111"
    client.post(f"/api/v1/credentials/{r2.json()['id']}/default")
    assert [c["isDefault"] for c in client.get("/api/v1/credentials").json()] == [False, True]
    assert client.delete(f"/api/v1/credentials/{r1.json()['id']}").status_code == 204
    assert env["store"].get(r1.json()["id"]) is None


def test_valida_entrada(client):
    assert client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "x", "api_key": "123"}).status_code == 422
    assert client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "chave boa", "api_key": "123"}).status_code == 422


def test_resolve_chave_por_agente(env):
    from app import db
    from app.services.vault import CredentialService

    with db.session_scope() as s:
        svc = CredentialService(s, env["store"])
        a = svc.create("groq", "Groq A", "gsk-aaaaaaaa1")
        b = svc.create("groq", "Groq B", "gsk-bbbbbbbb2")
        assert svc.resolve("groq", b["id"]) == "gsk-bbbbbbbb2"
        assert svc.resolve("groq", None) == "gsk-aaaaaaaa1"
        assert a["isDefault"]
