# Vyapari Backend

## Local Quick Start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn run:app --reload --host 0.0.0.0 --port 8000
```

## Environment Variables

- `CORS_ALLOW_ORIGINS`: Comma-separated frontend origins allowed by CORS (default: `http://localhost:5173`)
- `DEMO_AUTH_ENABLED`: `true` to allow demo token flow, `false` to require real Clerk JWT verification
- `CLERK_ISSUER`: Optional Clerk issuer override for JWT verification
- `CLERK_AUDIENCE`: Optional Clerk audience for JWT verification
- `CLERK_WEBHOOK_SECRET`: Required for `/webhooks/clerk` signature verification

Use `.env.example` as a starting point for deployment environments.

## Deployment

For production deployment (Render backend + Vercel frontend + Clerk setup), see:

- `../DEPLOYMENT.md`

## Production Start Command

```bash
uvicorn run:app --host 0.0.0.0 --port 8000
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
