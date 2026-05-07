# Deployment Guide (Vercel + Render)

This project is configured for:
- **Frontend:** Vercel (root directory: `frontend`)
- **Backend:** Render Web Service (root directory: `backend`)

## 1) Deploy backend on Render

1. In Render, create a new Blueprint or Web Service from this repository.
2. Use `render.yaml` from repo root (recommended), or set manually:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn run:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/health`
3. Set environment variables:
   - `DEMO_AUTH_ENABLED` (`false` for production, optional `true` for demo mode)
   - `CORS_ALLOW_ORIGINS` (comma-separated, include frontend URL)
   - `CLERK_ISSUER`
   - `CLERK_AUDIENCE`
   - `CLERK_WEBHOOK_SECRET`
4. Deploy and copy backend URL (example: `https://vyapari-backend.onrender.com`).

## 2) Deploy frontend on Vercel

1. Import repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. `frontend/vercel.json` is included for Vite + SPA routing.
4. Set environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_BASE_URL` = deployed backend URL from Render
5. Deploy and copy frontend URL.

## 3) Configure Clerk

1. In Clerk dashboard, add frontend deployed domain to allowed origins/redirect URLs.
2. Set webhook endpoint to:
   - `https://<your-backend-domain>/webhooks/clerk`
3. Use the signing secret from Clerk as backend `CLERK_WEBHOOK_SECRET`.

## 4) Post-deploy smoke checks

1. Backend health:
   - `GET https://<your-backend-domain>/health` returns `200`.
2. Frontend loads:
   - Open deployed frontend URL and verify pages render.
3. Frontend ↔ backend connectivity:
   - Verify product/recommendation/inventory calls succeed.
4. Authentication and route protection:
   - Sign in/out works.
   - Role-based/protected routes behave correctly.
