# Vyapari Canonical System Contracts & State Machines

This document establishes the canonical ground truth across the database, backend APIs, and frontend interfaces for the Vyapari Autonomous E-Commerce Operations & Personalization Platform.

> **Authority rule.** Where this document and the code disagree, the code wins and this document is the bug. The schema of record is `db/migrations/V1`–`V7` applied through `scripts/migrate.py`; every status/enum list below is transcribed from a live `CHECK` constraint, not from intent. Statements marked **⚠️ NOT IMPLEMENTED** describe a contract that is designed but absent from the code — they are recorded so the gap is visible, not so it can be relied on.

---

## 1. HTTP Response Envelope

Every JSON response from `backend-core-py` uses one of two shapes. The envelope is produced centrally in `app/main.py` and is not optional.

### Success
```json
{ "success": true, "data": { "...": "..." } }
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "PLAN_UPGRADE_REQUIRED",
    "message": "Human-readable summary.",
    "details": { "...": "optional structured context" }
  }
}
```

**Error codes live at `error.code`, never at `error.detail`.** `details` is free-form context only.

### Status Code Map

| Status | Meaning | Produced by |
|---|---|---|
| `200` / `201` | Success | Router handlers |
| `400` | Validation failure | `RequestValidationError` handler — **not 422** |
| `401` | Missing/expired access token | `StarletteHTTPException` |
| `402` | Plan-gated feature or plan capacity reached | `seller_page_service.require_feature` / `require_capacity` |
| `403` | Role or ownership check failed | `StarletteHTTPException` |
| `404` | Resource absent — **or a seller page that is not published** | `StarletteHTTPException` |
| `409` | State conflict (duplicate SKU/slug, illegal transition) | `StarletteHTTPException` |
| `422` | Semantic business-rule rejection (idempotency payload mismatch) | Router handlers raising `HTTPException` |
| `500` | Unhandled — logged with a correlation ID | `Exception` handler |

> **Note on 400 vs 422.** Pydantic/FastAPI request-shape validation is remapped to `400 VALIDATION_ERROR` by the global `RequestValidationError` handler. Business-rule rejections raised manually inside a handler still surface as whatever the handler passes — `orders.py` uses `422` for `IDEMPOTENCY_PAYLOAD_MISMATCH`. Clients must branch on `error.code`, not on the class of 4xx.

---

## 2. Authentication & Token Contract

| Element | Location | Storage Mechanism | Security Attributes |
|---|---|---|---|
| **Access Token** | Memory (JS state) | React `AuthContext` state | Short-lived (15 min), never written to `localStorage` or `sessionStorage` |
| **Refresh Token** | Cookie | HttpOnly Cookie | `Path=/api/auth/refresh`, `SameSite=Strict`, `Secure` in prod, SHA-256 hashed at rest in `refresh_token_sessions` (V2), family UUID for replay detection, IP + user-agent recorded |
| **UI Preferences** | Storage | `localStorage` | Allowed strictly for non-sensitive UI state (dismissed banners, collapsed sidebars) |

Endpoints: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `GET /api/auth/me`.

> **⚠️ Mobile blocker.** The refresh token is an HttpOnly cookie and therefore unusable from React Native. Any mobile client needs either secure native token storage or a non-cookie refresh endpoint. See the gaps register in `PROJECT_DOCUMENTATION.md` §15.

---

## 3. Order & Payment State Machine

Order state and payment state are strictly decoupled: an order may be `paid` while its `payments` row is still `created`, and vice versa during webhook races.

### 3.1 Order Lifecycle (`orders.status`)

Transcribed from the `CHECK` constraint in `V1__init_schema.sql`:

```
      pending  ────────────┬──────────────► cancelled
        │                  │
        │ confirm-payment  │
        ▼                  │
      paid  ───────────────┘
        │
        ▼
   processing
        │
        ▼
    shipped
        │
        ▼
 out_for_delivery
        │
        ▼
   delivered
```

**Allowed `orders.status` values** (exactly these seven; there is no `confirmed`):

| Value | Meaning |
|---|---|
| `pending` | Order created, stock decremented, awaiting payment |
| `paid` | Payment captured and confirmed |
| `processing` | Seller acknowledged, preparing package |
| `shipped` | Handed to courier, tracking number recorded |
| `out_for_delivery` | Last-mile transit |
| `delivered` | Delivery confirmed |
| `cancelled` | Cancelled before fulfillment |

Write path: `POST /api/orders` (creates `pending`) → `POST /api/orders/{id}/confirm-payment` (→ `paid`) or `POST /api/payments/webhook` (→ `paid` / `failed` on the payment row) → `PUT /api/seller/orders/{id}/status` (seller-driven transitions).

### 3.2 Payment Lifecycle (`payments.status`)

Transcribed from the `CHECK` constraint in `V1__init_schema.sql`:

| Value | Meaning |
|---|---|
| `created` | Payment record opened |
| `success` | Gateway confirmed capture — **not `captured`** |
| `failed` | Gateway rejected, or `payment.failed` webhook received |
| `cancelled` | Payment abandoned |
| `pending_verification` | Awaiting webhook confirmation |

> **Naming correction.** Earlier revisions of this document specified `orders.status = 'pending_payment'` and `payments.status = 'captured' | 'failed' | 'refunded'`. Neither exists in the schema. The code follows the schema; this section has now been corrected to match.

### 3.3 Inventory Concurrency Policy

1. `POST /api/orders` opens a transaction and takes a row lock per line item:
   `SELECT id, title, price, stock_qty, status, seller_id FROM products WHERE id = $1::uuid FOR UPDATE`
2. The line is rejected unless `status = 'active'` and `stock_qty >= quantity`.
3. Stock is decremented and the product is flipped to `out_of_stock` when it reaches zero — **in the same transaction as the order insert**.
4. Idempotency is reserved in the same transaction via
   `INSERT INTO idempotency_records (user_id, key, request_hash, status, expires_at) ... ON CONFLICT DO NOTHING`,
   so a duplicate `Idempotency-Key` replays the stored response and a reused key with a different payload is rejected with `422 IDEMPOTENCY_PAYLOAD_MISMATCH`.
5. Webhook dedup is enforced by inserting into `payment_events (event_id, ...)`; a repeat event is acknowledged with `{"success": true, "status": "duplicate_ignored"}` and no reprocessing.

> **⚠️ NOT IMPLEMENTED — stock restoration.** Decrementing stock at order creation is unconditional and **no code path ever increments it back**. There is no cancel endpoint, no refund path, and no abandoned-order sweeper. A `pending` order whose customer abandons checkout permanently burns that inventory. See the gaps register.

> **⚠️ NOT IMPLEMENTED — webhook order matching.** `payments.py` resolves the order with `WHERE (razorpay_order_id = $2 OR id::text = $2) AND status = 'pending'`, but `create_order` never writes `razorpay_order_id`, and `CheckoutPage.jsx` still sends a literal `pay_rzp_mock_${Date.now()}` as the provider reference. In practice only the `id::text` branch can ever match.

### 3.4 Money Representation

All monetary columns are **`NUMERIC(10,2)` in INR** — rupees, not paise, and not integer cents. `orders.total_amount`, `order_items.price_at_purchase`, `payments.amount`, `products.price`, `products.compare_at_price`, `product_stats_daily.revenue`. Never use float arithmetic on these values in Python; they arrive from asyncpg as `Decimal`.

---

## 4. Product & Catalog Contracts

| Element | Location | Contract |
|---|---|---|
| `products.status` | `V1` CHECK | `draft` \| `active` \| `out_of_stock` \| `archived` |
| `products.price` | `V1` | `NUMERIC(10,2) NOT NULL CHECK (price >= 0)` |
| `products.compare_at_price` | `V1` | `NUMERIC(10,2)` with `CHECK (compare_at_price >= price)` |
| `products.description` | `V1` | `TEXT NOT NULL` |
| `products.slug` | `V1` | `VARCHAR(250) UNIQUE NOT NULL` |
| `products.stock_qty` | `V1` | `INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0)` |
| `products.images` | `V1` | `JSONB DEFAULT '[]'` — array of URL strings |
| `products.attributes` | `V1` | `JSONB DEFAULT '{}'` — `{color, size, specs, material, brand}` |
| `users.role` | `V1` CHECK | `customer` \| `seller` \| `admin` |
| `users.is_active` | `V1` | `BOOLEAN` — suspension is a boolean, **not** a `status` column |

`categories.name` is `UNIQUE`; `products.category_id` is `NOT NULL` with `ON DELETE RESTRICT`.

> **⚠️ NOT IMPLEMENTED — product variants.** There is no `product_variants` table, no variant endpoint, and no variant selector on the PDP. `products.attributes` carries a free-form `size`/`color` string but nothing is stock-tracked per variant. All inventory is tracked at the product level only.

---

## 5. Seller Showcase Pages (`/store/:handle`)

### 5.1 URL Contract

| Surface | URL | Auth | Notes |
|---|---|---|---|
| Premium showcase page | `/store/{handle}` | **Public** | Indexable by design — these are the upsell surface for paid plans |
| Legacy storefront | `/stores/{sellerId}` | Public | UUID-keyed, pre-dates the showcase page; both coexist |
| Owner editor | `/seller/page` | Seller | **Not yet built — `SellerShowcasePage` links to it in three places and those links currently 404** |

Public API base is `/api/public/stores` (not `/api/stores`, which is the pre-existing UUID storefront) and owner API base is `/api/seller-pages`.

Handle format: `HANDLE_RE = ^[a-z0-9][a-z0-9_-]{2,29}$` — 3–30 chars, lowercase alphanumeric plus `_` and `-`, must start alphanumeric. Handles are derived from the seller's store name at page creation and validated with distinct `400` codes per failure mode (bad charset, wrong length, leading punctuation).

### 5.2 Plan Tiers

Defined once in `app/seller_page_service.py::TIERS` and enforced on every read and write. Entitlement is cached in Redis for **300 s**; an expired subscription therefore serves premium content for at most five minutes, which is the intended trade.

| Capability | `free` (Starter) | `pro` | `elite` |
|---|---|---|---|
| `max_media` | 12 | 120 | 600 |
| `max_highlights` | 0 | 8 | 20 |
| `max_blocks` | 2 | 8 | 20 |
| `allows_video` | ❌ | ✅ | ✅ |
| `allows_highlights` | ❌ | ✅ | ✅ |
| `allows_custom_theme` | ❌ | ✅ | ✅ |
| `allows_reels` | ❌ | ✅ | ✅ |
| `allows_announcement` | ❌ | ✅ | ✅ |
| `allows_analytics` | ❌ | ✅ | ✅ |

Gate failures:
- `402 PLAN_UPGRADE_REQUIRED` — feature not on the current plan.
- `402 PLAN_LIMIT_REACHED` — plan capacity exhausted (with `details` naming the limit and the current count).

### 5.3 Subscription Entitlement Model

`seller_subscriptions` is **entitlement-only**. No Razorpay Subscriptions wiring exists: a row is granted by an admin or by the gateway webhook, and billing is attached to an existing entitlement later.

- One live subscription per seller, enforced by the partial unique index `uq_seller_live_subscription` on `seller_id WHERE status IN ('trialing','active')`.
- Allowed `status`: `trialing` \| `active` \| `past_due` \| `cancelled` \| `expired`.
- Allowed `plan`: `free` \| `pro` \| `elite`.
- Expired or non-live subscriptions fall back to the `free` tier at read time.
- `POST /api/seller-pages/mine/plan` is **admin-only**. A seller cannot self-upgrade, which would otherwise be a privilege-escalation bug.

### 5.4 Publish Gate

A page is invisible to the public API until `is_published = true`. The gate requires a valid handle, a tagline, and a non-empty set of media; failures return `400` with a per-condition code. `launched_at` is stamped on first publish and is what the public feed orders by. An unpublished page returns `404` from `/api/public/stores/{handle}` — deliberately indistinguishable from a nonexistent handle, so draft pages cannot be enumerated.

### 5.5 Block Composition

`seller_page_blocks.block_type` is constrained to six values, and **all six render** in `SellerShowcasePage.jsx`:

| Block type | Min plan | Notes |
|---|---|---|
| `announcement` | pro | Top strip; time-windowed |
| `hero_banner` | free | Uses the page cover |
| `media_grid` | free | Paginated, `IntersectionObserver` infinite scroll |
| `featured_collection` | free | Curated product set |
| `reels` | pro | Video |
| `testimonials` | free | Seller-curated quotes |

Blocks are time-windowed: a block only renders while `NOW()` is within `[starts_at, ends_at]` (either bound may be `NULL` for open-ended scheduling).

### 5.6 Seller-Writable Content Safety

Seller-authored fields are treated as untrusted on render:

- `cta_href` — constrained in SQL to `^/` or `^https://` (`chk_seller_block_cta_safe`), **and** re-validated client-side by `safeHref`, which neutralizes `javascript:` and `data:` URLs.
- `theme_accent` — constrained in SQL by `chk_seller_page_accent` (`^#[0-9a-fA-F]{6}$`), **and** re-validated by `safeAccent`.
- Media URLs — validated against a host allowlist by `validate_media_url` before persistence, so a seller cannot point the grid at an internal address.
- All 5 `seller_media` `url`/`thumbnail_url`/`poster_url` values are resolved through one shared SQL join (`PAGE_SELECT`) so the avatar and cover can never silently fail to resolve.

---

## 6. Seller Lifecycle & KYC Model

```
REGISTER (/register?role=seller)
       │
       ▼
ACCOUNT CREATED (Store Name, Category)
       │
       ▼
DASHBOARD ACCESSIBLE (is_verified = false)
       │
       ├── Can draft products
       ├── Can explore AI listing studio
       └── CANNOT publish live products or fulfill orders
       │
       ▼
ADMIN KYC REVIEW (/admin/sellers)
       ├── Approve ──► is_verified = true  (Can publish & sell)
       ├── Reject  ──► rejection reason recorded
       └── Suspend ──► users.is_active = false
```

KYC data lives in `seller_profiles.business_info` (`JSONB`, `{gstin, pan, business_type}`), not in dedicated columns. Verification state is the boolean `seller_profiles.is_verified` plus `users.is_active` — there is no `kyc_status` enum column.

---

## 7. Public Catalog & Search Architecture

| Endpoint | Purpose |
|---|---|
| `GET /api/products` | Faceted catalog (category, brand, price bounds, rating, sort) |
| `GET /api/products/facets` | Available filter values for the `/explore` sidebar |
| `GET /api/products/suggest` | Autocomplete popover (prefix + keyword) |
| `GET /api/products/search` | NLQ search: parse filters, blend with pgvector similarity |
| `GET /api/ai/similar/{product_id}` | "You may also like" |
| `GET /api/ai/popular` | Popular products |
| `GET /api/stores/{seller_id}` | Legacy UUID storefront |

> **⚠️ NOT IMPLEMENTED — `/api/recommendations/products/{id}`.** Earlier revisions of this document listed a `recommendations` router. No such router is mounted. The equivalent surface is `GET /api/ai/similar/{product_id}`, which proxies `service-recommendation` — a service that is **not deployed**. In production this endpoint returns empty and the "You may also like" rail disappears entirely. Search degrades to `ILIKE` for the same reason.

> **⚠️ KNOWN BUG — `GET /api/products` 500.** `products.py:442` passes an unvalidated query argument into a UUID comparison, producing `invalid input for query argument $1: '1' (invalid UUID '1')` on some parameter combinations. This is a pre-existing defect on a core public endpoint, not introduced by the seller-pages work.

---

## 8. Normalized Route Names

### Public
| Route | Page |
|---|---|
| `/` | Landing |
| `/explore`, `/search` | Faceted catalog |
| `/products/:id` | PDP |
| `/stores/:sellerId` | Legacy UUID storefront |
| `/store/:handle` | Premium seller showcase page |
| `/cart`, `/login`, `/register` | Customer entry points |
| `/about`, `/help`, `/terms`, `/privacy`, `/returns` | Informational |

### Customer (auth required, `role = customer`)
`/checkout`, `/orders`, `/orders/:id`, `/wishlist`, `/account`, `/account/addresses`

### Any authenticated user
`/notifications`, `/seller/onboarding`

### Seller console (`/seller/*`)
| Route | Page |
|---|---|
| `/seller/dashboard` | Merchant KPI desk |
| `/seller/products`, `/seller/products/new`, `/seller/products/:id/edit` | Catalog management |
| `/seller/orders` | Fulfillment and courier dispatch |
| `/seller/reviews` | Reviews and seller replies |
| `/seller/inventory` | Inventory velocity and reorder alerts |
| `/seller/ai` | Seller AI copilot chat |
| `/seller/ai/listing` | AI listing studio |
| `/seller/approvals` | Human-in-the-loop approval queue |
| `/seller/settings` | Store settings and policies |
| `/seller/page` | **Showcase page editor — not yet built** |

### Admin (`/admin/*`)
`/admin`, `/admin/users`, `/admin/sellers`, `/admin/products`, `/admin/categories`, `/admin/system`

### Courier Dispatch Logistics Enum
When marking an order shipped, sellers select from:
- `self` — merchant self-delivery / local messenger
- `delhivery` — Delhivery Express
- `bluedart` — Blue Dart Aviation
- `dtdc` — DTDC Express
- `india_post` — India Post Speed Post

---

## 9. Product Detail Page (PDP) Architecture

**Desktop (1080–1400px)** — 3 columns:
- **Column 1:** media gallery, sticky thumbnail rail, hover staging.
- **Column 2:** brand badge, title, rating, savings breakdown, offers/EMI, feature bullets, spec table.
- **Column 3:** sticky buy box — pricing, stock status, pincode estimator, quantity picker, Liquid Platinum CTA, guarantee tags.

**Mobile (<768px):** single-column stack (Gallery → Narrative → Specs → Reviews → Seller) with a fixed bottom purchase bar.

---

## 10. Platform-Wide Gaps Register

Summarized here so contracts are not read as capabilities. The full register with evidence locations lives in `PROJECT_DOCUMENTATION.md` §15, and the working checklist with every item's status is `BUILD_CHECKLIST.md`.

This list was written as an audit of the codebase before sections A–F landed, and most of what it named is now closed. What follows is the register as it actually stands, with the closed entries recorded rather than deleted so the audit trail is not rewritten.

**Closed since the audit** — each with tests in `backend-core-py/tests/`:
- ~~Order cancellation, refunds, and stock restoration~~ — `app/routers/payments.py`, `restore_stock`, `refunds` table. Section E.
- ~~Forgot / reset password~~ — `app/email.py`, token digest, session revocation on reset. Section B3.
- ~~Product variants~~ — `product_variants`, variant-aware cart and order lines, PDP picker, seller and admin editors. Section C.
- ~~Rate limiting~~ — `app/rate_limit.py`, 17 routes, `X-RateLimit-*` headers. Section B1.
- ~~Best-sellers ranking~~ — `sort=best_selling` over `product_stats_daily`, which now has writers. Sections I1–I2.
- ~~Leads / enquiries~~ — `leads` capture from three surfaces plus an admin inbox with notes and CSV export. Section H.
- ~~Ad banners~~ — `banners` CRUD, four storefront slots. Section G1–G2.
- ~~GA4~~ — loaded from the bundle rather than an inline snippet, because the CSP has no `'unsafe-inline'`; `script-src` and `connect-src` extended in the same change. Section I6.
- ~~Image upload returns a fabricated S3 presigned URL~~ — a real provider interface with a working local implementation. Section D1.
- ~~Payments are simulated end-to-end~~ — Razorpay v1 against test keys, signature verification, an authoritative webhook. Section E1.
- ~~Admin analytics is six integers computed inline~~ — a daily sales series, AOV, refunds split, previous-window comparison, and the six integers corrected (the old GMV counted unpaid orders). Section I5.
- ~~Popular products depend on an undeployed service~~ — read from `product_stats_daily`; when the window is empty the response says `basis: "newest"` instead of mislabelling it. Section I3.
- ~~No CMS — homepage promotions are hardcoded JSX~~ — `cms_content` with an editor and a revision trail, seeded verbatim from the JSX it replaced. Section G3.
- ~~`product_stats_daily` has no application writer~~ — `app/analytics.py`, a periodic idempotent rollup with a run log. Section I1.

**Still open**
- Code splitting — zero `React.lazy`/`Suspense`; single ~789 kB chunk. Section J1.
- Bundle budget — no CI assertion on chunk size. Section J2.
- Query optimization against real plans — indexes reviewed, plans not measured. Section J3.
- The admin console has no product create/edit form, no stock editor with the movement log, no category edit/delete, and no refund action. The routes are complete and tested; the screens are missing. See *Admin console* in `BUILD_CHECKLIST.md`.
- `/seller/page` — the seller page editor route. Section K1.
- **Seeded catalog embeddings are deterministic hash vectors, not `all-MiniLM-L6-v2` output.** The one entry from the original audit that is still exactly as it was.

**Deployment gaps**
- `service-recommendation` and `service-seller-agent` are not deployed. The platform no longer *depends* on the first for any ranking, but semantic search still forwards to it and falls back to keyword matching when it is absent.
- No live Razorpay keys and no storage bucket — both are the same posture: a complete code path that refuses with 503 rather than pretending.
- The host's own CSP, if it sets one, must carry the same origins as `vite.config.js` and `CSP_DIRECTIVES`; the stricter of the two applies.

