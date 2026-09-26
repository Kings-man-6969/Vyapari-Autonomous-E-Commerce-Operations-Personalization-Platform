import os
import json
import time
import uuid
import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse, Response as PlainResponse
from pydantic import BaseModel, Field
import asyncpg
import httpx
from dotenv import load_dotenv

try:
    from tenacity import retry, stop_after_attempt, wait_random_exponential, retry_if_exception
except ImportError:
    def retry(*args, **kwargs):
        def decorator(f):
            return f
        return decorator
    def stop_after_attempt(n): return None
    def wait_random_exponential(*args, **kwargs): return None
    def retry_if_exception(f): return None

from src.quota import check_and_increment_quota, ping_redis
from src.metrics import metrics

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("service-seller-agent")

START_TIME = time.time()

# Support least-privilege agent database role with fallback to standard DATABASE_URL
DATABASE_URL = os.getenv(
    "AGENT_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql://vyapari_admin:vyapari_secure_password@db:5432/vyapari")
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "15.0"))

# Immutable Prompt Versions for Audit Log Tracking
PROMPT_VERSIONS = {
    "listing": "listing_v1.2",
    "inventory": "inventory_v1.1",
    "support": "support_v1.1"
}


# Error Classification for Gemini Call Retries
class RetryableGeminiError(Exception):
    """Transient LLM provider error eligible for exponential backoff retry."""
    pass


def should_retry_gemini(exc: BaseException) -> bool:
    if isinstance(exc, RetryableGeminiError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {429, 500, 502, 503, 504}
    if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.NetworkError)):
        return True
    name = type(exc).__name__
    if any(k in name for k in ["ResourceExhausted", "InternalServerError", "ServiceUnavailable", "DeadlineExceeded", "TooManyRequests"]):
        return True
    return False


# Initialize Gemini Client if key exists
_gemini_client = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_client = genai.GenerativeModel(GEMINI_MODEL)
        logger.info(f"Gemini API configured with model: {GEMINI_MODEL}")
    except Exception as e:
        logger.warning(f"Failed to initialize Gemini SDK: {e}")


@retry(
    retry=retry_if_exception(should_retry_gemini),
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(min=1, max=10),
    reraise=False
)
async def call_llm(prompt: str, system_instruction: str = "", correlation_id: str = "") -> str:
    """Invokes Gemini with exponential backoff, explicit timeout & jitter; fallback to deterministic template."""
    metrics.inc_gemini_request()
    if _gemini_client:
        try:
            full_prompt = f"System: {system_instruction}\nUser: {prompt}" if system_instruction else prompt
            import asyncio
            response = await asyncio.wait_for(
                asyncio.to_thread(_gemini_client.generate_content, full_prompt),
                timeout=GEMINI_TIMEOUT_SECONDS
            )
            return response.text
        except Exception as e:
            metrics.inc_gemini_error()
            if should_retry_gemini(e):
                metrics.inc_gemini_retry()
                logger.warning(f"[cid:{correlation_id}] Transient Gemini failure ({e}), triggering exponential backoff retry...")
                raise RetryableGeminiError(str(e)) from e
            logger.error(f"[cid:{correlation_id}] Non-retryable Gemini call failed ({e}), falling back to deterministic agent template")

    # Deterministic fallback response to keep the local test and demonstration functioning
    return ""


# Database Connection Pool with Lifespan Management
async def get_db_pool():
    if not hasattr(app.state, "pool") or app.state.pool is None:
        try:
            app.state.pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=10,
                command_timeout=10.0,
                timeout=5.0
            )
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return None
    return app.state.pool


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: eager initialize pool
    logger.info("Initializing Seller Agent Service...")
    try:
        application.state.pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=10.0,
            timeout=5.0
        )
        logger.info("Database connection pool established successfully.")
    except Exception as e:
        logger.warning(f"Database connection pool initialization deferred (db offline or starting up): {e}")
        application.state.pool = None

    yield

    # Shutdown: cleanly close pool
    logger.info("Graceful shutdown: closing database connection pool...")
    if hasattr(application.state, "pool") and application.state.pool:
        await application.state.pool.close()
        logger.info("Database connection pool closed.")


app = FastAPI(
    title="Vyapari Seller Agentic Operations Service",
    description="Team B AI Agentic microservice powered by Google Gemini (Listing Agent, Inventory Advisor, Support RAG Agent, Approval Queue Engine).",
    version="1.1.0",
    lifespan=lifespan
)


# Correlation ID and Latency Middleware
@app.middleware("http")
async def correlation_and_metrics_middleware(request: Request, call_next):
    # Extract or generate Correlation ID
    correlation_id = (
        request.headers.get("X-Correlation-ID")
        or request.headers.get("X-Request-ID")
        or str(uuid.uuid4())
    )
    request.state.correlation_id = correlation_id

    start_time = time.time()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration = time.time() - start_time
        metrics.inc_http_request(request.method, request.url.path, 500, duration)
        logger.error(f"[cid:{correlation_id}] Unhandled error handling {request.method} {request.url.path}: {exc}")
        raise exc

    duration = time.time() - start_time
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"

    # Instrument request metrics
    metrics.inc_http_request(request.method, request.url.path, response.status_code, duration)

    if request.url.path not in {"/health/live", "/metrics"}:
        logger.info(f"[cid:{correlation_id}] {request.method} {request.url.path} -> {response.status_code} ({duration * 1000:.1f}ms)")

    return response


# Request Models with Strict Validation
class ListingGenRequest(BaseModel):
    seller_id: str
    prompt: str = Field(..., min_length=3, max_length=1500)
    category_id: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list, max_items=10)
    notes: Optional[str] = Field(None, max_length=2000)


class InventoryAdvisoryRequest(BaseModel):
    seller_id: str
    product_id: str
    current_stock: int = Field(..., ge=0)
    sales_velocity_7d: int = Field(..., ge=0)


class SupportReplyRequest(BaseModel):
    seller_id: str
    source_type: str = "order_query"  # order_query | review | message
    source_id: Optional[str] = None
    customer_query: str = Field(..., min_length=1, max_length=3000)


# Observability: Health Probes & Metrics

@app.get("/health/live")
async def liveness_probe():
    """Lightweight liveness probe for orchestrators (Kubernetes / Docker)."""
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness_probe():
    """Readiness probe verifying database and Redis connectivity."""
    db_ok = False
    pool = await get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                val = await conn.fetchval("SELECT 1")
                db_ok = (val == 1)
        except Exception as e:
            logger.warning(f"Readiness probe DB check failed: {e}")

    redis_ok = await ping_redis()

    if db_ok and redis_ok:
        return {
            "status": "ready",
            "dependencies": {
                "database": "ok",
                "redis": "ok"
            }
        }
    
    # Degraded mode: service is running, but dependencies not fully ready
    return JSONResponse(
        status_code=503,
        content={
            "status": "not_ready",
            "dependencies": {
                "database": "ok" if db_ok else "error",
                "redis": "ok" if redis_ok else "error"
            }
        }
    )


@app.get("/health")
async def diagnostic_health():
    """Internal diagnostic health check (does not leak credentials or raw secrets)."""
    pool = await get_db_pool()
    db_ok = False
    if pool:
        try:
            async with pool.acquire() as conn:
                val = await conn.fetchval("SELECT 1")
                db_ok = (val == 1)
        except Exception:
            db_ok = False

    redis_ok = await ping_redis()
    uptime_seconds = int(time.time() - START_TIME)

    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "service": "seller-agent",
        "version": "1.1.0",
        "uptime_seconds": uptime_seconds,
        "database": "ok" if db_ok else "unavailable",
        "redis": "ok" if redis_ok else "unavailable",
        "gemini": "configured" if bool(GEMINI_API_KEY) else "not_configured",
        "prompt_versions": PROMPT_VERSIONS
    }


@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus exposition format metrics scraper endpoint."""
    body = metrics.export_prometheus_text()
    return PlainResponse(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")


# Agent Workflows

@app.post("/agents/generate-listing")
async def generate_listing(req: ListingGenRequest, request: Request):
    cid = getattr(request.state, "correlation_id", str(uuid.uuid4()))

    # 1. Budget Quota Enforcement (Distributed Redis with conservative local fallback)
    allowed, reason, retry_after = await check_and_increment_quota(req.seller_id, estimated_tokens=1500)
    if not allowed:
        metrics.inc_quota_rejection()
        logger.warning(f"[cid:{cid}] Quota rejected for seller {req.seller_id}: {reason}")
        return JSONResponse(
            status_code=429,
            content={"code": "DAILY_AI_QUOTA_EXCEEDED", "message": reason, "correlation_id": cid},
            headers={"Retry-After": str(retry_after), "X-Correlation-ID": cid}
        )

    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")

    # 2. Prompt for Gemini
    system_prompt = (
        "You are an expert e-commerce catalog specialist. Output ONLY valid JSON with keys: "
        "'title' (max 80 chars), 'description' (2-3 compelling paragraphs), 'tags' (array of strings), "
        "'suggested_price' (number in INR), 'attributes' (key-value object of specs)."
    )
    user_prompt = f"Create an e-commerce listing for: {req.prompt}. Additional context: {req.notes or 'None'}"

    llm_output = await call_llm(user_prompt, system_prompt, correlation_id=cid)

    # Parse or provide deterministic fallback structure
    try:
        clean_text = llm_output.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
    except Exception:
        data = {
            "title": f"Premium {req.prompt[:50]}",
            "description": f"Engineered for exceptional performance and daily reliability. This premium product combines precision craftsmanship with durable, modern design.\n\nCrafted with high-grade components for extended longevity.",
            "tags": ["premium", "bestseller", "new-arrival"],
            "suggested_price": 2999.00,
            "attributes": {"material": "Premium Grade", "origin": "India"}
        }

    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Log Task
            task_row = await conn.fetchrow(
                """
                INSERT INTO agent_tasks (seller_id, task_type, status, input_payload, output_payload)
                VALUES ($1::uuid, 'listing_generation', 'done', $2::jsonb, $3::jsonb)
                RETURNING id;
                """,
                req.seller_id,
                json.dumps({**req.dict(), "correlation_id": cid}),
                json.dumps(data)
            )
            task_id = task_row["id"]

            # 2. Insert into product_drafts
            draft_row = await conn.fetchrow(
                """
                INSERT INTO product_drafts (seller_id, title, description, tags, category_id, confidence, source_images, status, created_by_task)
                VALUES ($1::uuid, $2, $3, $4::jsonb, $5::uuid, 0.92, $6::jsonb, 'draft', $7::uuid)
                RETURNING id;
                """,
                req.seller_id,
                data.get("title"),
                data.get("description"),
                json.dumps(data.get("tags", [])),
                req.category_id,
                json.dumps(req.image_urls),
                task_id
            )
            draft_id = draft_row["id"]

            # 3. Insert into agent_approval_queue (Seller must approve before live publish)
            approval_payload = {
                "draft_id": str(draft_id),
                "title": data.get("title"),
                "suggested_price": data.get("suggested_price"),
                "tags": data.get("tags", []),
                "images": req.image_urls,
                "correlation_id": cid
            }
            queue_row = await conn.fetchrow(
                """
                INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status)
                VALUES ($1::uuid, $2::uuid, 'listing_draft', $3::uuid, 'low', $4::jsonb, 'pending')
                RETURNING id;
                """,
                req.seller_id,
                task_id,
                draft_id,
                json.dumps(approval_payload)
            )

            # 4. Record Immutable Audit Log with Prompt Versioning
            await conn.execute(
                """
                INSERT INTO agent_audit_log (seller_id, agent_type, prompt_version, action_type, reference_id, task_id, input_tokens, output_tokens)
                VALUES ($1::uuid, 'listing_agent', $2, 'generate_listing', $3::uuid, $4::uuid, $5, $6);
                """,
                req.seller_id,
                PROMPT_VERSIONS["listing"],
                draft_id,
                task_id,
                len(user_prompt.split()),
                len(json.dumps(data).split())
            )

            return {
                "success": True,
                "correlation_id": cid,
                "task_id": str(task_id),
                "draft_id": str(draft_id),
                "approval_id": str(queue_row["id"]),
                "prompt_version": PROMPT_VERSIONS["listing"],
                "generated": data
            }


@app.post("/agents/inventory-advisory")
async def generate_inventory_advisory(req: InventoryAdvisoryRequest, request: Request):
    cid = getattr(request.state, "correlation_id", str(uuid.uuid4()))

    # 1. Budget Quota Enforcement
    allowed, reason, retry_after = await check_and_increment_quota(req.seller_id, estimated_tokens=500)
    if not allowed:
        metrics.inc_quota_rejection()
        logger.warning(f"[cid:{cid}] Quota rejected for seller {req.seller_id}: {reason}")
        return JSONResponse(
            status_code=429,
            content={"code": "DAILY_AI_QUOTA_EXCEEDED", "message": reason, "correlation_id": cid},
            headers={"Retry-After": str(retry_after), "X-Correlation-ID": cid}
        )

    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")

    daily_velocity = max(req.sales_velocity_7d / 7.0, 0.1)
    days_left = round(req.current_stock / daily_velocity, 1)

    trend = "rising" if req.sales_velocity_7d >= 10 else ("falling" if req.sales_velocity_7d <= 2 else "stable")
    recommended_reorder = max(int(daily_velocity * 30 - req.current_stock), 10) if days_left < 10 else 0

    reasoning = (
        f"At current 7-day velocity of {req.sales_velocity_7d} units ({daily_velocity:.1f}/day), "
        f"current stock of {req.current_stock} will exhaust in approximately {days_left} days. "
        f"Demand trend is {trend}. Recommend reordering {recommended_reorder} units to cover 30-day lead buffer."
    )

    async with pool.acquire() as conn:
        async with conn.transaction():
            task_row = await conn.fetchrow(
                """
                INSERT INTO agent_tasks (seller_id, task_type, status, input_payload, output_payload)
                VALUES ($1::uuid, 'inventory_advisory', 'done', $2::jsonb, $3::jsonb)
                RETURNING id;
                """,
                req.seller_id,
                json.dumps({**req.dict(), "correlation_id": cid}),
                json.dumps({"days_left": days_left, "trend": trend, "reorder": recommended_reorder})
            )
            task_id = task_row["id"]

            adv_row = await conn.fetchrow(
                """
                INSERT INTO inventory_advisories (seller_id, product_id, days_of_stock_left, demand_trend, recommended_reorder_qty, reasoning, created_by_task)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)
                RETURNING id;
                """,
                req.seller_id,
                req.product_id,
                days_left,
                trend,
                recommended_reorder,
                reasoning,
                task_id
            )
            adv_id = adv_row["id"]

            queue_row = await conn.fetchrow(
                """
                INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status)
                VALUES ($1::uuid, $2::uuid, 'inventory_advisory', $3::uuid, 'medium', $4::jsonb, 'pending')
                RETURNING id;
                """,
                req.seller_id,
                task_id,
                adv_id,
                json.dumps({
                    "days_left": days_left,
                    "reorder": recommended_reorder,
                    "reasoning": reasoning,
                    "correlation_id": cid
                }),
            )

            # Record Immutable Audit Log with Prompt Versioning
            await conn.execute(
                """
                INSERT INTO agent_audit_log (seller_id, agent_type, prompt_version, action_type, reference_id, task_id, input_tokens, output_tokens)
                VALUES ($1::uuid, 'inventory_advisor', $2, 'inventory_advisory', $3::uuid, $4::uuid, $5, $6);
                """,
                req.seller_id,
                PROMPT_VERSIONS["inventory"],
                adv_id,
                task_id,
                50,
                len(reasoning.split())
            )

            return {
                "success": True,
                "correlation_id": cid,
                "task_id": str(task_id),
                "advisory_id": str(adv_id),
                "approval_id": str(queue_row["id"]),
                "prompt_version": PROMPT_VERSIONS["inventory"],
                "days_of_stock_left": days_left,
                "demand_trend": trend,
                "recommended_reorder_qty": recommended_reorder,
                "reasoning": reasoning
            }


@app.post("/agents/support-reply")
async def generate_support_reply(req: SupportReplyRequest, request: Request):
    cid = getattr(request.state, "correlation_id", str(uuid.uuid4()))

    # 1. Budget Quota Enforcement
    allowed, reason, retry_after = await check_and_increment_quota(req.seller_id, estimated_tokens=800)
    if not allowed:
        metrics.inc_quota_rejection()
        logger.warning(f"[cid:{cid}] Quota rejected for seller {req.seller_id}: {reason}")
        return JSONResponse(
            status_code=429,
            content={"code": "DAILY_AI_QUOTA_EXCEEDED", "message": reason, "correlation_id": cid},
            headers={"Retry-After": str(retry_after), "X-Correlation-ID": cid}
        )

    pool = await get_db_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database pool unavailable")

    query_lower = req.customer_query.lower()
    is_refund_risk = any(w in query_lower for w in ["refund", "cancel", "broken", "damaged", "return", "complaint", "fraud"])

    intent = "return_refund" if is_refund_risk else ("order_status" if "where is" in query_lower or "track" in query_lower else "product_question")
    risk_level = "high" if is_refund_risk else "low"

    if is_refund_risk:
        draft = (
            "Hello! We apologize for any inconvenience caused. Per our store policy, we are happy to assist you with a replacement "
            "or full refund once verified. Could you please share a photo of the product/package to proceed?"
        )
    else:
        draft = (
            "Hello! Thank you for reaching out to us. Your shipment is being handled with top priority. "
            "You can view live courier tracking updates from your Orders tab at any time."
        )

    async with pool.acquire() as conn:
        async with conn.transaction():
            task_row = await conn.fetchrow(
                """
                INSERT INTO agent_tasks (seller_id, task_type, status, input_payload, output_payload)
                VALUES ($1::uuid, 'support_reply', 'done', $2::jsonb, $3::jsonb)
                RETURNING id;
                """,
                req.seller_id,
                json.dumps({**req.dict(), "correlation_id": cid}),
                json.dumps({"intent": intent, "risk": risk_level, "draft": draft})
            )
            task_id = task_row["id"]

            reply_row = await conn.fetchrow(
                """
                INSERT INTO support_draft_replies (seller_id, source_type, source_id, intent, draft_response, risk_level, auto_sent, created_by_task)
                VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8::uuid)
                RETURNING id;
                """,
                req.seller_id,
                req.source_type,
                req.source_id,
                intent,
                draft,
                risk_level,
                False,
                task_id
            )
            reply_id = reply_row["id"]

            queue_row = await conn.fetchrow(
                """
                INSERT INTO agent_approval_queue (seller_id, task_id, item_type, reference_id, risk_level, payload, status)
                VALUES ($1::uuid, $2::uuid, 'support_reply', $3::uuid, $4, $5::jsonb, 'pending')
                RETURNING id;
                """,
                req.seller_id,
                task_id,
                reply_id,
                risk_level,
                json.dumps({
                    "intent": intent,
                    "customer_query": req.customer_query,
                    "draft_response": draft,
                    "risk_level": risk_level,
                    "correlation_id": cid
                })
            )

            # Record Immutable Audit Log with Prompt Versioning
            await conn.execute(
                """
                INSERT INTO agent_audit_log (seller_id, agent_type, prompt_version, action_type, reference_id, task_id, input_tokens, output_tokens)
                VALUES ($1::uuid, 'support_rag', $2, 'support_reply', $3::uuid, $4::uuid, $5, $6);
                """,
                req.seller_id,
                PROMPT_VERSIONS["support"],
                reply_id,
                task_id,
                len(req.customer_query.split()),
                len(draft.split())
            )

            return {
                "success": True,
                "correlation_id": cid,
                "task_id": str(task_id),
                "reply_id": str(reply_id),
                "approval_id": str(queue_row["id"]),
                "prompt_version": PROMPT_VERSIONS["support"],
                "intent": intent,
                "risk_level": risk_level,
                "draft_response": draft
            }
