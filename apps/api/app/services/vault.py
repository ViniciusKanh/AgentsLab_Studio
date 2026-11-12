"""
Cofre de credenciais (Fase 3 — antecipado a pedido do usuário).

- Cada provedor pode ter VÁRIOS perfis (ex.: "Gemini · chave 1", "Gemini · chave 2").
- A chave é criptografada com Fernet (AES-128-CBC + HMAC) usando AGENTSLAB_MASTER_KEY.
- A API nunca devolve a chave: apenas id, provedor, apelido e últimos 4 caracteres.
- Persistência local em SQLite (substituível por PostgreSQL na Fase 2).
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

PROVIDERS = {"gemini", "groq", "openai", "huggingface", "ollama"}


class VaultNotConfigured(RuntimeError):
    pass


class CredentialVault:
    def __init__(self, db_path: str | Path, master_key: str):
        if not master_key:
            raise VaultNotConfigured(
                "Defina AGENTSLAB_MASTER_KEY (gere com: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
            )
        self._fernet = Fernet(master_key.encode())
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS credentials (
                    id TEXT PRIMARY KEY, provider TEXT NOT NULL, alias TEXT NOT NULL,
                    ciphertext BLOB NOT NULL, last4 TEXT, created_at TEXT NOT NULL)"""
            )

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self._path)

    @staticmethod
    def _public(row) -> dict:
        return {"id": row[0], "provider": row[1], "alias": row[2], "last4": row[3], "status": "stored", "createdAt": row[4], "origin": "real"}

    def list(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute("SELECT id, provider, alias, last4, created_at FROM credentials ORDER BY created_at").fetchall()
        return [self._public(r) for r in rows]

    def create(self, provider: str, alias: str, api_key: str) -> dict:
        if provider not in PROVIDERS:
            raise ValueError("Provedor inválido")
        alias = alias.strip()
        if not 3 <= len(alias) <= 60:
            raise ValueError("Apelido deve ter entre 3 e 60 caracteres")
        api_key = (api_key or "").strip()
        if provider != "ollama" and len(api_key) < 8:
            raise ValueError("Chave de API ausente ou muito curta")
        cid = f"cred-{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        token = self._fernet.encrypt(api_key.encode())
        last4 = api_key[-4:] if api_key else None
        with self._conn() as c:
            c.execute("INSERT INTO credentials VALUES (?,?,?,?,?,?)", (cid, provider, alias, token, last4, now))
        return {"id": cid, "provider": provider, "alias": alias, "last4": last4, "status": "stored", "createdAt": now, "origin": "real"}

    def delete(self, cid: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM credentials WHERE id = ?", (cid,))
        return cur.rowcount > 0

    def reveal(self, cid: str) -> str:
        """Uso EXCLUSIVO do backend (ex.: LiteLLM na execução). Nunca expor via HTTP."""
        with self._conn() as c:
            row = c.execute("SELECT ciphertext FROM credentials WHERE id = ?", (cid,)).fetchone()
        if not row:
            raise KeyError(cid)
        try:
            return self._fernet.decrypt(row[0]).decode()
        except InvalidToken as exc:  # chave mestra trocada
            raise VaultNotConfigured("AGENTSLAB_MASTER_KEY não corresponde aos dados armazenados") from exc
