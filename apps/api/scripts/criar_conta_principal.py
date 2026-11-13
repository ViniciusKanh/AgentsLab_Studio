"""
Cria (ou promove) a CONTA PRINCIPAL do AgentsLab_Studio no Supabase Auth — e-mail já confirmado e
papel "owner" em app_metadata (só a service_role altera app_metadata; o usuário não consegue).

Opcionalmente transfere para essa conta os dados criados no modo local (organizações, agentes,
projetos, chaves, preferências) — `--assumir-dados-locais`.

A service_role e a senha NUNCA vão para o repositório: a chave vem de variável de ambiente e a
senha é digitada (getpass). Rode no seu computador, não no navegador.

  cd apps\\api
  $env:SUPABASE_URL="https://<ref>.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role ou sb_secret_...>"     # Project Settings → API
  $env:AGENTSLAB_DATABASE_URL="postgresql://..."                        # só com --assumir-dados-locais
  python scripts\\criar_conta_principal.py --nome "Seu Nome" --email voce@exemplo.com [--assumir-dados-locais]
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

import httpx

ROLE = "owner"


def admin_headers(service_key: str) -> dict:
    return {"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": "application/json"}


def find_user(client: httpx.Client, base: str, headers: dict, email: str) -> dict | None:
    page = 1
    while True:
        r = client.get(f"{base}/auth/v1/admin/users", params={"page": page, "per_page": 200}, headers=headers)
        r.raise_for_status()
        users = r.json().get("users", [])
        hit = next((u for u in users if str(u.get("email", "")).lower() == email), None)
        if hit or len(users) < 200:
            return hit
        page += 1


def ensure_owner(client: httpx.Client, base: str, service_key: str, name: str, email: str, password: str | None) -> tuple[dict, bool]:
    """Cria a conta confirmada como owner; se já existir, promove (e redefine a senha se informada)."""
    h = admin_headers(service_key)
    email = email.strip().lower()
    body = {"email": email, "email_confirm": True, "user_metadata": {"full_name": name}, "app_metadata": {"role": ROLE}}
    if password:
        body["password"] = password
    r = client.post(f"{base}/auth/v1/admin/users", json=body, headers=h)
    if r.status_code in (200, 201):
        return r.json(), True
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    exists = data.get("error_code") == "email_exists" or "already been registered" in str(data.get("msg", ""))
    if not exists:
        raise RuntimeError(f"Supabase recusou a criação ({r.status_code}): {data.get('msg') or r.text[:300]}")
    user = find_user(client, base, h, email)
    if not user:
        raise RuntimeError("Usuário existe mas não foi encontrado na listagem administrativa.")
    upd = {"email_confirm": True, "user_metadata": {"full_name": name}, "app_metadata": {"role": ROLE}}
    if password:
        upd["password"] = password
    r = client.put(f"{base}/auth/v1/admin/users/{user['id']}", json=upd, headers=h)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase recusou a atualização ({r.status_code}): {r.text[:300]}")
    return r.json(), False


def adopt_local_data(user_id: str) -> dict:
    """Transfere os registros do modo local (owner_id='local') para a conta principal."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from sqlalchemy import update

    from app import db, models
    from app.main import migrate

    db.Base.metadata.create_all(db.engine)  # sem criar organizações de exemplo
    migrate()
    moved = {}
    with db.session_scope() as s:
        for m in (models.Organization, models.Agent, models.Project, models.AgentMessage, models.Execution, models.Credential, models.Event):
            res = s.execute(update(m).where(m.owner_id == "local").values(owner_id=user_id))
            moved[m.__tablename__] = res.rowcount
        for old, new in (("providers", f"providers:{user_id}"), ("workflows", f"workflows:{user_id}"), ("seeded:local", f"seeded:{user_id}")):
            row = s.get(models.KeyValue, old)
            if row and not s.get(models.KeyValue, new):
                s.add(models.KeyValue(key=new, value=row.value))
                s.delete(row)
    return moved


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Cria/promove a conta principal (owner) no Supabase Auth.")
    ap.add_argument("--nome", required=True)
    ap.add_argument("--email", required=True)
    ap.add_argument("--manter-senha", action="store_true", help="conta já existe: não alterar a senha")
    ap.add_argument("--assumir-dados-locais", action="store_true", help="transferir dados do modo local para esta conta")
    a = ap.parse_args(argv)
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Project Settings → API). Nunca coloque a service_role no frontend.")
        return 2
    password = None
    if not a.manter_senha:
        password = getpass.getpass("Senha da conta principal (não aparece ao digitar): ")
        if len(password) < 8:
            print("A senha precisa ter pelo menos 8 caracteres.")
            return 2
        if password != getpass.getpass("Repita a senha: "):
            print("As senhas não conferem.")
            return 2
        if password.isdigit() or password.lower() in ("12345678", "password", "senha123", "123456789"):
            print("AVISO: esta senha está entre as mais usadas em vazamentos. Troque-a em Configurações → Conta assim que entrar.")
    with httpx.Client(timeout=30) as client:
        user, created = ensure_owner(client, base, key, a.nome, a.email, password)
    print(("Conta criada" if created else "Conta existente promovida") + f": {user.get('email')} (id {user.get('id')}) — papel {ROLE}, e-mail confirmado.")
    if a.assumir_dados_locais:
        moved = adopt_local_data(user["id"])
        print("Dados locais transferidos:", ", ".join(f"{k}={v}" for k, v in moved.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
