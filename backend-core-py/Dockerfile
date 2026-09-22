FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS runtime
RUN useradd -r -u 1001 -s /bin/false vyapari && \
    mkdir -p /app && \
    chown -R vyapari:vyapari /app

COPY --chown=vyapari:vyapari app/ ./app/

USER vyapari

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f --head -H "Host: api.vyapari.live" http://127.0.0.1:${PORT:-8000}/health/live || curl -f --head http://127.0.0.1:${PORT:-8000}/health/live || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 4"]
