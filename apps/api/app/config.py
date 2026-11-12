"""Configurações centralizadas lidas do ambiente (nunca versionar segredos)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENTSLAB_", extra="ignore")

    env: str = "development"
    cors_origins: str = "http://localhost:5173"
    database_url: str = ""
    redis_url: str = ""
    data_dir: str = "./data"
    # Chave Fernet para criptografar credenciais (obrigatória para /api/v1/credentials)
    master_key: str = ""
    # Chaves dos provedores ficam SOMENTE no backend (lidas pelo LiteLLM):
    # GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, HUGGINGFACE_API_KEY, OLLAMA_BASE_URL


settings = Settings()
