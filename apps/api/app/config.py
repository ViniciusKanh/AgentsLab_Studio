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
    # SQLite só para testes automatizados / demonstração explícita. Uso normal: PostgreSQL (Supabase ou Docker).
    allow_sqlite: bool = False
    # Cofre de segredos: "auto" (= "db" com PostgreSQL), "db" (Fernet no banco — funciona local e no servidor),
    # "keyring" (Gerenciador de Credenciais do Windows) ou "file" (arquivo Fernet). "db"/"file" exigem master_key.
    secret_backend: str = "auto"
    # Usado apenas pelo backend "file" (CI/servidores sem cofre do SO)
    master_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    # Limites padrão de segurança/custo
    default_project_budget_usd: float = 2.0
    max_tasks_per_project: int = 10
    max_llm_calls_per_project: int = 60
    max_auto_revisions: int = 1
    task_concurrency: int = 3
    # chamadas simultâneas por provedor (respeita limites de requisição — ex.: plano gratuito do Gemini)
    provider_concurrency: int = 2
    # retentativas em erros transitórios (429, 5xx, timeout); o agente pode reduzir em limits.maxRetries
    llm_max_retries: int = 2
    llm_retry_base_sec: float = 4.0
    # tempo máximo de uma tarefa inteira (todas as chamadas e ferramentas)
    task_timeout_sec: int = 900
    # teto de tarefas do projeto incluindo revisões, feedbacks e propagações (evita delegação sem fim)
    max_total_tasks_per_project: int = 30
    # verificação independente de referências (Crossref / arXiv)
    verify_references: bool = True
    seed_demo_organizations: bool = True
    # Autenticação (Supabase Auth). Sem supabase_url/jwt_secret → modo local de usuário único (desktop).
    supabase_url: str = ""
    # Projetos com chave JWT legada (HS256): o "JWT Secret" do painel. Projetos novos usam JWKS (assimétrico).
    supabase_jwt_secret: str = ""
    supabase_jwt_audience: str = "authenticated"


settings = Settings()


class ConfigError(RuntimeError):
    pass


def db_url() -> str:
    url = settings.database_url.strip()
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    if url:
        if url.startswith("sqlite") and not settings.allow_sqlite:
            raise ConfigError("SQLite está desativado. Use PostgreSQL em AGENTSLAB_DATABASE_URL (veja docs/DEPLOY.md).")
        return url
    if settings.allow_sqlite:
        return f"sqlite:///{settings.data_dir}/agentslab.db"
    raise ConfigError(
        "Banco não configurado. Defina AGENTSLAB_DATABASE_URL com um PostgreSQL — Supabase "
        "(postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require) "
        "ou o Docker local (docker compose up -d db → postgresql://agentslab:agentslab@localhost:5432/agentslab). Veja docs/DEPLOY.md."
    )


def auth_enabled() -> bool:
    return bool(settings.supabase_url or settings.supabase_jwt_secret)
