# Vyapari Frontend

## Local Quick Start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

## Required Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk frontend publishable key
- `VITE_API_BASE_URL`: Backend API base URL (for example `http://localhost:8000`)

## Build for Deployment

```bash
npm run build
```

The production-ready static assets are generated in `frontend/dist`.
