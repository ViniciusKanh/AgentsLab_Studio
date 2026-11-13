"""
Substitutos determinísticos de LLM e ferramentas — USADOS SOMENTE EM TESTES AUTOMATIZADOS
(pytest e e2e). Nunca são carregados pelo app em uso normal.
"""
import asyncio
import json

from app.services.llm import LLMResult, MissingCredential, TransientLLMError
from app.services.tools import Source

PLAN = {
    "objetivo": "Mapear aplicações de IA na aeronáutica", "escopo": "Literatura 2019+", "subtemas": ["manutenção preditiva", "visão computacional"],
    "entregaveis": ["Relatório técnico"], "criterios_qualidade": ["citações verificáveis"],
    "tarefas": [
        {"chave": "T1", "titulo": "Pesquisar manutenção preditiva", "descricao": "Literatura científica", "tipo": "pesquisa", "agente_id": "@Pesquisador Científico", "depende_de": [], "entregavel": "Achados"},
        {"chave": "T2", "titulo": "Pesquisar aplicações em inspeção", "descricao": "Casos aeronáuticos", "tipo": "pesquisa", "agente_id": "@Pesquisador de Aplicações", "depende_de": [], "entregavel": "Achados"},
        {"chave": "T3", "titulo": "Comparar abordagens", "descricao": "Tabela comparativa", "tipo": "analise", "agente_id": "@Analista Técnico", "depende_de": ["T1", "T2"], "entregavel": "Análise"},
        {"chave": "T4", "titulo": "Redigir relatório", "descricao": "Documento final", "tipo": "redacao", "agente_id": "@Redator Técnico-Científico", "depende_de": ["T3"], "entregavel": "Relatório"},
        {"chave": "T5", "titulo": "Revisar relatório", "descricao": "Qualidade", "tipo": "revisao", "agente_id": "@Revisor Científico", "depende_de": ["T4"], "entregavel": "Parecer"},
    ],
}


def plan_for(prompt: str) -> dict:
    """Troca "@Papel" pelo id real do agente listado no prompt do coordenador."""
    import re

    by_role = {m.group(3).strip(): m.group(1) for m in re.finditer(r"- id=(\S+) \| ([^|]+)\| ([^|]+)\|", prompt)}
    plan = json.loads(json.dumps(PLAN))
    for t in plan["tarefas"]:
        if t["agente_id"].startswith("@"):
            t["agente_id"] = by_role.get(t["agente_id"][1:], "desconhecido")
    return plan


class FakeLLM:
    """Respostas determinísticas por finalidade. Usado apenas em testes automatizados."""

    def __init__(self, delay: float = 0.0, transient_failures: int = 0, slow: dict | None = None):
        self.calls = []
        self.reviews = 0
        self.delay = delay
        self.transient_failures = transient_failures  # quantas chamadas iniciais falham com 429
        self.slow = slow or {}  # atraso extra por finalidade (testes de tempo limite)
        self.active = 0
        self.max_active = 0
        self.spans: list[tuple[str, float, float]] = []  # (finalidade, início, fim) — paralelismo

    async def complete(self, *, provider, model, api_key, messages, temperature=0.3, max_tokens=2048, json_mode=False, purpose="", timeout=120):
        import time

        if provider != "ollama" and not api_key:
            raise MissingCredential(f"Nenhuma chave configurada para {provider}")
        if self.transient_failures > 0:
            self.transient_failures -= 1
            raise TransientLLMError(f"{provider}/{model}: 429 RESOURCE_EXHAUSTED (simulado no teste)")
        self.calls.append((purpose, messages[-1]["content"]))
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        t0 = time.monotonic()
        try:
            if self.delay or purpose in self.slow:
                await asyncio.sleep(self.delay + self.slow.get(purpose, 0))
        finally:
            self.active -= 1
        self.spans.append((purpose, t0, time.monotonic()))
        text = {
            "plan": json.dumps(plan_for(messages[-1]["content"])),
            "queries": json.dumps({"consultas": ["predictive maintenance aircraft machine learning"], "ano_minimo": 2019}),
            "findings": "## Achados\nModelos LSTM preveem falhas em motores [E1]. Inspeção por visão computacional [E2].",
            "analysis": "## Análise\n| Abordagem | Fonte |\n|---|---|\n| LSTM | [E1] |\n| CNN | [E2] |",
            "report": "# Relatório\nA IA melhora a manutenção [E1] e a inspeção [E2]. Afirmação inventada [E99].\n## Referências\n- referência inventada pelo modelo",
            "revision": "# Relatório (revisado)\nA IA melhora a manutenção [E1] e a inspeção [E2].",
            "chat": "Olá! Sou o agente e posso ajudar.",
        }.get(purpose, "ok")
        if purpose == "review":
            self.reviews += 1
            text = json.dumps({"aprovado": self.reviews > 1, "resumo": "ok", "problemas": [], "afirmacoes_sem_evidencia": []})
        return LLMResult(text, 100, 50, 0.001, True, provider, model, 5)


class FakeTools:
    """Fontes fixas. verify(): a fonte com DOI é "verificada"; a do arXiv sem DOI fica "nao_confirmada"."""

    def __init__(self):
        self.searches = []

    async def verify(self, src):
        if src.doi:
            return "verificada", f"DOI {src.doi} confirmado (teste)"
        return "nao_confirmada", "Sem DOI; identificador não confirmado (teste)"

    async def search(self, query, limit=5, from_year=None):
        self.searches.append(query)
        return [Source("openalex", "Deep learning for aircraft engine prognostics", ["A. Silva"], 2021, "10.1000/abc", "https://doi.org/10.1000/abc", "LSTM for RUL."),
                Source("arxiv", "Visual inspection of fuselage with CNNs", ["B. Souza"], 2022, "", "https://arxiv.org/abs/2201.00001", "CNN inspection.")]
