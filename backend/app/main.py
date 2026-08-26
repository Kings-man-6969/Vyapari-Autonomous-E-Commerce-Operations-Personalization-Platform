import threading
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import Base, engine, SessionLocal
from app.api.v1 import auth, products, cart, orders, reviews, wishlist, seller, hitl, admin, agent
from app.services.recommendation import train_model

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Vyapari API",
    version="2.0.0",
    description="Autonomous E-Commerce Operations & Personalization Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# API v1 Routers
app.include_router(auth.router,     prefix="/api/v1/auth",    tags=["auth"])
app.include_router(products.router, prefix="/api/v1",         tags=["products"])
app.include_router(cart.router,     prefix="/api/v1/cart",    tags=["cart"])
app.include_router(orders.router,   prefix="/api/v1",         tags=["orders"])
app.include_router(reviews.router,  prefix="/api/v1",         tags=["reviews"])
app.include_router(wishlist.router, prefix="/api/v1/wishlist",tags=["wishlist"])
app.include_router(seller.router,   prefix="/api/v1/seller",  tags=["seller"])
app.include_router(hitl.router,     prefix="/api/v1/hitl",    tags=["hitl"])
app.include_router(admin.router,    prefix="/api/v1/admin",   tags=["admin"])
app.include_router(agent.router,    prefix="/api/v1/agent",   tags=["agent"])

# Legacy / direct prefix mounts for testing and client backward compatibility
app.include_router(auth.router,     prefix="/auth",           tags=["auth-direct"])
app.include_router(products.router, prefix="",                tags=["products-direct"])
app.include_router(cart.router,     prefix="/cart",           tags=["cart-direct"])
app.include_router(orders.router,   prefix="",                tags=["orders-direct"])
app.include_router(reviews.router,  prefix="",                tags=["reviews-direct"])
app.include_router(wishlist.router, prefix="/wishlist",       tags=["wishlist-direct"])
app.include_router(seller.router,   prefix="",                tags=["seller-direct"])
app.include_router(hitl.router,     prefix="/hitl",           tags=["hitl-direct"])
app.include_router(admin.router,    prefix="/admin",          tags=["admin-direct"])
app.include_router(agent.router,    prefix="/agent",          tags=["agent-direct"])


@app.on_event("startup")
async def startup_event():
    def _train():
        db = SessionLocal()
        try:
            train_model(db)
        except Exception as e:
            print(f"[Recommendation] Training skipped: {e}")
        finally:
            db.close()
    threading.Thread(target=_train, daemon=True).start()


@app.get("/")
def root():
    return {"message": "Vyapari API v2.0", "docs": "/docs", "status": "running"}


@app.get("/health")
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
