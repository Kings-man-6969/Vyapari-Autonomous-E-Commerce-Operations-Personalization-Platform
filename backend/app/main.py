import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import auth, customer, seller, hitl, admin, agent
from .database import Base, engine

# ── Parse allowed origins from environment ───────────────────────
_raw_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Auto-create DB tables on startup (idempotent)."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Vyapari API",
    description="Autonomous E-Commerce Operations & Personalization Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "version": "1.0.0"}

# ── Include Routers ─────────────────────────────────────────────
app.include_router(auth.router,     prefix="/auth",   tags=["auth"])
app.include_router(customer.router,                   tags=["customer"])   # root-level for cart/products
app.include_router(seller.router,                     tags=["seller"])
app.include_router(hitl.router,     prefix="/hitl",   tags=["hitl"])
app.include_router(admin.router,    prefix="/admin",  tags=["admin"])
app.include_router(agent.router,    prefix="/agent",  tags=["agent"])
