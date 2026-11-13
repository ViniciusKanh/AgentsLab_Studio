"""
Substitutos determinísticos de LLM e ferramentas — USADOS SOMENTE EM TESTES AUTOMATIZADOS
(pytest e e2e). Nunca são carregados pelo app em uso normal.
"""
import asyncio
import json

from app.services.llm import LLMResult, MissingCredential
from app.services.tools import Source

PLAN = {
    "objetivo": "Mapear aplicações de IA na aeronáutica", "escopo": "Literatura 2019+", "subtemas": ["manutenção preditiva", "visão computacional"],
    "entregaveis": ["Relatório técnico"], "criterios_qualidade": ["citações verificáveis"],
    "tarefas": [
        {"chave": "T1", "titulo": "Pesquisar manutenção preditiva", "descricao": "Literatura científica", "tipo": "pesquisa", "agente_id": "ag-pesq-cientifico", "depende_de": [], "entregavel": "Achados"},
        {"chave": "T2", "titulo": "Pesquisar aplicações em inspeção", "descricao": "Casos aeronáuticos", "tipo": "pesquisa", "agente_id": "ag-pesq-aero", "depende_de": [], "entregavel": "Achados"},
        {"chave": "T3", "titulo": "Comparar abordagens", "descricao": "Tabela comparativa", "tipo": "analise", "agente_id": "ag-analista-tec", "depende_de": ["T1", "T2"], "entregavel": "Análise"},
        {"chave": "T4", "titulo": "Redigir relatório", "descricao": "Documento final", "tipo": "redacao", "agente_id": "ag-redator", "depende_de": ["T3"], "entregavel": "Relatório"},
        {"chave": "T5", "titulo": "Revisar relatório", "descricao": "Qualidade", "tipo": "revisao", "agente_id": "ag-revisor-cient", "depende_de": ["T4"], "entregavel": "Parecer"},
    ],
}


class FakeLLM:
    """Respostas determinísticas por finalidade. Usado apenas em testes automatizados."""

    def __init__(self, delay: float = 0.0):
        self.calls = []
        self.reviews = 0
        self.delay = delay

    async def complete(self, *, provider, model, api_key, messages, temperature=0.3, max_tokens=2048, json_mode=False, purpose=""):
        if provider != "ollama" and not api_key:
            raise MissingCredential(f"Nenhuma chave configurada para {provider}")
        self.calls.append((purpose, messages[-1]["content"]))
        if self.delay:
            await asyncio.sleep(self.delay)
        text = {
            "plan": json.dumps(PLAN),
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
    async def search(self, query, limit=5, from_year=None):
        return [Source("openalex", "Deep learning for aircraft engine prognostics", ["A. Silva"], 2021, "10.1000/abc", "https://doi.org/10.1000/abc", "LSTM for RUL."),
                Source("arxiv", "Visual inspection of fuselage with CNNs", ["B. Souza"], 2022, "", "https://arxiv.org/abs/2201.00001", "CNN inspection.")]
