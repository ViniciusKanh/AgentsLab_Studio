"""
Autenticação da API: valida o access token (JWT) emitido pelo Supabase Auth.

- Projetos Supabase com chaves assimétricas (padrão atual): valida pela JWKS pública em
  {SUPABASE_URL}/auth/v1/.well-known/jwks.json (ES256/RS256) — nenhum segredo no backend.
- Projetos com segredo legado (HS256): AGENTSLAB_SUPABASE_JWT_SECRET.
- Sem Supabase configurado: modo local de usuário único (owner_id = "local"), para o app desktop.

O backend NUNCA emite tokens nem guarda senhas — isso é responsabilidade do Supabase Auth.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Header, HTTPException, Query

from app.config import auth_enabled, settings

LOCAL_OWNER = "local"


@dataclass
class CurrentUser:
    id: str
    email: str = ""
    name: str = ""
    # papel definido só pela service_role (app_metadata.role): "owner" = conta principal
    role: str = "member"


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=3600)


def verify_token(token: str) -> CurrentUser:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise jwt.InvalidTokenError("HS256 não habilitado")
            claims = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience=settings.supabase_jwt_audience)
        else:
            if not settings.supabase_url:
                raise jwt.InvalidTokenError("JWKS não configurada")
            key = _jwks_client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["ES256", "RS256", "EdDSA"], audience=settings.supabase_jwt_audience)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "Sessão expirada. Entre novamente.") from exc
    except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
        raise HTTPException(401, "Token de acesso inválido.") from exc
    if claims.get("role") != "authenticated" or not claims.get("sub"):
        raise HTTPException(401, "Usuário não autenticado.")
    meta = claims.get("user_metadata") or {}
    app_meta = claims.get("app_metadata") or {}
    return CurrentUser(id=str(claims["sub"]), email=str(claims.get("email", "")), name=str(meta.get("full_name", "")),
                       role=str(app_meta.get("role") or "member"))


def _from(authorization: str | None, token_param: str | None) -> CurrentUser:
    if not auth_enabled():
        return CurrentUser(id=LOCAL_OWNER, name="Usuário local", role="owner")
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    token = token or token_param
    if not token:
        raise HTTPException(401, "Autenticação necessária.", headers={"WWW-Authenticate": "Bearer"})
    return verify_token(token)


def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    """Dependência padrão: Authorization: Bearer <access_token do Supabase>."""
    return _from(authorization, None)


def current_user_sse(authorization: str | None = Header(default=None), access_token: str | None = Query(default=None)) -> CurrentUser:
    """EventSource não envia cabeçalhos: aceita também ?access_token= (somente no SSE)."""
    return _from(authorization, access_token)
