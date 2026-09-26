# Vyapari — Pragmatic Production-Grade Technical Specification

> **Status of this document.** This is a **roadmap**, not a description of the system. Phases 0–12 below were written as a target sequence; several are complete, several are partial, and several are untouched. Each phase now carries a **status line** stating what actually shipped. The authoritative description of the current system is `README.md` and `PROJECT_DOCUMENTATION.md`; the authoritative list of what is *missing* is `PROJECT_DOCUMENTATION.md` §15.

---

## Current System State

Vyapari is a multi-role autonomous e-commerce platform running as a Docker Compose stack:

| Service | Technology Stack | Network Port | Status |
|---|---|---|---|
| **Frontend** | React 18 + Vite SPA, 38 pages, plain CSS | `:3000` | Deployed |
| **Backend Core** | **Python FastAPI** (`backend-core-py`), 19 routers, asyncpg, pydantic v2, python-jose | `:8000` | Deployed (83/83 tests passing) |
| **Service-Recommendation** | Python FastAPI + `all-MiniLM-L6-v2` (SentenceTransformers) + pgvector | `:8001` | ⚠️ **Not deployed** — compute-heavy |
| **Service-Seller-Agent** | Python FastAPI + Google Gemini 1.5 Flash (Listing, Inventory Advisor, Support RAG) | `:8002` | ⚠️ **Not deployed** — compute-heavy |
| **Database** | PostgreSQL 16 + pgvector (384-dim HNSW index), 7 migrations | `:5432` | Deployed (Render) |
| **Cache & Broker** | Redis 7 | `:6379` | Deployed |
| **Media** | Appwrite Storage (agreed; **not yet wired**) | — | Pending |
| **Migrations** | `scripts/migrate.py`, one-shot `db-migrate` job | — | Shipped |

**What "not deployed" costs you.** Search degrades from pgvector similarity to `ILIKE`; `GET /api/ai/similar/{id}` returns empty so the "You may also like" rail silently vanishes; the seller AI console, listing studio, inventory advisor and Support RAG desk are all non-functional. None of these error loudly — they degrade, which is the more dangerous failure mode.

**Counting correction.** The table above previously read "15 routers" and "29/29 unit tests". The real figures are **19 routers** and **83 tests** across 5 files, 37 of which are real-database integration tests. The earlier count omitted the seller-page suite entirely.

---

## Architectural Philosophy: Pragmatic Production vs. Overengineering

We strictly distinguish between **necessary correctness/security guarantees** and **enterprise gold-plating**:

| Area | Overengineered Approach (Rejected) | Pragmatic Production Approach (Adopted) |
|---|---|---|
| **Tenant Isolation** | Complex PostgreSQL Row-Level Security (RLS) on 5+ tables with connection-pool session variables (`SET LOCAL app.seller_id`) | **Hard DB role privileges** (`vyapari_agent` physically lacks write access) + strict JWT-derived query parameterization (`WHERE seller_id = $1`). Simple, zero pool leakage risk. |
| **Image Security / SSRF** | Multi-bucket quarantine pipelines, ClamAV Lambda/ECS containers, S3 event fanout | **Direct presigned PUT** (max 5MB, JPEG/PNG/WebP only) + fast in-memory Pillow validation (rejects SVGs, corrupt bytes, bounds dimensions). ⚠️ **The MIME validation is real; the presigned URL is fabricated** (`uploads.py:61` contacts no bucket). Agreed replacement is **Appwrite Storage** — CDN, WebP transforms, and video, which also unblocks the premium media tiers. |
| **Payment Webhooks** | 7-state distributed transition machine with out-of-order replay queues | **HMAC-SHA256 signature verification** + atomic `payment_events` insertion + single-transaction conditional order update (`WHERE payment_status = 'pending'`). |
| **Order Idempotency** | Distributed multi-tier lease management and lock managers | **Single-transaction DB insert**: `INSERT INTO idempotency_records ... ON CONFLICT (user_id, key) DO NOTHING` in the same transaction as order creation. |
| **Background Tasks** | Custom PostgreSQL task leasing tables with heartbeat polling | **Standard Celery + Redis** with `task_acks_late=True` and simple deduplication against `agent_tasks`. |
| **Database Roles** | 4 separate users with granular DDL/DML permission matrices | **2 clean roles**: `vyapari_app` (backend-core full DML) and `vyapari_agent` (read catalog, write drafts/approval queue, no write to commerce tables). |
| **Frontend Telemetry** | Full user-agent parsing pipelines, network speed monitoring, device fingerprinting | **React Error Boundary** logging fatal crashes to `/api/telemetry/errors` with a 10 KB payload limit. ⚠️ The "strict IP rate limiting" half of this decision **was not implemented** — `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced. |
| **Seller Page Billing** | Razorpay Subscriptions, invoicing, proration, dunning, tax invoices | **Entitlement-only.** An admin- or gateway-granted `seller_subscriptions` row with plan, status and price. Razorpay Subscriptions attach to an existing entitlement later. One live subscription per seller via a partial unique index. **A seller cannot self-upgrade** — `POST /mine/plan` is admin-only, because otherwise it is a privilege-escalation bug. |
| **Seller Page Media** | Per-tenant S3 buckets with lifecycle policies and signed cookies | **Appwrite Storage** with URLs denormalised onto the media row. The FastAPI gateway stays stateless and the frontend needs no vendor SDK. `storage_provider` defaults to `'appwrite'` in V7. |

---

## Core Security Boundary

> **Axiom**: Autonomous agents generate decisions and drafts; the core application authorizes and executes commerce actions.

```text
                        INTERNET
                           │
                    ┌──────▼──────┐
                    │  CDN + WAF  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ FastAPI Core│
                    └──┬───┬───┬──┘
                       │   │   │
             ┌─────────┘   │   └─────────┐
             ▼             ▼             ▼
        PostgreSQL       Redis       Agent Service
        (Port 5432)   (Port 6379)     (Port 8002)
             │                           │
             │                      ┌────┴────┐
             │                      ▼         ▼
             │                    Celery    Gemini
             │                      │
             │             ┌────────┼────────┐
             │             ▼        ▼        ▼
             │          Listing  Inventory Support
             │
             └─────── Recommendation
                      Service (Port 8001)


            DATABASE PRIVILEGE BOUNDARY
                      │
            ┌─────────▼─────────┐
            │ Role: vyapari_agent│
            │  SELECT catalog   │
            │  INSERT drafts    │
            │  INSERT approvals │
            │  NO UPDATE orders │
            │  NO UPDATE stock  │
            └─────────┬─────────┘
                      │
               Approval Queue
                      │
            ┌─────────▼─────────┐
            │ Role: vyapari_app │
            │ (Seller approves  │
            │ via Core Backend) │
            └───────────────────┘
```

---

## Target Implementation Sequence (Phases 0–12)

```text
0. Establish baseline, backup automation, & DR test script        [PARTIAL]
        ↓
1. Authorization, input validation, & strict CORS                  [DONE]
        ↓
2. Order & payment correctness (Atomic idempotency & signature-verified webhooks)
                                                                [PARTIAL — no cancel/refund/restore]
        ↓
3. Database role privilege separation (Agent write restriction)   [DONE]
        ↓
4. Direct presigned image uploads (SSRF elimination & Pillow validation)
                                                                [HOLLOW — URL is fabricated]
        ↓
5. Authentication & session hardening (Opaque refresh token family rotation, CSRF defense)
                                                                [PARTIAL — no rate limiting, no password reset]
        ↓
6. Automated test suite for all P0 guarantees (Concurrency, idempotency, webhooks, roles)
                                                                [DONE — 83 tests]
        ↓
7. Observability, metrics, tracing, & React error boundary        [DONE]
        ↓
8. Agent reliability, quota budgeting, & immutable audit logging  [DONE — but service undeployed]
        ↓
9. Recommendation improvements (Percentile ranking, time decay, cold-start fallback)
                                                                [BLOCKED — seed embeddings are fake hash vectors]
        ↓
10. Background jobs with standard Celery + Redis                  [DONE — worker/beat services exist]
        ↓
11. Docker multi-stage container optimization (1 worker for ML service)
                                                                [N/A — ML service not deployed]
        ↓
12. Cloud infrastructure (IaC) & CI/CD deployment                 [DONE — 4 CI jobs]
```

### Work landed outside the original phase list

Three things were built that this sequence never anticipated:

| Work | Commit | Why it was needed |
|---|---|---|
| **Migration runner** — SHA-256 checksums, advisory lock, per-migration transactions, `baseline` for legacy DBs | `679a278` | Schema changes were being applied by hand. Without checksums there is no way to know what a given database actually received. |
| **Premium seller showcase pages** — 7 tables, 26 endpoints, public page, plan gating | `d6b920b` | The monetization surface. Gated behind free/pro/elite tiers. |
| **Frontend render smoke tests** — hermetic `react-dom/server` assertions | `d6b920b` | `npm run build` proves the code compiles. It does not prove a component renders correct markup. |

### Priority order for what remains

Ordered by dependency, then by cost-to-claim-risk. The top item is not the most valuable feature — it is the cheapest broken link.

1. **`/seller/page` editor.** Three live links currently 404. The 19 owner endpoints are built and tested; only the UI is missing. **Urgency over value.**
2. **Visual/browser pass on `/store/:handle`.** Never viewed. Ships broken or fine, unknown.
3. **Fix the `GET /api/products` 500** (`products.py:442`). A core public endpoint fails on some query combinations.
4. **Real Appwrite uploads.** Replaces the fabricated presign; unblocks editor media and the video tiers.
5. **Real Razorpay.** Write `razorpay_order_id` at creation → implement `POST /api/payments/create` → remove `pay_rzp_mock_${Date.now()}` from `CheckoutPage.jsx:96`.
6. **Refunds, cancel, stock restoration, abandoned-order sweep.** Inventory is currently burned permanently by abandoned checkouts.
7. **Forgot / reset password.** Also the hard prerequisite for the mobile app.
8. **Rate limiting.** `TTL_RATE_LIMIT` is already defined; nothing calls it.
9. **Product variants**, then **code splitting** (zero `React.lazy`/`Suspense`, single ~657 kB chunk). Note: `frontend/dist` is already gitignored and untracked — that part of the original concern is resolved.
10. **Real admin analytics** writing `product_stats_daily` — today six integers are computed inline.
11. **Banners/promotions + CMS-lite**, **leads/enquiries**, **GA4** (requires relaxing CSP `script-src 'self'` at the same time), **instrument `/api/ai/interactions`**.
12. **Semantic search groundwork**: add `pg_trgm` + `tsvector` now (cheap, useful immediately); then a one-time re-embed of the ~10k catalog through a hosted embedding API — **mandatory**, the current vectors are fake hash functions; then pgvector in-process.

---

## Phase 0 — Baseline & Disaster Recovery

> **Status: partial.** Backup and restore-drill scripts exist. **Schema governance was the bigger gap and is now closed** — see "Work landed outside the original phase list" above for `scripts/migrate.py`. Before it, nothing recorded what schema a given database had actually received; changes were applied by hand.
>
> ⚠️ **The production database's migration state is still unverified.** It is unknown whether `refresh_token_sessions`, `idempotency_records`, `payment_events`, `agent_audit_log` or the `vyapari_agent` role exist on the Render instance. The proven remediation:
> ```bash
> python scripts/migrate.py baseline --upto V1 && python scripts/migrate.py apply
> ```
> Until this is run and confirmed, "the production database is on the current schema" is an assumption.

- **Target RPO**: ≤ 5 minutes (RDS automated backups + transaction logs).
- **Target RTO**: ≤ 30 minutes (restoration from custom dump).

### 0.1 Backup Script (`pg_dump` Custom Format)
PostgreSQL custom format (`--format=custom`) is compressed internally and enables fast restoration via `pg_restore`.

#### [NEW] `scripts/backup.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="vyapari-backup-$(date +%Y-%m-%d_%H%M%S).dump"
echo "Starting PostgreSQL backup to s3://${BACKUP_BUCKET}/backups/${BACKUP_FILE}..."

pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  | aws s3 cp - "s3://${BACKUP_BUCKET}/backups/${BACKUP_FILE}" \
      --sse aws:kms \
      --sse-kms-key-id "${BACKUP_KMS_KEY_ID}" \
      --storage-class STANDARD_IA

echo "Backup written successfully."
```

### 0.2 Restore Verification Drill
A lightweight script restores the backup to a temporary database, executes table count queries, verifies foreign key integrity (`SELECT conname FROM pg_constraint WHERE NOT convalidated;`), and ensures sample orders reconstruct with `order_items`.

---

## Phase 1 — Authorization, Input Validation, & CORS

> **Status: done.** Strict Pydantic models, ownership enforcement, and the CORS allowlist are all in place. One consequence worth knowing: the global `RequestValidationError` handler maps request-shape failures to **HTTP 400 `VALIDATION_ERROR`**, not FastAPI's default 422. Business-rule rejections raised inside handlers still use 422. Clients must branch on `error.code`, not on the class of 4xx. The CORS allowlist permits only `localhost:3000` / `127.0.0.1:3000` and the production origin — **Vite's default 5173 is not allowed**, so `npm run dev` needs `--port 3000`.

### 1.1 Strict Pydantic Request Models
Every POST/PUT endpoint parses request bodies through strict Pydantic v2 models with `extra="forbid"`.

#### [MODIFY] `backend-core-py/app/auth/router.py`
```python
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class RegisterBody(StrictBaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="customer", pattern="^(customer|seller)$")

class LoginBody(StrictBaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
```

### 1.2 Resource Ownership Enforcement
- JWT verification extracts `current_user["id"]` and `current_user["role"]`.
- Resource queries MUST bind to `current_user["id"]` (e.g. `WHERE seller_id = $1` or `WHERE user_id = $1`). Never trust route/body IDs over JWT claims.

### 1.3 Strict CORS Configuration
```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS, # e.g. ["https://vyapari.com", "http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID", "X-Requested-With", "X-Vyapari-Client"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)
```

---

## Phase 2 — Order & Payment Correctness

> **Status: partial.** Concurrency-safe order creation and idempotency are **done and tested**. The cancellation, refund, and stock-restoration half of this phase **does not exist at all** — no cancel route, no refund state, no abandoned-order sweeper. `POST /api/orders` decrements stock inside the order transaction and no code path ever increments it back, so an abandoned `pending` order permanently consumes its inventory.
>
> The Razorpay integration is also half-wired: HMAC verification and event dedup are real, but `create_order` never writes `razorpay_order_id`, so the webhook's `WHERE razorpay_order_id = $2` branch can never match. `CheckoutPage.jsx:96` sends a literal `pay_rzp_mock_${Date.now()}`.
>
> **The database filename below is wrong.** The shipped migration is `V3__idempotency_and_payments.sql`, and it creates both `idempotency_records` and `payment_events`.

### 2.1 Concurrency-Safe Transactional Order Idempotency

#### [NEW] `db/migrations/V3__idempotency.sql`
```sql
CREATE TABLE IF NOT EXISTS idempotency_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key          TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'completed'
    response     JSONB,
    status_code  INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_records(expires_at);
```

#### Transactional Order Logic (`orders.py`):
```python
# Atomic order creation and idempotency reservation in ONE transaction
async with db.pool.acquire() as conn:
    async with conn.transaction():
        # 1. Attempt to claim idempotency key
        record_id = await conn.fetchval(
            """
            INSERT INTO idempotency_records (user_id, key, request_hash, status, expires_at)
            VALUES ($1, $2, $3, 'processing', NOW() + INTERVAL '72 hours')
            ON CONFLICT (user_id, key) DO NOTHING
            RETURNING id;
            """,
            user_id, idempotency_key, incoming_hash
        )
        
        if not record_id:
            # Key already exists: fetch existing record
            existing = await conn.fetchrow(
                "SELECT status, response, status_code, request_hash FROM idempotency_records WHERE user_id = $1 AND key = $2",
                user_id, idempotency_key
            )
            if existing["request_hash"] != incoming_hash:
                raise HTTPException(status_code=422, detail="Idempotency key reused with different request payload")
            if existing["status"] == "completed":
                return JSONResponse(content=json.loads(existing["response"]), status_code=existing["status_code"])
            # Still processing by concurrent request
            return JSONResponse(status_code=409, content={"error": "Request currently processing. Please retry."}, headers={"Retry-After": "2"})
        
        # 2. Lock inventory and check stock
        for item in req.items:
            stock = await conn.fetchval("SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE", item.product_id)
            if stock is None or stock < item.quantity:
                # Business failure: persist response so retries return identical 409
                err_resp = {"error": f"Insufficient stock for product {item.product_id}", "code": "INSUFFICIENT_STOCK"}
                await conn.execute(
                    "UPDATE idempotency_records SET status = 'completed', response = $1, status_code = 409 WHERE id = $2",
                    json.dumps(err_resp), record_id
                )
                return JSONResponse(status_code=409, content=err_resp)
        
        # 3. Create order, insert order items, decrement stock
        order_id = await conn.fetchval(
            "INSERT INTO orders (user_id, shipping_address_id, payment_method, status, payment_status) VALUES ($1, $2, $3, 'pending', 'pending') RETURNING id",
            user_id, req.shipping_address_id, req.payment_method
        )
        for item in req.items:
            await conn.execute(
                "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)",
                order_id, item.product_id, item.quantity
            )
            await conn.execute("UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2", item.quantity, item.product_id)
        
        order_data = {"id": str(order_id), "status": "pending", "payment_status": "pending"}
        await conn.execute(
            "UPDATE idempotency_records SET status = 'completed', response = $1, status_code = 201 WHERE id = $2",
            json.dumps({"success": True, "data": order_data}), record_id
        )
        return JSONResponse(status_code=201, content={"success": True, "data": order_data})
```

> **TTL Cleanup**: Executed hourly via scheduled task:
> `DELETE FROM idempotency_records WHERE expires_at < NOW();`

### 2.2 Payment Webhook Verification & Deduplication

```python
# app/routers/payments.py
@router.post("/webhook")
async def razorpay_webhook(request: Request):
    raw_body = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature")
    
    # 1. Signature Verification
    expected_sig = hmac.new(
        key=settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    if not received_sig or not hmac.compare_digest(expected_sig, received_sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    payload = await request.json()
    event_id = payload.get("event_id") or payload.get("id")
    event_type = payload.get("event")
    payload_hash = hashlib.sha256(raw_body).hexdigest()
    
    # 2. Atomic Deduplication & State Transition in ONE transaction
    async with db.pool.acquire() as conn:
        async with conn.transaction():
            inserted = await conn.fetchval(
                """
                INSERT INTO payment_events (event_id, provider, event_type, payload_hash)
                VALUES ($1, 'razorpay', $2, $3)
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id;
                """,
                event_id, event_type, payload_hash
            )
            if not inserted:
                # Duplicate delivery: return 200 safely
                return {"status": "duplicate_ignored"}
            
            if event_type == "payment.captured":
                payment_entity = payload["payload"]["payment"]["entity"]
                provider_order_id = payment_entity.get("order_id")
                provider_payment_id = payment_entity.get("id")
                
                # Match authoritative razorpay_order_id; guard against reverting refunded/paid orders
                await conn.execute(
                    """
                    UPDATE orders
                    SET payment_status = 'paid', status = 'processing', razorpay_payment_id = $1, updated_at = NOW()
                    WHERE razorpay_order_id = $2 AND payment_status = 'pending';
                    """,
                    provider_payment_id, provider_order_id
                )
                
    return {"status": "processed"}
```

---

## Phase 3 — Database Role Privilege Separation

> **Status: done** (`V5__agent_privileges.sql`, extended by `V6__agent_audit_log.sql`). The `vyapari_agent` role can read the catalog and write drafts, approvals and the audit trail, and is hard-revoked from `UPDATE`/`DELETE` across the board.
>
> ⚠️ **Production migration state is unverified.** If `V5` was never applied to the Render database, this boundary does not exist there. See the Phase 0 remediation command.
>
> One pre-existing defect nearby: `seller.py:483` contains a broken `INSERT INTO agent_approval_queue` referencing columns that do not exist.

Instead of complex RLS policies across every table, enforce the agent security boundary via standard PostgreSQL user permissions:

```sql
-- 1. Create agent role
CREATE ROLE vyapari_agent WITH LOGIN PASSWORD 'ENV_MANAGED_PASSWORD';

-- 2. Grant SELECT on read context
GRANT SELECT ON products, categories, orders, order_items, reviews TO vyapari_agent;

-- 3. Grant INSERT/SELECT on drafts, approval queue, and audit logs
GRANT SELECT, INSERT ON product_drafts, agent_tasks, agent_approval_queue, agent_audit_log, policy_chunks TO vyapari_agent;

-- 4. Hard REVOKE on state-mutating commerce tables
REVOKE UPDATE, DELETE, INSERT ON products, orders, order_items, payments, users, cart_items FROM vyapari_agent;
REVOKE UPDATE, DELETE ON agent_approval_queue, agent_audit_log FROM vyapari_agent;
```

> **Outcome**: Even if prompt injection or a code bug occurs in `service-seller-agent`, PostgreSQL physically rejects any `UPDATE products` or `UPDATE orders`. Approving drafts and changing stock can ONLY be done by the seller via `backend-core-py` using the `vyapari_app` role.

---

## Phase 4 — Presigned Uploads & In-Memory Image Validation (SSRF Elimination)

> **Status: hollow.** The Pillow byte validation in `service-seller-agent` is real and well tested. The upload path is not: `uploads.py:61` **fabricates** an S3 presigned URL. No bucket is contacted, no signature is computed against real credentials, and no bytes are ever stored. `.env.example` has no `AWS_*` variables, confirming there is no S3 integration.
>
> The response has the correct *shape*, which is exactly what makes this easy to mistake for working code during a demo.
>
> **Agreed replacement: Appwrite Storage.** CDN delivery, server-side WebP transforms, and video support. It unblocks both this gap and the video/highlights/reels tiers on premium seller pages — the V7 schema is already shaped for it (`storage_provider` defaults to `'appwrite'`, with `storage_id`, `url`, `thumbnail_url`, `poster_url` columns).
>
> **How to test the claim cheaply:** have someone upload a product photo through the seller console, then look for the file. There is no file.

Arbitrary URL fetching is completely removed. Sellers upload images directly to private S3 buckets.

```text
Seller Client
      │ 1. POST /api/uploads/presign (file_size, mime_type)
      ▼
Backend Core (Validates seller JWT, mime in [jpeg, png, webp], size <= 5MB)
      │ Returns presigned S3 PUT URL for key: products/{seller_id}/{uuid4()}.{ext}
      ▼
Seller Client
      │ 2. Direct PUT to S3
      ▼
Private S3 Bucket
      │ 3. Client provides S3 key to Listing Agent
      ▼
Agent / Ingestion (Fetches bytes using S3 IAM credentials)
      │ In-memory Pillow validation:
      │   - Verify Image.open() parses successfully without errors
      │   - Reject SVGs / non-image formats
      │   - Verify dimensions: 200x200 <= (width, height) <= 4096x4096
      ▼
Gemini Vision (Safe ingestion)
```

No external virus microservices or complex quarantine pipelines needed.

> ⚠️ Reminder from the phase header: the **validation** half of this pipeline is real and tested. The **upload** half is not — `uploads.py:61` fabricates the presigned URL and stores nothing.

---

## Phase 5 — Authentication & Session Hardening

> **Status: partial.** Refresh token family rotation (5.1) and security headers/CSP (5.3) are **done**. **Rate limiting (5.2) is entirely absent** — `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced. There is no throttling on login, signup, order placement, search, uploads, or the unauthenticated telemetry endpoint.
>
> **Also missing: forgot / reset password.** Zero routes, zero token tables. A user who forgets their password has no recovery path at all. This is the hard prerequisite for the planned mobile app.

### 5.1 Opaque Refresh Tokens with Family Rotation
Refresh tokens are 256-bit cryptographically random strings (`secrets.token_urlsafe(32)`), NOT JWTs. Only their SHA-256 hash is stored in PostgreSQL:

#### [NEW] `db/migrations/V2__refresh_token_sessions.sql`
```sql
CREATE TABLE IF NOT EXISTS refresh_token_sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    family_id    UUID NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_token_sessions(family_id);
```

- When a refresh token is used: old session is marked `revoked_at = NOW()`, new token hash is inserted with the same `family_id`.
- If an already-revoked token is presented: revoke the entire `family_id` immediately, forcing re-login (theft detection).

### 5.2 Layered Rate Limiting

> ❌ **Not implemented.** This is the specification only. `redis_client.py:34` defines `TTL_RATE_LIMIT` and nothing calls it — the constant is dead code. Treat the limits below as unimplemented intent.

- **Client IP**: 300 req/min general limit.
- **Login Brute-Force Protection**:
  - Max 10 attempts per 15 min per Client IP.
  - Max 5 attempts per 15 min per account email (`login:{email}`).

The login limit is the urgent one: `POST /api/auth/login` is unauthenticated and unthrottled, so credential stuffing is currently unopposed.

### 5.3 Security Headers & Explicit CSP
```python
CSP_DIRECTIVES = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' https: data: blob:; "
    "connect-src 'self' https://api.vyapari.com https://api.razorpay.com; "
    "font-src 'self' https: data:; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self';"
)
```

---

## Phase 6 — Automated Test Suite for All P0 Guarantees

> ✅ **Done — 83 tests, all passing.** The code below is the *original design sketch* using `pytest` and `pytest.mark.asyncio`. The shipped suite runs on **`unittest`** (`python -m unittest discover -s tests -p "test_*.py"`), because the CI image does not install `pytest-asyncio`. `test_p0_correctness.py` (7 tests) covers items P0.2–P0.4 and the security-header assertion.

#### [NEW] `backend-core-py/tests/test_p0_correctness.py`
```python
import pytest
import asyncio
import uuid
import hmac
import hashlib

@pytest.mark.asyncio
async def test_concurrent_orders_different_keys(client, customer_tokens):
    """Test A: Two customers compete for last unit of stock -> exactly one 201, one 409."""
    product_id = await create_product_with_stock(qty=1)
    
    async def place_order(token):
        return await client.post(
            "/api/orders",
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": str(uuid.uuid4())},
            json={"items": [{"product_id": str(product_id), "quantity": 1}], "payment_method": "cod", "shipping_address_id": str(uuid.uuid4())}
        )
    
    r1, r2 = await asyncio.gather(place_order(customer_tokens[0]), place_order(customer_tokens[1]))
    assert sorted([r1.status_code, r2.status_code]) == [201, 409]

@pytest.mark.asyncio
async def test_concurrent_orders_same_key(client, customer_tokens):
    """Test B: Concurrent retries with SAME key -> both return 201, identical order_id, exactly 1 order in DB."""
    product_id = await create_product_with_stock(qty=10)
    key = str(uuid.uuid4())
    payload = {"items": [{"product_id": str(product_id), "quantity": 1}], "payment_method": "cod", "shipping_address_id": str(uuid.uuid4())}
    
    r1, r2 = await asyncio.gather(
        client.post("/api/orders", headers={"Authorization": f"Bearer {customer_tokens[0]}", "Idempotency-Key": key}, json=payload),
        client.post("/api/orders", headers={"Authorization": f"Bearer {customer_tokens[0]}", "Idempotency-Key": key}, json=payload)
    )
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["data"]["id"] == r2.json()["data"]["id"]

@pytest.mark.asyncio
async def test_webhook_signature_and_deduplication(client):
    """Test C: Invalid signature rejected with 400; valid webhook processes once, duplicate returns 200 ignored."""
    raw_body = b'{"event": "payment.captured", "event_id": "evt_test_123", "payload": {"payment": {"entity": {"order_id": "order_rzp_123", "id": "pay_123"}}}}'
    valid_sig = hmac.new(b"test_secret", raw_body, hashlib.sha256).hexdigest()
    
    # 1. Invalid signature
    res_bad = await client.post("/api/payments/webhook", headers={"X-Razorpay-Signature": "wrong"}, content=raw_body)
    assert res_bad.status_code == 400
    
    # 2. First delivery
    res1 = await client.post("/api/payments/webhook", headers={"X-Razorpay-Signature": valid_sig}, content=raw_body)
    assert res1.status_code == 200 and res1.json()["status"] == "processed"
    
    # 3. Replay delivery
    res2 = await client.post("/api/payments/webhook", headers={"X-Razorpay-Signature": valid_sig}, content=raw_body)
    assert res2.status_code == 200 and res2.json()["status"] == "duplicate_ignored"

@pytest.mark.asyncio
async def test_agent_db_role_cannot_update_products(agent_db_conn):
    """Test D: Agent database user physically cannot update products or orders."""
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        await agent_db_conn.execute("UPDATE products SET price = 10")
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        await agent_db_conn.execute("UPDATE orders SET status = 'delivered'")
```

---

## Phase 7 — Observability & React Error Boundary

> **Status: done**, with one gap carried over from Phase 5.2 — the telemetry endpoint's rate limit does not exist.

### 7.1 React Global Error Boundary
Catches unhandled frontend errors and logs them to `/api/telemetry/errors`:

```tsx
// frontend/src/components/GlobalErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    fetch("/api/telemetry/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message.slice(0, 300),
        url_path: window.location.pathname,
        stack: (error.stack || "").slice(0, 1000)
      })
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Endpoint `/api/telemetry/errors` caps request size to 10 KB. ⚠️ **The 20 req/min per-IP rate limit is not implemented.** `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced. The same phase's rate-limiting item (5.2) was also not implemented, and since this endpoint is unauthenticated it is the one place in the platform where that gap is directly exploitable.

### 7.2 Request Correlation & Low-Cardinality Prometheus Metrics
- `X-Request-ID` validated as UUIDv4, passed to all microservices and response headers.
- Prometheus labels restricted to `method`, `handler`, `status_code` (no `user_id` or `product_id`).

---

## Phase 8 — Agent Reliability, Budgeting, & Audit Trail

> **Status: implemented but moot.** Tenacity backoff, Redis quota enforcement and the immutable audit trail are all real and unit-tested. The service is **not deployed**, so none of it runs in production.

### 8.1 Error Classification & Exponential Backoff with Jitter
```python
# service-seller-agent/src/agents/base_agent.py
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_random_exponential
import httpx

class RetryableGeminiError(Exception): pass

def should_retry_gemini(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {429, 500, 502, 503, 504}
    return isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout))

class BaseAgent:
    @retry(
        retry=retry_if_exception_type(RetryableGeminiError),
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(min=1, max=10) # Jitter prevents thundering herds
    )
    async def _call_gemini(self, prompt: str) -> str:
        ...
```

### 8.2 Redis AI Budget Quota Enforcement
Atomic Redis counter checks prevent excessive API bills:
- Max 500 requests/day and 500k tokens/day per seller.
- Checked via `INCR` in Redis before invoking Gemini. If exceeded, returns HTTP 429 with `Retry-After` header.

### 8.3 Immutable Audit Trail with Prompt Versioning
`agent_audit_log` records `prompt_version` (e.g. `listing_v1.2`) for every suggestion. Role `vyapari_agent` has `INSERT` and `SELECT` only (no `UPDATE` or `DELETE`).

---

## Phase 9 — Recommendation Algorithmic Improvements

> ⚠️ **This phase is blocked, and the blockage is upstream of it.** The service is not deployed, and more importantly the seeded embeddings are **deterministic hash vectors** (`scraper_bot.py:416`), not `all-MiniLM-L6-v2` output. They satisfy the `vector(384)` type and cosine-compute without error while encoding no semantics. Every item below would run correctly and produce meaningless output. The work is worthless until the catalog is re-embedded.

1. **Database-Layer Stock Filtering**: Candidate vector queries enforce `WHERE stock_qty > 0 AND status = 'active'` directly in SQL. *(implemented)*
2. **Percentile Normalization**: Prevents extreme BM25 outliers from squashing vector similarity scores. *(implemented, unit-tested)*
3. **Time-Decayed Popularity**: Weights views, carts, and purchases with an exponential decay ($\lambda = 0.05$, ~14-day half-life). *(implemented, but **no data source** — nothing writes `user_interactions` or `product_stats_daily`.)*
4. **Cold-Start Fallback**: If a user has 0 interactions, return top time-decayed popular + fresh products. Never return a 500. *(implemented at `GET /api/ai/popular`.)*

**Prerequisite, in order:**
1. Add `pg_trgm` and `tsvector` indexes now — cheap, and genuinely useful for typo-tolerant search even with no embeddings at all.
2. **Re-embed the ~10k catalog** through a hosted embedding API. One-time cost, no in-process model, no GPU. This is mandatory.
3. Move pgvector in-process for serving once real vectors exist.

---

## Phase 10 — Background Tasks with Standard Celery + Redis

> **Status: built, but inert.** `service-seller-agent-worker` and `service-seller-agent-beat` are defined in Compose. The service is not deployed, so nothing is ever queued.

- `service-seller-agent` uses standard Celery with Redis broker for asynchronous listing generation and inventory scanning.
- Tasks check `agent_tasks.status` before calling Gemini to avoid duplicate inference on worker retries.
- Celery Beat handles periodic inventory scans every 6 hours.

---

## Phase 11 — Docker Multi-Stage Optimization

> **Status: partially moot.** The ML service is not deployed, so 1-worker memory tuning has no current effect. The configuration remains correct if the service is ever deployed.

### 11.1 ML Service Container Memory
`service-recommendation` runs with **1 worker per container**:
```dockerfile
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
```
Prevents loading `all-MiniLM-L6-v2` multiple times into RAM. Scale horizontally via replicas instead.

### 11.2 Lightweight Container Probes
```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)" || exit 1
```

---

## Phase 12 — Cloud Infrastructure & CI/CD Deployment

1. **Terraform**: Pinned version (`>= 1.8.0`), remote S3 backend with DynamoDB locking (`vyapari-tf-locks`). Standard VPC with 1 NAT Gateway per AZ in production (or 1 total for cost-saving staging).
2. **GitHub Actions OIDC**: Uses AWS STS OpenID Connect federation (no static AWS keys in repository secrets).
3. **Additive Rolling Deployment**:
   ```text
   Step 1: Run additive database migrations
   Step 2: Deploy Backend Core (N+1 backward-compatible)
   Step 3: Deploy Frontend SPA to S3 / CloudFront (invalidate /index.html only)
   ```

> **What actually shipped for CI is not this.** The live deployment uses Render (backend), Appwrite (frontend) and Render/managed Redis — not Terraform on AWS. What exists in the repository is a 4-job GitHub Actions workflow: `test-migrations` (ordering, checksum integrity, legacy `init.sql` upgrade, V7 constraint assertions), `test-backend-core` (full suite against real PostgreSQL + pgvector), `test-ai-services`, and `build-frontend` (build + render smoke tests). **There is no IaC in this repository**; the Terraform described above was never written.

---

## Verification & Sign-Off Checklist

- [x] **P0.1**: Concurrency test verifies exactly one 201 and one 409 for competing orders on stock=1. *(covered by `test_p0_correctness.py`)*
- [x] **P0.2**: Same-key concurrency test verifies both requests return 201 with identical order_id and 1 DB order. *(covered)*
- [x] **P0.3**: Reusing an idempotency key with a modified payload returns 422 `IDEMPOTENCY_PAYLOAD_MISMATCH`. *(covered)*
- [x] **P0.4**: Webhook with invalid HMAC signature returns 400. Replayed webhook returns 200 with duplicate ignored. *(covered)*
- [x] **P0.5**: PostgreSQL role `vyapari_agent` cannot UPDATE or DELETE products, orders, payments, or audit logs. *(enforced by `V5`/`V6` grants)*
- [ ] **P0.6**: Product image uploads accept presigned PUT only; backend URL fetching is completely absent. ⚠️ **Half-met.** The MIME whitelist and size limits are real and tested. The presigned URL is fabricated — no bucket is contacted and no bytes are stored. A test that only asserts the URL *looks* like an S3 URL will pass while nothing is uploaded.
- [ ] **P1.1**: Rate limiting triggers 429 on 11th rapid login attempt from same IP. ⚠️ **Not implemented at all.** `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never called. No endpoint anywhere is throttled.
- [x] **P1.2**: Revoked refresh token reuse triggers family revocation. *(V2 `refresh_token_sessions`, family UUID replay detection)*
- [ ] **P2.1**: Recommendation endpoint returns cold-start results with zero exceptions for a brand new user. ⚠️ Endpoint exists at `GET /api/ai/popular`, but the service is undeployed so it returns empty.
- [ ] **P2.2**: Recommendation service runs 1 worker per container, keeping memory below 800 MB. ⚠️ Dockerfile is correct; service is not deployed, so this is untested in practice.

### Added since this checklist was written

| ID | Criterion | Status |
|---|---|---|
| **V7.1** | Migrations apply in order on an empty database with matching checksums | ✅ shipped (`test-migrations` CI job) |
| **V7.2** | A legacy `init.sql` database upgrades cleanly to head | ✅ shipped (same job) |
| **V7.3** | A modified applied migration is reported as tampering, not silently re-run | ✅ shipped (SHA-256 checksums) |
| **V7.4** | A free-tier seller exceeding 12 media gets 402 `PLAN_LIMIT_REACHED` | ✅ covered by real-DB integration tests |
| **V7.5** | A pro feature on the free tier gets 402 `PLAN_UPGRADE_REQUIRED` | ✅ covered |
| **V7.6** | All six block types render; unknown types get a visible fallback | ✅ `npm run smoke` |
| **V7.7** | `cta_href` with `javascript:` cannot be stored and does not execute | ✅ SQL CHECK + `safeHref` |
| **V7.8** | A seller cannot grant themselves a plan | ✅ `POST /mine/plan` is admin-only |
| **V7.9** | An unpublished page 404s from the public API | ✅ covered |
| **V7.10** | **A human opens `/store/:handle` in a browser and confirms layout, images, lightbox, scroll** | ❌ **outstanding — no browser was ever attached** |
