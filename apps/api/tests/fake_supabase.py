"""
Servidor FALSO do Supabase Auth (subconjunto da API GoTrue) — SOMENTE PARA TESTES E2E.

Permite testar no navegador os fluxos reais do app (supabase-js) sem rede: cadastro, e-mail de
verificação, login, sessão, recuperação/definição de senha e logout. Os e-mails ficam numa caixa
de saída consultável em GET /__mail. Os tokens são JWT HS256 assinados com FAKE_SUPABASE_SECRET,
o mesmo segredo configurado no backend de teste (AGENTSLAB_SUPABASE_JWT_SECRET).

Uso: python tests/fake_supabase.py  (porta 8020)
"""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
import uuid
from datetime import datetime, timezone

import jwt
import uvicorn
from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

SECRET = os.environ.get("FAKE_SUPABASE_SECRET", "segredo-e2e-com-pelo-menos-32-caracteres!!")
SITE = os.environ.get("FAKE_SUPABASE_SITE", "http://localhost:4173")
TOKEN_TTL = int(os.environ.get("FAKE_SUPABASE_TTL", "3600"))

app = FastAPI(title="Fake Supabase Auth (testes)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["*"])

users: dict[str, dict] = {}          # email -> usuário (com senha em hash, como faria o Supabase)
otps: dict[str, dict] = {}            # token_hash -> {email, type, exp}
refresh: dict[str, str] = {}         # refresh_token -> email
mail: list[dict] = []


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def err(status: int, code: str, msg: str):
    return JSONResponse({"code": status, "error_code": code, "msg": msg}, status_code=status)


def hash_pw(pw: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()


def public_user(u: dict) -> dict:
    return {"id": u["id"], "aud": "authenticated", "role": "authenticated", "email": u["email"], "email_confirmed_at": u["confirmed_at"],
            "confirmed_at": u["confirmed_at"], "user_metadata": u["meta"], "app_metadata": {"provider": "email", "providers": ["email"]},
            "identities": [{"id": u["id"], "provider": "email", "identity_data": {"email": u["email"]}}], "created_at": u["created_at"], "updated_at": now_iso()}


def session_for(u: dict) -> dict:
    exp = int(time.time()) + TOKEN_TTL
    access = jwt.encode({"sub": u["id"], "email": u["email"], "role": "authenticated", "aud": "authenticated", "exp": exp,
                         "user_metadata": u["meta"], "session_id": str(uuid.uuid4())}, SECRET, algorithm="HS256")
    rt = secrets.token_urlsafe(24)
    refresh[rt] = u["email"]
    return {"access_token": access, "token_type": "bearer", "expires_in": TOKEN_TTL, "expires_at": exp, "refresh_token": rt, "user": public_user(u)}


def send(email: str, kind: str, redirect_to: str | None):
    th = secrets.token_urlsafe(18)
    otps[th] = {"email": email, "type": kind, "exp": time.time() + 3600}
    # mesmo formato dos modelos de e-mail documentados em docs/SUPABASE.md
    base = SITE.rstrip("/")
    nxt = "/redefinir-senha" if kind == "recovery" else "/"
    link = f"{base}/auth/confirm?token_hash={th}&type={kind}&next={nxt}"
    mail.append({"to": email, "type": kind, "link": link, "redirect_to": redirect_to, "at": now_iso()})


def user_from_bearer(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        claims = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"], audience="authenticated")
    except jwt.InvalidTokenError:
        return None
    return users.get(claims.get("email"))


@app.post("/auth/v1/signup")
async def signup(request: Request):
    b = await request.json()
    email, pw = str(b.get("email", "")).lower().strip(), str(b.get("password", ""))
    if len(pw) < 8:
        return err(422, "weak_password", "Password should be at least 8 characters.")
    u = users.get(email)
    if u and u["confirmed_at"]:
        # o Supabase não revela que o e-mail já existe: devolve um usuário "ofuscado" sem sessão
        return {**public_user(u), "identities": []}
    if not u:
        salt = secrets.token_hex(8)
        u = users[email] = {"id": str(uuid.uuid4()), "email": email, "salt": salt, "pw": hash_pw(pw, salt), "confirmed_at": None,
                            "meta": b.get("data") or {}, "created_at": now_iso()}
    send(email, "signup", request.query_params.get("redirect_to"))
    return public_user(u)


@app.post("/auth/v1/resend")
async def resend(request: Request):
    b = await request.json()
    u = users.get(str(b.get("email", "")).lower())
    if u and not u["confirmed_at"]:
        send(u["email"], "signup", request.query_params.get("redirect_to"))
    return {}


@app.post("/auth/v1/recover")
async def recover(request: Request):
    b = await request.json()
    u = users.get(str(b.get("email", "")).lower())
    if u:
        send(u["email"], "recovery", request.query_params.get("redirect_to"))
    return {}


@app.post("/auth/v1/verify")
async def verify(request: Request):
    b = await request.json()
    o = otps.pop(str(b.get("token_hash", "")), None)
    if not o or o["exp"] < time.time():
        return err(403, "otp_expired", "Email link is invalid or has expired")
    u = users[o["email"]]
    u["confirmed_at"] = u["confirmed_at"] or now_iso()
    return session_for(u)


@app.post("/auth/v1/token")
async def token(request: Request):
    grant = request.query_params.get("grant_type")
    b = await request.json()
    if grant == "password":
        u = users.get(str(b.get("email", "")).lower())
        if not u or hash_pw(str(b.get("password", "")), u["salt"]) != u["pw"]:
            return err(400, "invalid_credentials", "Invalid login credentials")
        if not u["confirmed_at"]:
            return err(400, "email_not_confirmed", "Email not confirmed")
        return session_for(u)
    if grant == "refresh_token":
        email = refresh.pop(str(b.get("refresh_token", "")), None)
        if not email:
            return err(400, "refresh_token_not_found", "Invalid Refresh Token")
        return session_for(users[email])
    return err(400, "unsupported_grant_type", "unsupported grant")


@app.get("/auth/v1/user")
async def get_user(authorization: str | None = Header(default=None)):
    u = user_from_bearer(authorization)
    return public_user(u) if u else err(401, "bad_jwt", "invalid JWT")


@app.put("/auth/v1/user")
async def update_user(request: Request, authorization: str | None = Header(default=None)):
    u = user_from_bearer(authorization)
    if not u:
        return err(401, "bad_jwt", "invalid JWT")
    b = await request.json()
    if "password" in b:
        if len(str(b["password"])) < 8:
            return err(422, "weak_password", "Password should be at least 8 characters.")
        if hash_pw(str(b["password"]), u["salt"]) == u["pw"]:
            return err(422, "same_password", "New password should be different from the old password.")
        u["pw"] = hash_pw(str(b["password"]), u["salt"])
    if "data" in b:
        u["meta"] = {**u["meta"], **(b["data"] or {})}
    return public_user(u)


@app.post("/auth/v1/logout")
async def logout():
    return Response(status_code=204)


@app.get("/__mail")
async def outbox(to: str | None = None):
    return [m for m in mail if not to or m["to"] == to.lower()]


@app.post("/__expire")
async def expire_all():
    for o in otps.values():
        o["exp"] = 0
    return {}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("FAKE_SUPABASE_PORT", "8020")), log_level="warning")
