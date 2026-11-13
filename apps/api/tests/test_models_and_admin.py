"""Modelos que funcionam (Gemini testado de verdade), banco obrigatório e conta principal."""
import asyncio
import json
import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


def gemini_transport():
    """Simula a API do Google: lista inclui modelo descontinuado (404), com cota esgotada (429) e não-texto."""
    listed = [
        {"name": "models/gemini-2.5-pro", "displayName": "Gemini 2.5 Pro", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-3.1-pro-preview", "displayName": "Gemini 3.1 Pro Preview", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-3-flash", "displayName": "Gemini 3 Flash", "supportedGenerationMethods": ["generateContent"], "inputTokenLimit": 1048576},
        {"name": "models/gemini-3-flash-lite", "displayName": "Gemini 3 Flash Lite", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/text-embedding-004", "displayName": "Embedding", "supportedGenerationMethods": ["embedContent"]},
        {"name": "models/gemini-3-flash-image", "displayName": "Imagem", "supportedGenerationMethods": ["generateContent"]},
    ]

    def handler(req: httpx.Request):
        assert req.url.params.get("key") == "AIza-teste"
        if req.method == "GET":
            return httpx.Response(200, json={"models": listed})
        mid = req.url.path.split("/models/")[1].split(":")[0]
        if mid == "gemini-2.5-pro":
            return httpx.Response(404, json={"error": {"code": 404, "message": "This model models/gemini-2.5-pro is no longer available to new users.", "status": "NOT_FOUND"}})
        if mid == "gemini-3-flash-lite":
            return httpx.Response(429, json={"error": {"code": 429, "message": "quota"}})
        assert "image" not in mid  # não-texto nem é testado
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})

    return httpx.MockTransport(handler)


def test_lista_gemini_so_com_modelos_que_funcionam():
    from app.services.providers import list_remote_models

    models, dropped = asyncio.run(list_remote_models("gemini", "AIza-teste", transport=gemini_transport()))
    ids = [m["id"] for m in models]
    assert ids == ["gemini-3-flash", "gemini-3-flash-lite", "gemini-3.1-pro-preview"]  # flash estável primeiro
    assert dropped == ["gemini-2.5-pro"]
    assert models[1]["tags"] == ["cota esgotada no teste"]


def test_atualizar_lista_corrige_padrao_e_agentes(client, monkeypatch):
    from app.services import providers

    real = providers.list_remote_models

    async def fake(provider, key, transport=None):
        return await real(provider, key, transport=gemini_transport())

    monkeypatch.setattr("app.routers.system.list_remote_models", fake)
    client.post("/api/v1/credentials", json={"provider": "gemini", "alias": "Gemini", "api_key": "AIza-teste"})
    client.put("/api/v1/providers", json={"gemini": {"defaultModel": "gemini-2.5-pro", "customModels": ["gemini-2.5-pro"]}})
    ag = client.get("/api/v1/agents").json()[0]
    client.put(f"/api/v1/agents/{ag['id']}", json={"intelligence": {**ag["intelligence"], "provider": "gemini", "model": "gemini-2.5-pro"}})
    r = client.post("/api/v1/providers/gemini/models/refresh").json()
    assert r["defaultModel"] == "gemini-3-flash" and r["removedModels"] == ["gemini-2.5-pro"] and r["agentsReset"] == 1
    assert "gemini-2.5-pro" not in [m["id"] for m in r["models"]]
    assert client.get(f"/api/v1/agents/{ag['id']}").json()["intelligence"]["model"] == ""


def test_banco_obrigatorio_postgres(monkeypatch):
    from app.config import ConfigError, db_url, settings

    monkeypatch.setattr(settings, "allow_sqlite", False)
    monkeypatch.setattr(settings, "database_url", "")
    with pytest.raises(ConfigError, match="PostgreSQL"):
        db_url()
    monkeypatch.setattr(settings, "database_url", "sqlite:///x.db")
    with pytest.raises(ConfigError):
        db_url()
    monkeypatch.setattr(settings, "database_url", "postgresql://u:p@h:5432/d?sslmode=require")
    assert db_url().startswith("postgresql+psycopg://u:p@h")


def test_conta_principal_cria_promove_e_assume_dados_locais(env, monkeypatch):
    os.environ["FAKE_SUPABASE_SERVICE_KEY"] = "svc-teste"
    import importlib

    import fake_supabase
    from fastapi.testclient import TestClient

    importlib.reload(fake_supabase)
    from criar_conta_principal import adopt_local_data, ensure_owner

    sb = TestClient(fake_supabase.app)
    base = "http://testserver"
    with pytest.raises(RuntimeError):
        ensure_owner(sb, base, "chave-errada", "X", "x@y.com", "abcdefgh")
    user, created = ensure_owner(sb, base, "svc-teste", "Gestor Principal", "Principal@Exemplo.com", "Senha#Forte123")
    assert created and user["email"] == "principal@exemplo.com"
    # já existe → promove sem duplicar
    user2, created2 = ensure_owner(sb, base, "svc-teste", "Gestor Principal", "principal@exemplo.com", None)
    assert not created2 and user2["id"] == user["id"] and user2["app_metadata"]["role"] == "owner"
    # login direto (e-mail já confirmado) e token com o papel owner
    tok = sb.post("/auth/v1/token?grant_type=password", json={"email": "principal@exemplo.com", "password": "Senha#Forte123"}).json()
    import jwt

    claims = jwt.decode(tok["access_token"], options={"verify_signature": False})
    assert claims["app_metadata"]["role"] == "owner"
    # dados do modo local passam para a conta
    from app import db
    from app.models import Organization
    from sqlalchemy import select

    with db.session_scope() as s:
        assert s.scalars(select(Organization).where(Organization.owner_id == "local")).first()
    moved = adopt_local_data(user["id"])
    assert moved["organizations"] == 2 and moved["agents"] == 13
    with db.session_scope() as s:
        assert not s.scalars(select(Organization).where(Organization.owner_id == "local")).first()
