"""
Gateway de LLM (LiteLLM). Cada agente usa seu provedor, modelo e perfil de chave.
Registra tokens, custo (estimado pelo LiteLLM quando a tarifa é conhecida) e latência.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Protocol

from app.config import settings


class LLMError(RuntimeError):
    pass


class MissingCredential(LLMError):
    pass


class TransientLLMError(LLMError):
    """Erro temporário do provedor (limite de taxa, indisponibilidade, timeout): pode ser repetido."""


_TRANSIENT = ("ratelimit", "rate limit", "rate_limit", "429", "resource_exhausted", "resource has been exhausted", "quota exceeded per minute",
              "serviceunavailable", "service unavailable", "503", "502", "500", "internalservererror", "overloaded", "timeout", "timed out",
              "apiconnectionerror", "connection error")


def is_transient(exc: Exception) -> bool:
    low = f"{type(exc).__name__} {exc}".lower()
    return any(k in low for k in _TRANSIENT)


@dataclass
class LLMResult:
    text: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    cost_is_estimate: bool
    provider: str
    model: str
    latency_ms: int


class LLMGateway(Protocol):
    async def complete(self, *, provider: str, model: str, api_key: str | None, messages: list[dict],
                       temperature: float = 0.3, max_tokens: int = 2048, json_mode: bool = False, purpose: str = "", timeout: float = 120) -> LLMResult: ...


def litellm_model(provider: str, model: str) -> str:
    if provider == "openai":
        return model
    if provider == "huggingface":
        return f"huggingface/{model}"
    return f"{provider}/{model}"


class LiteLLMGateway:
    async def complete(self, *, provider, model, api_key, messages, temperature=0.3, max_tokens=2048, json_mode=False, purpose="", timeout=120):
        import litellm

        if provider != "ollama" and not api_key:
            raise MissingCredential(f"Nenhuma chave configurada para {provider}. Cadastre em Provedores e Custos → Chaves.")
        kwargs: dict = dict(model=litellm_model(provider, model), messages=messages, temperature=temperature, max_tokens=max_tokens, timeout=timeout)
        if api_key:
            kwargs["api_key"] = api_key
        if provider == "ollama":
            kwargs["api_base"] = settings.ollama_base_url
        if json_mode and provider in ("openai", "groq", "gemini"):
            kwargs["response_format"] = {"type": "json_object"}
        t0 = time.perf_counter()
        try:
            resp = await litellm.acompletion(**kwargs)
        except Exception as exc:  # erros do provedor viram mensagens claras
            low = str(exc).lower()
            if "no longer available" in low or "notfounderror" in low or "not found" in low and "model" in low:
                raise LLMError(f"O modelo {provider}/{model} não está disponível para a sua chave (descontinuado ou inexistente). "
                               "Abra Provedores e Custos → Atualizar lista de modelos (mostra só os que funcionam) e depois use Reanalisar no projeto. "
                               f"Detalhe: {str(exc)[:300]}") from exc
            if is_transient(exc):
                raise TransientLLMError(f"{provider}/{model}: {exc}") from exc
            raise LLMError(f"{provider}/{model}: {exc}") from exc
        latency = int((time.perf_counter() - t0) * 1000)
        text = resp.choices[0].message.content or ""
        usage = getattr(resp, "usage", None)
        tin = int(getattr(usage, "prompt_tokens", 0) or 0)
        tout = int(getattr(usage, "completion_tokens", 0) or 0)
        try:
            cost = float(litellm.completion_cost(completion_response=resp) or 0.0)
        except Exception:
            cost = 0.0
        return LLMResult(text, tin, tout, cost, True, provider, model, latency)


_gateway: LLMGateway | None = None


def get_gateway() -> LLMGateway:
    global _gateway
    if _gateway is None:
        _gateway = LiteLLMGateway()
    return _gateway


def set_gateway(g: LLMGateway | None):
    global _gateway
    _gateway = g


def parse_json(text: str) -> dict:
    """Extrai o primeiro objeto JSON da resposta (tolera ```json ... ```)."""
    t = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", t, re.S)
    if m:
        t = m.group(1)
    start, end = t.find("{"), t.rfind("}")
    if start < 0 or end < 0:
        raise LLMError("Resposta do modelo não contém JSON")
    try:
        return json.loads(t[start : end + 1])
    except json.JSONDecodeError as exc:
        raise LLMError(f"JSON inválido na resposta do modelo: {exc}") from exc
