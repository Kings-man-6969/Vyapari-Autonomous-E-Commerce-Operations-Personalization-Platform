# Vyapari Backend (Implementation Bootstrap)

## Quick Start

1. Create virtual environment and install dependencies.
2. Run API server.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn run:app --reload --port 8000
```

## Implemented Endpoints

- `GET /health`
- `GET /products`
- `GET /products/{id}`
- `POST /products`
- `PATCH /products/{id}`
- `GET /search`
- `GET /recommendations/{user_id}`
- `POST /reviews`
- `GET /reviews`
- `POST /reviews/process`
- `POST /reviews/{id}/approve`
- `POST /reviews/{id}/reject`
- `GET /stats`
- `GET /inventory`
- `POST /inventory/scan`
- `GET /decisions/pending`
- `GET /decisions`
- `POST /decisions/{id}/resolve`
- `GET /settings`
- `POST /settings`
- `GET /agent-status`

SQLite DB is automatically initialized and seeded on startup at `backend/data/vyapari.db`.
