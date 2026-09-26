FROM python:3.11-slim

LABEL org.opencontainers.image.title="Vyapari Seller Agent Operations Service" \
      org.opencontainers.image.description="Team B AI Agentic microservice powered by Google Gemini, Celery, and asyncpg" \
      org.opencontainers.image.version="1.1.0" \
      org.opencontainers.image.vendor="Vyapari"

WORKDIR /app

# Install security updates and curl for health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create unprivileged system user & group (UID 10001)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -m appuser

# Copy application code and assign ownership
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health/live', timeout=2)" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]
