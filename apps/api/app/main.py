"""Ponto de entrada da API. Execução local: uvicorn app.main:app --reload --port 8000"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import credentials, health, planned

app = FastAPI(title="AgentsLab_Studio API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
app.include_router(credentials.router)
app.include_router(planned.router)
