from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.main import app
from app.routers import credentials as cred_router
from app.services.vault import CredentialVault


def make_client(tmp_path):
    vault = CredentialVault(tmp_path / "t.db", Fernet.generate_key().decode())
    app.dependency_overrides[cred_router.vault_dependency] = lambda: vault
    return TestClient(app), vault


def test_multiplas_chaves_por_provedor_sem_expor_segredo(tmp_path):
    client, vault = make_client(tmp_path)
    r1 = client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "Gemini · chave 1", "api_key": "AIza-SECRETA-1111"})
    r2 = client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "Gemini · chave 2", "api_key": "AIza-SECRETA-2222"})
    assert r1.status_code == 201 and r2.status_code == 201
    body = client.get("/api/v1/credentials").json()
    assert [c["last4"] for c in body] == ["1111", "2222"]
    assert "SECRETA" not in str(body)
    assert vault.reveal(r1.json()["id"]) == "AIza-SECRETA-1111"
    assert client.delete(f"/api/v1/credentials/{r1.json()['id']}").status_code == 204


def test_valida_entrada(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "x", "api_key": "123"}).status_code == 422
