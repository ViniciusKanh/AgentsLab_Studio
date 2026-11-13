# API do AgentsLab_Studio para servidores (Render, Fly.io, Railway, Hugging Face Spaces Docker).
# Banco: Supabase PostgreSQL (AGENTSLAB_DATABASE_URL). Chaves dos usuários: cofre "db" (Fernet)
# com AGENTSLAB_MASTER_KEY definido nos segredos do serviço.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    AGENTSLAB_SECRET_BACKEND=db AGENTSLAB_DATA_DIR=/tmp/agentslab PORT=8000
WORKDIR /app
COPY requirements.txt requirements.lock.txt ./
# versões fixadas pelo lock (reprodutibilidade)
RUN pip install --no-cache-dir -r requirements.txt -c requirements.lock.txt
COPY app ./app
RUN useradd -m appuser
USER appuser
EXPOSE 8000
# HF Spaces usa a porta 7860: defina PORT=7860 nas variáveis do Space
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
