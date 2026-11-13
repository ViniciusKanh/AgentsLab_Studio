"""
Cofre de credenciais.

A chave é digitada no próprio app e guardada no COFRE DO SISTEMA OPERACIONAL:
  - Windows: Gerenciador de Credenciais (protegido por DPAPI, atrelado ao usuário)
  - macOS: Keychain · Linux: Secret Service
via a biblioteca `keyring`. O banco guarda apenas metadados (provedor, apelido, últimos 4).

Fallback "file" (CI/servidor sem cofre): arquivo criptografado com Fernet, chave mestra
em AGENTSLAB_MASTER_KEY (ou gerada e guardada no próprio keyring quando disponível).
A API nunca devolve o segredo; só o backend o lê no momento da chamada ao LLM.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Credential, Secret

SERVICE = "AgentsLab_Studio"
PROVIDERS = {"gemini", "groq", "openai", "huggingface", "ollama"}
ENV_FALLBACK = {"gemini": "GEMINI_API_KEY", "groq": "GROQ_API_KEY", "openai": "OPENAI_API_KEY", "huggingface": "HUGGINGFACE_API_KEY"}


class VaultError(RuntimeError):
    pass


class SecretStore(Protocol):
    name: str
    def set(self, key: str, secret: str) -> None: ...
    def get(self, key: str) -> str | None: ...
    def delete(self, key: str) -> None: ...


class KeyringStore:
    """Cofre do sistema operacional (Windows Credential Manager no Windows)."""
    name = "keyring"

    def __init__(self):
        import keyring
        from keyring.backends import fail

        self._kr = keyring
        backend = keyring.get_keyring()
        if isinstance(backend, fail.Keyring) or (hasattr(backend, "backends") and not backend.backends):
            raise VaultError("Nenhum cofre de credenciais do sistema operacional disponível")
        self.backend_name = type(backend).__name__

    def set(self, key, secret):
        self._kr.set_password(SERVICE, key, secret)

    def get(self, key):
        return self._kr.get_password(SERVICE, key)

    def delete(self, key):
        try:
            self._kr.delete_password(SERVICE, key)
        except Exception:
            pass


class FernetFileStore:
    """Arquivo criptografado (fallback). Nunca use sem AGENTSLAB_MASTER_KEY em produção."""
    name = "file"

    def __init__(self, path: str | Path, master_key: str):
        from cryptography.fernet import Fernet

        if not master_key:
            raise VaultError("AGENTSLAB_MASTER_KEY ausente para o cofre em arquivo")
        self._f = Fernet(master_key.encode())
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict:
        if not self._path.exists():
            return {}
        return json.loads(self._f.decrypt(self._path.read_bytes()).decode())

    def _save(self, data: dict):
        self._path.write_bytes(self._f.encrypt(json.dumps(data).encode()))

    def set(self, key, secret):
        d = self._load(); d[key] = secret; self._save(d)

    def get(self, key):
        return self._load().get(key)

    def delete(self, key):
        d = self._load(); d.pop(key, None); self._save(d)


class DbFernetStore:
    """Segredos criptografados (Fernet) no próprio banco — para o servidor hospedado (disco efêmero).
    A chave mestra (AGENTSLAB_MASTER_KEY) fica só nas variáveis do servidor, nunca no banco."""
    name = "db"

    def __init__(self, master_key: str):
        from cryptography.fernet import Fernet

        if not master_key:
            raise VaultError("AGENTSLAB_MASTER_KEY ausente para o cofre no banco")
        self._f = Fernet(master_key.encode())

    def set(self, key, secret):
        from app.db import session_scope

        with session_scope() as s:
            row = s.get(Secret, key)
            enc = self._f.encrypt(secret.encode()).decode()
            if row:
                row.value_enc = enc
            else:
                s.add(Secret(key=key, value_enc=enc))

    def get(self, key):
        from app.db import session_scope

        with session_scope() as s:
            row = s.get(Secret, key)
            return self._f.decrypt(row.value_enc.encode()).decode() if row else None

    def delete(self, key):
        from app.db import session_scope

        with session_scope() as s:
            row = s.get(Secret, key)
            if row:
                s.delete(row)


_store: SecretStore | None = None


def get_store() -> SecretStore:
    global _store
    if _store is None:
        if settings.secret_backend == "db":
            _store = DbFernetStore(settings.master_key or os.environ.get("AGENTSLAB_MASTER_KEY", ""))
        elif settings.secret_backend == "keyring":
            try:
                _store = KeyringStore()
            except Exception:
                _store = FernetFileStore(Path(settings.data_dir) / "secrets.enc", settings.master_key or os.environ.get("AGENTSLAB_MASTER_KEY", ""))
        else:
            _store = FernetFileStore(Path(settings.data_dir) / "secrets.enc", settings.master_key)
    return _store


def set_store(store: SecretStore | None):
    global _store
    _store = store


def public(c: Credential) -> dict:
    return {"id": c.id, "provider": c.provider, "alias": c.alias, "last4": c.last4, "status": "stored",
            "isDefault": c.is_default, "createdAt": c.created_at.isoformat(), "origin": "real"}


class CredentialService:
    def __init__(self, db: Session, store: SecretStore | None = None, owner_id: str = "local"):
        self.db = db
        self.store = store or get_store()
        self.owner = owner_id

    def _q(self):
        return select(Credential).where(Credential.owner_id == self.owner)

    def _get(self, cid: str) -> Credential | None:
        c = self.db.get(Credential, cid)
        return c if c and c.owner_id == self.owner else None

    def list(self) -> list[dict]:
        return [public(c) for c in self.db.scalars(self._q().order_by(Credential.created_at))]

    def create(self, provider: str, alias: str, api_key: str, make_default: bool = False) -> dict:
        if provider not in PROVIDERS:
            raise ValueError("Provedor inválido")
        alias = alias.strip()
        if not 3 <= len(alias) <= 60:
            raise ValueError("Apelido deve ter entre 3 e 60 caracteres")
        api_key = (api_key or "").strip()
        if provider != "ollama" and len(api_key) < 8:
            raise ValueError("Informe a chave de API (mínimo 8 caracteres)")
        first = not self.db.scalars(self._q().where(Credential.provider == provider)).first()
        c = Credential(owner_id=self.owner, provider=provider, alias=alias, last4=api_key[-4:] if api_key else None, is_default=make_default or first)
        if c.is_default:
            for other in self.db.scalars(self._q().where(Credential.provider == provider)):
                other.is_default = False
        self.db.add(c)
        self.db.flush()
        self.store.set(c.id, api_key)
        self.db.commit()
        return public(c)

    def delete(self, cid: str) -> bool:
        c = self._get(cid)
        if not c:
            return False
        self.store.delete(cid)
        self.db.delete(c)
        self.db.commit()
        return True

    def set_default(self, cid: str) -> dict:
        c = self._get(cid)
        if not c:
            raise KeyError(cid)
        for other in self.db.scalars(self._q().where(Credential.provider == c.provider)):
            other.is_default = other.id == cid
        self.db.commit()
        return public(c)

    def resolve(self, provider: str, credential_id: str | None) -> str | None:
        """Chave efetiva: perfil do agente → perfil padrão do provedor → variável de ambiente."""
        if credential_id:
            c = self._get(credential_id)
            if c and c.provider == provider:
                return self.store.get(c.id)
        d = self.db.scalars(self._q().where(Credential.provider == provider, Credential.is_default.is_(True))).first()
        if d:
            return self.store.get(d.id)
        # variável de ambiente só vale no modo local (desktop) — nunca compartilhar a chave do servidor entre usuários
        env = ENV_FALLBACK.get(provider)
        return os.environ.get(env) if env and self.owner == "local" else None
