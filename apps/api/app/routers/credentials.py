"""Chaves de API digitadas no app → cofre do sistema operacional. A API nunca devolve o segredo."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.deps import user
from app.services.vault import CredentialService, VaultError, get_store

router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])


class CredentialIn(BaseModel):
    provider: Literal["gemini", "groq", "openai", "huggingface", "ollama"]
    alias: str = Field(min_length=3, max_length=60)
    api_key: str = Field(default="", max_length=400)
    is_default: bool = False


def service(db: Session = Depends(get_db), u: CurrentUser = Depends(user)) -> CredentialService:
    try:
        return CredentialService(db, get_store(), owner_id=u.id)
    except VaultError as exc:
        raise HTTPException(503, f"Cofre de credenciais indisponível: {exc}") from exc


@router.get("")
def list_credentials(svc: CredentialService = Depends(service)):
    return svc.list()


@router.get("/vault")
def vault_info(_u: CurrentUser = Depends(user)):
    try:
        st = get_store()
        return {"available": True, "backend": getattr(st, "backend_name", st.name), "kind": st.name}
    except VaultError as exc:
        return {"available": False, "backend": None, "kind": None, "error": str(exc)}


@router.post("", status_code=201)
def create_credential(body: CredentialIn, svc: CredentialService = Depends(service)):
    try:
        return svc.create(body.provider, body.alias, body.api_key, body.is_default)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{cid}/default")
def make_default(cid: str, svc: CredentialService = Depends(service)):
    try:
        return svc.set_default(cid)
    except KeyError as exc:
        raise HTTPException(404, "Credencial não encontrada") from exc


@router.delete("/{cid}", status_code=204)
def delete_credential(cid: str, svc: CredentialService = Depends(service)):
    if not svc.delete(cid):
        raise HTTPException(404, "Credencial não encontrada")
    return Response(status_code=204)
