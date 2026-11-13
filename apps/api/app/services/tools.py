"""
Ferramentas reais de pesquisa (sem chave de API):
  - OpenAlex (https://openalex.org): metadados acadêmicos, DOI, resumo.
  - arXiv (https://arxiv.org): preprints.
Somente resumos/metadados são obtidos — o sistema registra full_text=False.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Protocol

import httpx

# Cabeçalhos HTTP precisam ser ASCII.
UA = {"User-Agent": "AgentsLab_Studio/1.2 (academic research assistant)"}


@dataclass
class Source:
    source: str
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    doi: str = ""
    url: str = ""
    abstract: str = ""


class ResearchTools(Protocol):
    async def search(self, query: str, limit: int = 5, from_year: int | None = None) -> list[Source]: ...


def _openalex_abstract(inv: dict | None) -> str:
    if not inv:
        return ""
    pos: list[tuple[int, str]] = []
    for word, idxs in inv.items():
        for i in idxs:
            pos.append((i, word))
    return " ".join(w for _, w in sorted(pos))[:2500]


class WebResearchTools:
    def __init__(self, timeout: float = 25.0):
        self.timeout = timeout

    async def openalex(self, query: str, limit: int, from_year: int | None) -> list[Source]:
        params = {"search": query, "per-page": str(limit), "select": "title,authorships,publication_year,doi,id,abstract_inverted_index,primary_location"}
        if from_year:
            params["filter"] = f"from_publication_date:{from_year}-01-01"
        async with httpx.AsyncClient(timeout=self.timeout, headers=UA) as c:
            r = await c.get("https://api.openalex.org/works", params=params)
            r.raise_for_status()
        out = []
        for w in r.json().get("results", []):
            loc = (w.get("primary_location") or {}).get("landing_page_url") or w.get("id", "")
            out.append(Source("openalex", w.get("title") or "(sem título)", [a["author"]["display_name"] for a in (w.get("authorships") or [])[:6] if a.get("author")],
                              w.get("publication_year"), (w.get("doi") or "").replace("https://doi.org/", ""), loc, _openalex_abstract(w.get("abstract_inverted_index"))))
        return out

    async def arxiv(self, query: str, limit: int) -> list[Source]:
        q = "all:" + "+AND+all:".join(re.findall(r"\w+", query)[:6])
        async with httpx.AsyncClient(timeout=self.timeout, headers=UA, follow_redirects=True) as c:
            r = await c.get(f"https://export.arxiv.org/api/query?search_query={q}&max_results={limit}&sortBy=relevance")
            r.raise_for_status()
        ns = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
        out = []
        for e in ET.fromstring(r.text).findall("a:entry", ns):
            title = " ".join((e.findtext("a:title", "", ns) or "").split())
            year = (e.findtext("a:published", "", ns) or "")[:4]
            doi = e.findtext("arxiv:doi", "", ns) or ""
            out.append(Source("arxiv", title, [a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)][:6],
                              int(year) if year.isdigit() else None, doi, e.findtext("a:id", "", ns) or "", " ".join((e.findtext("a:summary", "", ns) or "").split())[:2500]))
        return out

    async def search(self, query, limit=5, from_year=None):
        results: list[Source] = []
        errors = []
        for fn in (lambda: self.openalex(query, limit, from_year), lambda: self.arxiv(query, max(2, limit // 2))):
            try:
                results += await fn()
            except Exception as exc:  # uma fonte fora do ar não derruba a pesquisa
                errors.append(str(exc))
        if not results and errors:
            raise RuntimeError("Fontes de pesquisa indisponíveis: " + "; ".join(errors))
        return results


_tools: ResearchTools | None = None


def get_tools() -> ResearchTools:
    global _tools
    if _tools is None:
        _tools = WebResearchTools()
    return _tools


def set_tools(t: ResearchTools | None):
    global _tools
    _tools = t
