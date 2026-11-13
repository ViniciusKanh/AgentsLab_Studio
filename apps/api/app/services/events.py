"""Eventos persistidos (append-only) + difusão em tempo real para assinantes SSE."""
from __future__ import annotations

import asyncio
from typing import Any

from app.db import session_scope
from app.models import Event


class EventHub:
    def __init__(self):
        self._subs: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subs.discard(q)

    def publish(self, type_: str, payload: dict[str, Any], project_id: str | None = None, owner_id: str = "local") -> dict:
        with session_scope() as s:
            ev = Event(project_id=project_id, owner_id=owner_id, type=type_, payload=payload)
            s.add(ev)
            s.flush()
            data = {"id": ev.id, "type": type_, "projectId": project_id, "payload": payload, "ts": ev.created_at.isoformat(), "_owner": owner_id}
        for q in list(self._subs):
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                pass
        return data


hub = EventHub()
