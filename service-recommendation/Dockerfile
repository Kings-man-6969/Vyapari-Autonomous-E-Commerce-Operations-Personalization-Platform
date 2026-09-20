FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 --retries=10 torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --default-timeout=1000 --retries=10 -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
