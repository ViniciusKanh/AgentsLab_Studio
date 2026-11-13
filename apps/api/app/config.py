"""Configurações centralizadas lidas do ambiente (nunca versionar segredos)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENTSLAB_", extra="ignore")

    env: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,tauri://localhost"
    # Domínios de preview (ex.: https://.*\.vercel\.app|https://.*\.pages\.dev). Vazio = desativado.
    cors_origin_regex: str = ""
    data_dir: str = "./data"
    # SQLite local por padrão; PostgreSQL: postgresql+psycopg://user:pass@host/db
    database_url: str = ""
    # PostgreSQL: schema próprio, FORA do "public" exposto pela Data API do Supabase
    db_schema: str = "agentslab"
    # Cofre de segredos: "keyring" (Gerenciador de Credenciais do Windows/Keychain), "file" (arquivo Fernet)
    # ou "db" (Fernet no banco — servidor hospedado, disco efêmero). "file"/"db" exigem master_key.
    secret_backend: str = "keyring"
    # Usado apenas pelo backend "file" (CI/servidores sem cofre do SO)
    master_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    # Limites padrão de segurança/custo
    default_project_budget_usd: float = 2.0
    max_tasks_per_project: int = 10
    max_llm_calls_per_project: int = 60
    max_auto_revisions: int = 1
    task_concurrency: int = 3
    seed_demo_organizations: bool = True
    # Autenticação (Supabase Auth). Sem supabase_url/jwt_secret → modo local de usuário único (desktop).
    supabase_url: str = ""
    # Projetos com chave JWT legada (HS256): o "JWT Secret" do painel. Projetos novos usam JWKS (assimétrico).
    supabase_jwt_secret: str = ""
    supabase_jwt_audience: str = "authenticated"


settings = Settings()


def db_url() -> str:
    return settings.database_url or f"sqlite:///{settings.data_dir}/agentslab.db"


def auth_enabled() -> bool:
    return bool(settings.supabase_url or settings.supabase_jwt_secret)
