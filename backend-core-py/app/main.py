import asyncio
import logging
import re
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth.router import router as auth_router
from app.config import settings
from app.db import close_pool, init_pool
from app.jobs import order_sweep_loop
from app.redis_client import close_redis, init_redis
from app.routers.admin import router as admin_router
from app.routers.ai import router as ai_router
from app.routers.approvals import router as approvals_router
from app.routers.cart import router as cart_router
from app.routers.categories import router as categories_router
from app.routers.health import router as health_router
from app.routers.notifications import router as notifications_router
from app.routers.orders import router as orders_router
from app.routers.payments import router as payments_router
from app.routers.products import router as products_router
from app.routers.variants import router as variants_router
from app.routers.public_pages import router as public_pages_router
from app.routers.reviews import router as reviews_router
from app.routers.seller import router as seller_router
from app.routers.seller_pages import router as seller_pages_router
from app.routers.stores import router as stores_router
from app.routers.telemetry import router as telemetry_router
from app.routers.uploads import router as uploads_router
from app.routers.users import router as users_router
from app.routers.wishlist import router as wishlist_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vyapari-core")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database connection pool...")
    try:
        await init_pool()
        logger.info("Database pool established successfully.")
    except Exception as e:
        logger.warning(f"Could not connect to database on startup: {e}. Will retry on requests.")

    logger.info("Initializing Redis cache connection...")
    try:
        await init_redis()
    except Exception as e:
        logger.warning(f"Could not initialize Redis on startup: {e}. Fallback active.")

    # The abandoned-order sweep. The counterpart to the stock decrement in
    # POST /api/orders: an unpaid order holds real inventory for a limited
    # window, and this is what returns it when the window closes. Cancelled
    # cleanly on shutdown so a container stop does not leave a half-swept batch
    # -- the sweep takes row locks, and a killed process holding those would
    # block the next one until they expire.
    sweep_task = None
    if settings.RUN_ORDER_SWEEP:
        sweep_task = asyncio.create_task(order_sweep_loop(), name="order-sweep")
    else:
        logger.info("Abandoned-order sweep disabled (RUN_ORDER_SWEEP is off)")

    try:
        yield
    finally:
        if sweep_task:
            sweep_task.cancel()
            try:
                await sweep_task
            except asyncio.CancelledError:
                pass
        logger.info("Closing database and Redis connections...")
        await close_pool()
        await close_redis()


app = FastAPI(
    title="Vyapari Core API",
    description="Vyapari Autonomous E-Commerce Operations & Personalization Platform - Core Backend",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE)

# One list, two places it has to appear: the API's own responses (this header,
# and /api/docs) and the static host serving the SPA -- which keeps its copy in
# the deployment config, because Render does not read one from the repository.
# The two have drifted before, and the symptom is a checkout that silently does
# nothing in the browser while every test passes, so the origins that the payment
# flow genuinely needs are named here and in BUILD_CHECKLIST's deployment notes.
#
# checkout.razorpay.com in script-src: the checkout script itself.
# api.razorpay.com in connect-src and frame-src: the payment form is served in an
#   iframe and posts back to Razorpay. Without frame-src the modal renders blank
#   -- no error, no console message on our side, just an empty box.
# checkout.razorpay.com in frame-src: the newer hosted page is framed from here
#   rather than api.razorpay.com depending on the integration mode.
CSP_DIRECTIVES = (
    "default-src 'self'; "
    "script-src 'self' https://checkout.razorpay.com; "
    "style-src 'self' 'unsafe-inline' https://checkout.razorpay.com; "
    "img-src 'self' https: data: blob:; "
    "connect-src 'self' https://api.vyapari.live http://api.vyapari.live https://api.vyapari.com "
    "https://api.razorpay.com https://lumberjack.razorpay.com; "
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; "
    "font-src 'self' https: data:; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self';"
)


@app.middleware("http")
async def security_and_correlation_headers(request: Request, call_next):
    raw_req_id = request.headers.get("X-Request-ID", "").strip()
    if raw_req_id and len(raw_req_id) <= 36 and UUID_REGEX.match(raw_req_id):
        request_id = raw_req_id
    else:
        request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    response = await call_next(request)

    # The rate limiter stashes its Decision on request.state; publish it so
    # clients (and anyone debugging with curl) can see the budget without
    # guessing. Retry-After on a 429 is already set by the limiter itself.
    decision = getattr(request.state, "rate_limit", None)
    if decision is not None:
        response.headers["X-RateLimit-Limit"] = str(decision.limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        if decision.reset_at:
            response.headers["X-RateLimit-Reset"] = str(decision.reset_at)

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = CSP_DIRECTIVES
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


# Global CORS
origins = [
    settings.FRONTEND_URL,
    settings.API_URL,
    "https://api.vyapari.live",
    "http://api.vyapari.live",
    "https://vyapari.live",
    "http://vyapari.live",
    "https://www.vyapari.live",
    "http://www.vyapari.live",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Idempotency-Key",
        "X-Request-ID",
        "X-Vyapari-Client",
    ],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)


# Exception Handlers matching Node.js error middleware
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = "ERROR"
    message = "An error occurred."
    details = None
    data = None

    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "NOT_FOUND" if exc.status_code == 404 else "ERROR")
        message = exc.detail.get("message", "An error occurred.")
        details = exc.detail.get("details")
        # 'data' is the fourth key routes put in a detail dict, and it was being
        # dropped here: 115 raise sites across 18 routers pass structured detail
        # this way -- how much is still refundable, which field failed a check, the
        # current status of a conflicting resource -- and none of it ever reached
        # the client. A frontend asking "how much can I still refund?" got the
        # message with no number in it.
        data = exc.detail.get("data")
    elif isinstance(exc.detail, str):
        if exc.status_code == 404 and exc.detail == "Not Found":
            code = "ROUTE_NOT_FOUND"
            message = f"Cannot {request.method} {request.url.path}"
        else:
            code = "NOT_FOUND" if exc.status_code == 404 else "ERROR"
            message = exc.detail

    # Carry the original headers onto the rewrapped response. This was dropped
    # before: JSONResponse is built fresh, so anything a handler passed via
    # HTTPException(headers=...) - notably Retry-After on a 429, and
    # WWW-Authenticate on a 401 - silently vanished. CORS was even advertising
    # Retry-After in expose_headers for a header that could never be sent.
    headers = dict(exc.headers or {})

    error = {"code": code, "message": message, "details": details}
    # Only when a route supplied it, so the shape of every other error is
    # unchanged for the clients already parsing it.
    if data is not None:
        # Routes hand this straight out of asyncpg rows, so it arrives holding
        # datetimes, UUIDs and Decimals -- none of which json.dumps will take. A
        # 409 whose error body cannot be encoded would be reported as a 500,
        # telling the client the server broke when the server was right.
        try:
            error["data"] = jsonable_encoder(data)
        except Exception:
            error["data"] = {"value": str(data)}

    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": error},
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload.",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"[Unhandled Error] {request.method} {request.url.path}: {exc}")
    message = str(exc) if not settings.is_production else "An unexpected error occurred."
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": message,
                "details": str(exc) if not settings.is_production else None,
            },
        },
    )


# ----------------------------------------------------------------------------
# Root & Health Endpoints
# ----------------------------------------------------------------------------
@app.get("/", tags=["health"])
async def root():
    return {
        "success": True,
        "platform": "Vyapari Core API",
        "version": "2.0.0",
        "status": "healthy",
        "health_check": "/health",
        "docs_url": "/api/docs",
    }


# Route Mounts — Identical prefixes to Express backend-core
# Supports both /health and /api/health for api.vyapari.live domain routing
app.include_router(health_router, prefix="/health")
app.include_router(health_router, prefix="/api/health")
app.include_router(auth_router, prefix="/api/auth")
app.include_router(categories_router, prefix="/api/categories")
app.include_router(products_router, prefix="/api/products")
# Declared after products_router: its /{product_id}/variants routes must not be
# captured by a products_router /{id} pattern. Starlette matches in registration
# order, so the more specific router has to be registered second to be safe, and
# this ordering makes that explicit rather than accidental.
app.include_router(variants_router, prefix="/api/products")
app.include_router(cart_router, prefix="/api/cart")
app.include_router(orders_router, prefix="/api/orders")
app.include_router(payments_router, prefix="/api/payments")
app.include_router(seller_router, prefix="/api/seller")
app.include_router(approvals_router, prefix="/api/approvals")
app.include_router(ai_router, prefix="/api/ai")
app.include_router(users_router, prefix="/api/users")
app.include_router(wishlist_router, prefix="/api/wishlist")
app.include_router(notifications_router, prefix="/api/notifications")
app.include_router(stores_router, prefix="/api/stores")
app.include_router(uploads_router, prefix="/api/uploads")
app.include_router(telemetry_router, prefix="/api/telemetry")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(reviews_router, prefix="/api/reviews")
# Seller showcase pages. Kept under /api/public/ rather than extending
# /api/stores/ so the handle-based public pages never collide with the existing
# UUID storefront routes, which stay exactly where they are.
app.include_router(seller_pages_router, prefix="/api/seller-pages")
app.include_router(public_pages_router, prefix="/api/public/stores")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
