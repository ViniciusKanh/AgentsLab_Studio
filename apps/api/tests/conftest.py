"""Fixtures: banco SQLite temporário, cofre em arquivo e, SOMENTE nos testes, LLM e ferramentas falsos."""
import os
import time

import pytest
from cryptography.fernet import Fernet

os.environ.setdefault("AGENTSLAB_DATA_DIR", os.path.join(os.path.dirname(__file__), ".data"))

from app import db  # noqa: E402
from app.services import llm as llm_mod, tools as tools_mod, vault  # noqa: E402
from fakes import FakeLLM, FakeTools  # noqa: E402

@pytest.fixture()
def env(tmp_path):
    db.configure(f"sqlite:///{tmp_path / 'test.db'}")
    from app.main import init_db

    init_db()
    store = vault.FernetFileStore(tmp_path / "secrets.enc", Fernet.generate_key().decode())
    vault.set_store(store)
    fake = FakeLLM()
    llm_mod.set_gateway(fake)
    tools_mod.set_tools(FakeTools())
    yield {"store": store, "llm": fake}
    llm_mod.set_gateway(None)
    tools_mod.set_tools(None)
    vault.set_store(None)


@pytest.fixture()
def client(env):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


def wait_for(fn, timeout=15.0):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(0.05)
    raise AssertionError("timeout aguardando condição")
