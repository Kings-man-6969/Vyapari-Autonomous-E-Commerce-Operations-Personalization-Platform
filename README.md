# Vyapari - Autonomous E-Commerce Operations (MVP Scaffold)

This repository is a starter implementation derived from `Vyapari_TRD_Improved_v1.1.md`.

Current maturity: MVP vertical slice with customer APIs, JWT auth with refresh-cookie sessions, role-based Seller/HITL protection, cart flow, recommendation fallback, Seller CRUD modules, and HITL decision workflow endpoints.

## Quickstart (Backend)

1. Create/use the project-local virtualenv and install dependencies:

```powershell
python -m venv venv
venv\Scripts\python.exe -m pip install -r backend/requirements.txt
```

1. Run the backend:

```powershell
cd backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

1. Run migrations (new database):

```powershell
cd backend
..\venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

1. If your local DB already existed before Alembic setup, baseline it once:

```powershell
cd backend
..\venv\Scripts\python.exe -m alembic -c alembic.ini stamp 001_initial_schema
..\venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

1. Current Alembic chain seeds demo data and adds refresh/seller tables:

```powershell
cd backend
..\venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

1. Run backend tests:

```powershell
cd backend
..\venv\Scripts\python.exe -m pytest -q
```

## Quickstart (Frontend)

```powershell
cd frontend
npm install
npm run dev
```

## Authentication and Roles

- Login endpoint: `POST /auth/login`
- Refresh endpoint: `POST /auth/refresh`
- Identity endpoint: `GET /auth/me`
- Access tokens use `Authorization: Bearer <token>`
- Refresh tokens are stored in an httpOnly `refresh_token` cookie and rotated on login
- Seller/Admin protected routes: `GET /stats`, all `/hitl/*`

Demo credentials:

- Admin: `admin@vyapari.local` / `admin123`
- Seller: `seller@vyapari.local` / `seller123`
- Customer: `customer@vyapari.local` / `customer123`

## Implemented API Endpoints

- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `GET /products` with `category`, `sort`, `in_stock`, `page`, `per_page`
- `GET /products/{product_id}`
- `POST /products/seller`
- `PUT /products/{product_id}/seller`
- `GET /products/seller/inventory`
- `POST /products/{product_id}/price`
- `GET /products/{product_id}/price-history`
- `GET /search?q=&top_n=`
- `GET /recommendations/{session_id}?top_n=`
- `POST /reviews`
- `POST /reviews/{review_id}/response`
- `GET /reviews/seller/pending`
- `GET /cart?session_id=`
- `POST /cart/add?session_id=`
- `GET /stats` (protected)
- `GET /hitl/decisions` (protected)
- `GET /hitl/decisions/{decision_id}` (protected)
- `POST /hitl/decisions/{decision_id}/approve` (protected)
- `POST /hitl/decisions/{decision_id}/reject` (protected)
- `GET /hitl/history` (protected)
- `GET /hitl/analytics` (protected)

## Frontend Pages

- Seller overview
- Seller inventory
- Seller pricing
- Seller review manager
- HITL queue
- HITL decision detail
- HITL history
- HITL analytics
- JWT login/logout, refresh-cookie session restore, and route-based navigation

## Key Project Paths

- `backend/` - FastAPI app, SQLAlchemy models, Alembic migrations, tests
- `frontend/` - Vite + React app with Seller/HITL pages
- `infra/docker-compose.yml` - local compose stub
