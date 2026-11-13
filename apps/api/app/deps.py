"""Dependências comuns das rotas: usuário autenticado (com organizações iniciais no 1º acesso)."""
from fastapi import Depends

from app.auth import CurrentUser, current_user
from app.config import settings


def user(u: CurrentUser = Depends(current_user)) -> CurrentUser:
    if settings.seed_demo_organizations:
        from app.services.seed import seed_for_owner

        seed_for_owner(u.id)
    return u
