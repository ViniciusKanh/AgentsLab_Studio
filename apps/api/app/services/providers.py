"""
Provedores de modelos: catálogo de referência, preferências por usuário (ativo/modelo padrão)
e listagem AO VIVO dos modelos disponíveis para a chave do usuário.
"""
from __future__ import annotations

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import KeyValue

# Catálogo de modelos. Preços são REFERÊNCIAS para estimativa (US$/1M tokens); o custo registrado vem do LiteLLM.
CATALOG = [
    # O Google descontinua modelos com frequência (ex.: gemini-2.5-flash deixou de aceitar novos usuários).
    # Use "Atualizar lista" na tela de provedores: a lista real vem da API do Google com a sua chave.
    {"id": "gemini", "name": "Gemini", "kind": "cloud", "badge": "Padrão", "defaultModel": "gemini-3.8-flash", "models": [
        {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash", "contextWindow": None, "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["sugerido pela API do Google"]}]},
    {"id": "groq", "name": "Groq", "kind": "cloud", "badge": "Rápido", "defaultModel": "llama-3.3-70b-versatile", "models": [
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "contextWindow": 128_000, "inputPer1M": 0.59, "outputPer1M": 0.79, "priceIsEstimate": True, "tags": ["baixa latência"]},
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "contextWindow": 128_000, "inputPer1M": 0.05, "outputPer1M": 0.08, "priceIsEstimate": True, "tags": ["econômico"]}]},
    {"id": "openai", "name": "OpenAI", "kind": "cloud", "badge": "Alta Qualidade", "defaultModel": "gpt-4.1-mini", "models": [
        {"id": "gpt-4.1-mini", "name": "GPT-4.1 mini", "contextWindow": 1_000_000, "inputPer1M": 0.4, "outputPer1M": 1.6, "priceIsEstimate": True, "tags": ["custo"]},
        {"id": "gpt-4.1", "name": "GPT-4.1", "contextWindow": 1_000_000, "inputPer1M": 2, "outputPer1M": 8, "priceIsEstimate": True, "tags": ["qualidade"]}]},
    {"id": "huggingface", "name": "Hugging Face", "kind": "cloud", "badge": "Modelos Abertos", "defaultModel": "meta-llama/Llama-3.1-8B-Instruct", "models": [
        {"id": "meta-llama/Llama-3.1-8B-Instruct", "name": "Llama 3.1 8B Instruct", "contextWindow": 128_000, "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["open-weights"]}]},
    {"id": "ollama", "name": "Ollama (local)", "kind": "local", "badge": "Local", "defaultModel": "llama3.1:8b", "models": [
        {"id": "llama3.1:8b", "name": "Llama 3.1 8B (local)", "contextWindow": 128_000, "inputPer1M": 0, "outputPer1M": 0, "priceIsEstimate": False, "tags": ["sem custo de API"]},
        {"id": "qwen2.5:7b", "name": "Qwen 2.5 7B (local)", "contextWindow": 32_000, "inputPer1M": 0, "outputPer1M": 0, "priceIsEstimate": False, "tags": ["local"]}]},
]



PROVIDER_IDS = {p["id"] for p in CATALOG}


def prefs_key(owner: str) -> str:
    return "providers" if owner == "local" else f"providers:{owner}"


def get_prefs(db: Session, owner: str) -> dict:
    row = db.get(KeyValue, prefs_key(owner))
    return dict(row.value) if row else {}


def save_prefs(db: Session, owner: str, prefs: dict):
    row = db.get(KeyValue, prefs_key(owner))
    if row:
        row.value = prefs
    else:
        db.add(KeyValue(key=prefs_key(owner), value=prefs))
    db.commit()


def provider_state(db: Session, owner: str, pid: str) -> dict:
    base = next(p for p in CATALOG if p["id"] == pid)
    pref = get_prefs(db, owner).get(pid, {})
    models = pref.get("models") or base["models"]
    return {"enabled": pref.get("enabled", pid in ("gemini", "groq", "ollama", "openai", "huggingface")),
            "defaultModel": pref.get("defaultModel") or base["defaultModel"], "models": models,
            "modelsSyncedAt": pref.get("modelsSyncedAt")}


def resolve_model(db: Session, owner: str, provider: str, model: str | None) -> tuple[str, bool]:
    """Modelo efetivo (vazio = padrão do provedor) e se o provedor está ativo."""
    st = provider_state(db, owner, provider)
    return (model or st["defaultModel"]), st["enabled"]


async def list_remote_models(provider: str, api_key: str | None) -> list[dict]:
    """Consulta a API do provedor e devolve os modelos de geração de texto disponíveis para a chave."""
    async with httpx.AsyncClient(timeout=20) as c:
        if provider == "gemini":
            r = await c.get("https://generativelanguage.googleapis.com/v1beta/models", params={"key": api_key, "pageSize": 1000})
            r.raise_for_status()
            out = []
            for m in r.json().get("models", []):
                if "generateContent" not in (m.get("supportedGenerationMethods") or []):
                    continue
                mid = str(m.get("name", "")).removeprefix("models/")
                out.append({"id": mid, "name": m.get("displayName") or mid, "contextWindow": m.get("inputTokenLimit"),
                            "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["disponível na sua chave"]})
            return out
        if provider in ("groq", "openai"):
            url = "https://api.groq.com/openai/v1/models" if provider == "groq" else "https://api.openai.com/v1/models"
            r = await c.get(url, headers={"Authorization": f"Bearer {api_key}"})
            r.raise_for_status()
            ids = sorted(m["id"] for m in r.json().get("data", []) if m.get("active", True))
            if provider == "openai":
                ids = [i for i in ids if i.startswith(("gpt", "o1", "o3", "o4", "o5", "chatgpt"))]
            return [{"id": i, "name": i, "contextWindow": None, "inputPer1M": None, "outputPer1M": None, "priceIsEstimate": True, "tags": ["disponível na sua chave"]} for i in ids]
        if provider == "ollama":
            r = await c.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
            r.raise_for_status()
            return [{"id": m["name"], "name": f"{m['name']} (local)", "contextWindow": None, "inputPer1M": 0, "outputPer1M": 0, "priceIsEstimate": False, "tags": ["local"]}
                    for m in r.json().get("models", [])]
    raise ValueError("Listagem automática não disponível para este provedor; informe o id do modelo manualmente.")
