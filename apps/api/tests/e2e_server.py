"""
Servidor da API para os testes E2E (Playwright) — SOMENTE TESTES.
Banco temporário, cofre em arquivo e LLM/ferramentas determinísticos (tests/fakes.py),
para validar a interface sem depender de rede nem de chaves reais.

Uso: python tests/e2e_server.py  (porta 8010)
"""
import os
import sys
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "tests")]
tmp = tempfile.mkdtemp(prefix="agentslab-e2e-")
os.environ["AGENTSLAB_DATA_DIR"] = tmp
os.environ["AGENTSLAB_DATABASE_URL"] = f"sqlite:///{tmp}/e2e.db"
os.environ.setdefault("AGENTSLAB_CORS_ORIGINS", "http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173")

import uvicorn  # noqa: E402

from app.services import llm, tools, vault  # noqa: E402
from fakes import FakeLLM, FakeTools  # noqa: E402

vault.set_store(vault.FernetFileStore(Path(tmp) / "secrets.enc", Fernet.generate_key().decode()))
llm.set_gateway(FakeLLM(delay=float(os.environ.get("E2E_LLM_DELAY", "0.6"))))
tools.set_tools(FakeTools())

if __name__ == "__main__":
    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("E2E_API_PORT", "8010")), log_level="warning")
