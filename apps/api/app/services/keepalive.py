"""
Mantém o servidor acordado em hospedagens gratuitas que hibernam sem tráfego (ex.: Render free,
que dorme após ~15 min sem requisições e interromperia agentes em execução).

O próprio servidor acessa periodicamente o seu endereço PÚBLICO (/health). Ativado apenas quando há
URL pública: AGENTSLAB_KEEPALIVE_URL ou RENDER_EXTERNAL_URL (definida automaticamente pelo Render).
Modos (AGENTSLAB_KEEPALIVE_MODE):
  - "always": sempre acordado (sem espera ao abrir o app; ~744 h/mês de instância);
  - "busy":   só enquanto houver projeto em execução (economiza horas; o app leva ~1 min para acordar);
  - "off":    desativado.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

from app.config import settings

log = logging.getLogger("agentslab.keepalive")


def public_url() -> str:
    return (settings.keepalive_url or os.environ.get("RENDER_EXTERNAL_URL", "")).strip().rstrip("/")


def should_ping(mode: str, busy: bool) -> bool:
    return mode == "always" or (mode == "busy" and busy)


async def keepalive_loop(is_busy) -> None:
    url, mode = public_url(), settings.keepalive_mode
    if not url or mode == "off":
        return
    log.info("keep-alive ativo (%s) para %s/health a cada %ss", mode, url, settings.keepalive_interval_sec)
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            await asyncio.sleep(settings.keepalive_interval_sec)
            if not should_ping(mode, is_busy()):
                continue
            try:
                await client.get(f"{url}/health")
            except Exception as exc:  # falha pontual de rede não derruba o servidor
                log.warning("keep-alive falhou: %s", exc)
