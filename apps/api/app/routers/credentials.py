from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.config import settings
from app.services.vault import CredentialVault, VaultNotConfigured

router = APIRouter(prefix="/api/v1/credentials", tags=["credenciais"])


class CredentialIn(BaseModel):
    provider: Literal["gemini", "groq", "openai", "huggingface", "ollama"]
    alias: str = Field(min_length=3, max_length=60)
    api_key: str = Field(default="", max_length=400)


@lru_cache
def get_vault() -> CredentialVault:
    return CredentialVault(settings.data_dir + "/agentslab.db", settings.master_key)


def vault_dependency() -> CredentialVault:
    try:
        return get_vault()
    except VaultNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("")
def list_credentials(vault: CredentialVault = Depends(vault_dependency)):
    return vault.list()


@router.post("", status_code=201)
def create_credential(body: CredentialIn, vault: CredentialVault = Depends(vault_dependency)):
    try:
        return vault.create(body.provider, body.alias, body.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{cid}", status_code=204)
def delete_credential(cid: str, vault: CredentialVault = Depends(vault_dependency)):
    if not vault.delete(cid):
        raise HTTPException(status_code=404, detail="Credencial não encontrada")
    return Response(status_code=204)
