"""Configurações centralizadas lidas do ambiente (nunca versionar segredos)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENTSLAB_", extra="ignore")

    env: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,tauri://localhost"
    data_dir: str = "./data"
    # SQLite local por padrão; PostgreSQL: postgresql+psycopg://user:pass@host/db
    database_url: str = ""
    # Cofre de segredos: "keyring" (Gerenciador de Credenciais do Windows/Keychain) ou "file" (Fernet)
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


settings = Settings()


def db_url() -> str:
    return settings.database_url or f"sqlite:///{settings.data_dir}/agentslab.db"
