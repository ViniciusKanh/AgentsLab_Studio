"""Keep-alive para hospedagem gratuita que hiberna (Render)."""
import asyncio

from app.config import settings
from app.services import keepalive


def test_modos():
    assert keepalive.should_ping("always", False)
    assert keepalive.should_ping("busy", True) and not keepalive.should_ping("busy", False)
    assert not keepalive.should_ping("off", True)


def test_url_do_render(monkeypatch):
    monkeypatch.setattr(settings, "keepalive_url", "")
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://agentslab-api.onrender.com/")
    assert keepalive.public_url() == "https://agentslab-api.onrender.com"


def test_sem_url_nao_executa(monkeypatch):
    monkeypatch.setattr(settings, "keepalive_url", "")
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
    asyncio.run(asyncio.wait_for(keepalive.keepalive_loop(lambda: True), 1))  # retorna na hora


def test_acessa_health(monkeypatch):
    hits = []

    class Client:
        def __init__(self, **_):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url):
            hits.append(url)
            raise asyncio.CancelledError  # encerra o laço após o primeiro acesso

    monkeypatch.setattr(settings, "keepalive_url", "https://x.onrender.com")
    monkeypatch.setattr(settings, "keepalive_mode", "always")
    monkeypatch.setattr(settings, "keepalive_interval_sec", 0)
    monkeypatch.setattr(keepalive.httpx, "AsyncClient", Client)
    try:
        asyncio.run(keepalive.keepalive_loop(lambda: False))
    except asyncio.CancelledError:
        pass
    assert hits == ["https://x.onrender.com/health"]
