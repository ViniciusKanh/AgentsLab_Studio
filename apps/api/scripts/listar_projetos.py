"""
Diagnóstico: lista os projetos gravados no banco configurado em apps/api/.env
(dono, status, tarefas e documentos). Somente leitura — não altera nada.

Uso (PowerShell, na pasta apps/api com o ambiente virtual ativo):
    python scripts/listar_projetos.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.db import session_scope  # noqa: E402
from app.models import Artifact, Organization, Project, Task  # noqa: E402


def main():
    with session_scope() as s:
        orgs = {o.id: o for o in s.scalars(select(Organization))}
        owners = s.execute(select(Organization.owner_id, func.count()).group_by(Organization.owner_id)).all()
        print("Donos (owner_id) com organizações:")
        for owner, n in owners:
            print(f"  {owner}  ({n} organização(ões))")
        projects = list(s.scalars(select(Project).order_by(Project.created_at)))
        print(f"\n{len(projects)} projeto(s):")
        for p in projects:
            tasks = s.scalar(select(func.count()).select_from(Task).where(Task.project_id == p.id)) or 0
            docs = s.scalar(select(func.count()).select_from(Artifact).where(Artifact.project_id == p.id)) or 0
            org = orgs.get(p.organization_id)
            print(f"  {p.id} | {p.status:<17} | dono {p.owner_id} | {tasks} tarefas, {docs} documentos | {org.name if org else '—'} | {p.created_at:%d/%m %H:%M} | {p.title[:60]}")


if __name__ == "__main__":
    main()
