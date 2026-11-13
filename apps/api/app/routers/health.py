from fastapi import APIRouter

from app.config import auth_enabled

# versão do contrato da API; o frontend avisa quando o servidor em execução é mais antigo
API_VERSION = "0.4.0"

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "agentslab-api", "version": API_VERSION, "auth": "supabase" if auth_enabled() else "local"}
