from fastapi import APIRouter

from app.config import auth_enabled

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "agentslab-api", "version": "0.3.0", "auth": "supabase" if auth_enabled() else "local"}
