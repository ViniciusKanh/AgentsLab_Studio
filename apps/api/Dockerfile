# API do AgentsLab_Studio para servidores (Render, Fly.io, Railway, Hugging Face Spaces Docker)
# e para distribuição versionada via GitHub Container Registry (GHCR).
# Imagem publicada: ghcr.io/viniciuskanh/agentslab-api (ver .github/workflows/docker-publish.yml)
#
# Banco: Supabase PostgreSQL (AGENTSLAB_DATABASE_URL). Chaves dos usuários: cofre "db" (Fernet)
# com AGENTSLAB_MASTER_KEY definido nos segredos do serviço. Nenhum segredo é definido aqui.
#
# Base fixada em python:3.12-slim-bookworm (Debian 12) para build reprodutível. Para fixar
# também por digest (reprodutibilidade máxima, recomendado em produção):
#   docker pull python:3.12-slim-bookworm
#   docker inspect --format='{{index .RepoDigests 0}}' python:3.12-slim-bookworm
# e troque a linha FROM por "python:3.12-slim-bookworm@sha256:<digest-obtido>".
FROM python:3.12-slim-bookworm

# Metadados OCI estáticos — garantem que até um `docker build` isolado produza uma imagem
# rastreável até o repositório. Em CI, docker/metadata-action acrescenta revision/created/version
# (ver .github/workflows/docker-publish.yml), sem conflitar com os valores abaixo.
LABEL org.opencontainers.image.title="AgentsLab_Studio API" \
      org.opencontainers.image.description="Backend FastAPI do AgentsLab_Studio: orquestracao de organizacoes virtuais multiagentes de IA (agentes, projetos, execucao, documentos, autenticacao Supabase)." \
      org.opencontainers.image.source="https://github.com/ViniciusKanh/AgentsLab_Studio" \
      org.opencontainers.image.url="https://github.com/ViniciusKanh/AgentsLab_Studio" \
      org.opencontainers.image.documentation="https://github.com/ViniciusKanh/AgentsLab_Studio/blob/main/docs/DEPLOY.md" \
      org.opencontainers.image.vendor="ViniciusKanh" \
      org.opencontainers.image.authors="Vinicius Santos"

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    AGENTSLAB_SECRET_BACKEND=db AGENTSLAB_DATA_DIR=/tmp/agentslab PORT=8000

WORKDIR /app

# Dependências primeiro (cache de camadas); versões fixadas pelo lock (reprodutibilidade)
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.txt -c requirements.lock.txt

COPY app ./app

# Usuário não privilegiado, com UID/GID fixos (reprodutível entre builds e hosts) e sem shell
# de login. /tmp/agentslab é o AGENTSLAB_DATA_DIR padrão — criado e já pertencente ao appuser.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser \
    && mkdir -p /tmp/agentslab \
    && chown -R appuser:appuser /app /tmp/agentslab

USER appuser

EXPOSE 8000

# Checagem de saúde via stdlib (sem instalar curl/wget na imagem). Usa a mesma porta de PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:' + os.environ.get('PORT','8000') + '/health', timeout=3)"

# HF Spaces usa a porta 7860: defina PORT=7860 nas variáveis do Space.
# "exec" entrega SIGTERM/SIGINT diretamente ao uvicorn (PID 1), garantindo encerramento ordenado
# (sem isso, o shell intermediário absorve o sinal e o processo é morto de forma abrupta).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
