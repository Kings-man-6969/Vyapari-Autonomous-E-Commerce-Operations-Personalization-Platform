# Vyapari Project Details

## Overview
Vyapari is a local-demo, AI-assisted e-commerce operations platform with three isolated user surfaces:

- Customer dashboard for browsing, search, cart, orders, profile, and review submission.
- Seller dashboard for inventory, pricing, analytics, and operational stats.
- HITL dashboard for review approvals, decision queue handling, and agent settings.

The current implementation uses FastAPI on the backend, React + Vite on the frontend, SQLite for persistence, and Clerk for frontend authentication flow. Demo auth still uses the temporary demo JWT format, but the backend now fail-closes when `DEMO_AUTH_ENABLED=false`.

## Tech Stack

### Frontend
- React
- Vite
- TypeScript
- React Router
- Clerk React SDK
- Local role/session storage for portal isolation

### Backend
- FastAPI
- SQLAlchemy
- SQLite
- Pydantic
- Role-based dependencies and request validation

### Dev and Ops
- Windows PowerShell launcher script
- Backend compile checks
- Frontend production build checks

## Frontend Development Requirements

### Routing and UX
- Landing page must force a role selection before auth actions.
- Customer, seller, and HITL routes must remain isolated.
- Protected routes must verify Clerk sign-in and backend role match.
- Logout and role switch must clear the active role session.

### Main Frontend Pages
- Landing page for role selection and Clerk auth.
- Customer home, catalog/search, product detail, cart, profile, and orders pages.
- Seller overview, inventory, reviews, and analytics pages.
- HITL queue, review approvals, audit log, and agent settings pages.

### Frontend Session Rules
- Session data is stored by role.
- Active role is tracked separately from the token.
- Customer and seller sessions must not be reused across portals.
- Session expiration should be respected before making backend calls.

### Frontend-to-Backend Connection Rules
- All API calls go through the shared API client.
- The API client attaches the bearer token from the active role session.
- Customer pages call customer-only endpoints.
- Seller and HITL pages call seller-only endpoints.

## Backend Development Requirements

### API Expectations
- Keep request and response models typed.
- Enforce seller and customer access on the backend, not only in the UI.
- Reject writes that violate safety guardrails.
- Fail closed when demo auth is disabled.

### Business Rules
- Price must remain above the configured cost margin.
- Negative stock must be rejected.
- Reviews should go through moderation or escalation.
- Decision records should not be duplicated for the same pending action.

### Data Requirements
- Seed data should create a usable demo catalog and agent settings record.
- Persist auth account role mapping per Clerk ID.
- Store cart items, orders, reviews, decisions, and settings in SQLite.

## Endpoints

### Auth
- `POST /auth/register` registers a Clerk user ID with a portal role and returns a demo token.
- `GET /auth/me` returns the active Clerk ID and role for the current bearer token.

### Customer
- `GET /products` lists products.
- `GET /products/{product_id}` returns product details and reviews.
- `GET /search?q=...&top_n=8` searches products.
- `GET /recommendations/{user_id}?top_n=6` returns personalized or fallback recommendations.
- `GET /cart` returns the current customer cart.
- `POST /cart/add` adds an item to the cart.
- `GET /me/profile` returns the customer profile.
- `GET /me/orders` returns customer orders.
- `POST /reviews` submits a customer review.

### Seller and HITL
- `GET /stats` returns seller KPIs.
- `GET /inventory` returns inventory with health fields.
- `POST /inventory/scan` runs the inventory scan and creates decisions.
- `PATCH /products/{product_id}` updates product fields.
- `POST /products` creates a product.
- `GET /reviews` lists reviews for seller moderation.
- `POST /reviews/process` processes pending reviews.
- `POST /reviews/{review_id}/approve` publishes a drafted response.
- `POST /reviews/{review_id}/reject` rejects a draft.
- `GET /decisions/pending` returns the pending HITL queue.
- `GET /decisions` returns the decision audit log.
- `POST /decisions/{decision_id}/resolve` approves or rejects a decision.
- `GET /settings` returns agent settings.
- `POST /settings` updates agent settings.
- `GET /agent-status` returns the current agent health summary.

## Connection Map

### Frontend to Backend
- `frontend/src/api.ts` is the only shared client for network calls.
- `frontend/src/auth.ts` stores role-scoped demo sessions.
- `frontend/src/pages/LandingPage.tsx` handles role selection, Clerk sign-in, and backend registration.
- `frontend/src/components/ProtectedRoute.tsx` blocks route access until Clerk and backend role checks pass.
- `frontend/src/components/AppLayout.tsx` renders portal-specific navigation and logout controls.

### Backend Flow
- `backend/app/main.py` creates the FastAPI app, CORS setup, and startup seeding.
- `backend/app/api/routes.py` exposes all HTTP endpoints.
- `backend/app/auth.py` handles demo auth parsing and role enforcement.
- `backend/app/db/database.py` owns ORM models and the SQLite session.
- `backend/app/db/seed.py` initializes demo data.
- `backend/app/services/inventory.py` generates and resolves inventory decisions.
- `backend/app/services/reviews.py` processes review sentiment and draft responses.

## Local Run Requirements

### Backend
- Install dependencies from `backend/requirements.txt`.
- Start the API with `uvicorn run:app --reload --port 8000` from the backend folder.

### Frontend
- Install npm dependencies in `frontend`.
- Start the Vite dev server on port `5173`.
- Set `VITE_API_BASE_URL` if the backend is not running on `http://localhost:8000`.
- Set `VITE_CLERK_PUBLISHABLE_KEY` before using Clerk.

### Demo Auth
- `DEMO_AUTH_ENABLED=true` keeps the local demo token flow active.
- `DEMO_AUTH_ENABLED=false` fail-closes the backend until real Clerk JWT verification is implemented.

## Current Implementation Notes
- Seller and customer roles are intentionally isolated.
- Auth must happen after selecting the user type.
- The backend still uses demo JWT tokens until real Clerk JWT verification is wired in.
- Build and compile checks should be treated as the source of truth when editor diagnostics lag.
an