# Vyapari — Autonomous E-Commerce Operations & Personalization Platform

Vyapari is a production-grade, multi-role autonomous e-commerce platform benchmarked against Amazon, Flipkart, and Shopify. Built with a dual-AI microservice architecture, it combines pgvector dense semantic search with agentic generative AI seller copilots, resilient transaction concurrency, and a responsive multi-role interface.

> 📖 **Comprehensive Documentation**: For architectural decisions, data models, security controls, and operational runbooks, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).
> ⚠️ **Known Gaps**: Parts of this platform are scaffolded but hollow (fake image uploads, simulated payments, undeployed AI services). The authoritative register is [PROJECT_DOCUMENTATION.md §15](./PROJECT_DOCUMENTATION.md#15-known-gaps--hollow-features-register). Read it before relying on any feature described here.

---

## 1. System Architecture

Vyapari is orchestrated as a containerized ecosystem coordinated via Docker Compose:

```
                              [ Browser / Client Viewport ]
                              (Desktop · Tablet · Mobile)
                                            │
                                            ▼ (Port 3000)
                              ┌───────────────────────────┐
                              │  Frontend (React 18/Vite) │
                              └─────────────┬─────────────┘
                                            │ HTTP / REST
                                            ▼ (Port 8000)
                              ┌───────────────────────────┐
                              │   Backend Core (FastAPI)  │
                              │    Python API Gateway     │
                              └──────┬──────┬──────┬──────┘
                                     │      │      │
                ┌────────────────────┘      │      └────────────────────┐
                ▼ (Port 8001)                ▼ (Port 5432)              ▼ (Port 8002)
    ┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
    │ Service-Recommendation│    │   PostgreSQL 16 DB    │    │ Service-Seller-Agent  │
    │ Python / FastAPI      │───▶│   pgvector (384-dim)  │◀───│ Python / FastAPI      │
    │ (all-MiniLM-L6-v2)    │    │   + Redis 7 (Cache)   │    │ (Google Gemini RAG)   │
    └───────────────────────┘    └───────────────────────┘    └───────────────────────┘
                                    ▲                ▲
                                    │                │
                          ┌─────────┴────┐   ┌───────┴────────┐
                          │  db-migrate  │   │  Appwrite      │
                          │ (one-shot)   │   │  Storage (CDN) │
                          └──────────────┘   └────────────────┘
```

### Component Responsibilities

| Service | Technology | Port | Deployment Status | Responsibilities |
|---|---|---|---|---|
| **Frontend** | React 18, Vite, Lucide, plain CSS | `3000` | Deployed | Multi-role UI (Customer, Seller, Admin), 3-column PDP, search autocomplete, mobile sticky purchase bar, faceted drawer, premium seller showcase pages. |
| **Backend Core** | Python 3.11, FastAPI, asyncpg, pydantic v2, python-jose | `8000` | Deployed | API gateway (19 routers), role authorization, ACID order transactions with `SELECT … FOR UPDATE`, NLQ parser, seller page entitlements. |
| **Recommendation Service** | Python 3.11, FastAPI, SentenceTransformers | `8001` | **Not deployed** | Dense 384-dim embeddings, pgvector cosine similarity. Unavailable in production — search degrades to `ILIKE`. |
| **Seller Agent Service** | Python 3.11, FastAPI, Google Gemini | `8002` | **Not deployed** | Listing generation, inventory advisory, merchant copilot, Support RAG. The seller AI console is dead in production. |
| **Database** | PostgreSQL 16 + pgvector | `5432` | Deployed (Render) | 32 tables across 7 migrations, HNSW vector index, order state machine, seller pages. |
| **Cache** | Redis 7 | `6379` | Deployed | Entitlement caching, query caching. Falls back to in-memory if unreachable. |
| **Media** | Appwrite Storage | — | Deployed | CDN-hosted images with WebP transforms and video. Selected because it unblocks the fake-upload path. |
| **Migrations** | `scripts/migrate.py` | — | `db-migrate` one-shot job | SHA-256 checksummed, advisory-locked, per-migration transactions. |

> ⚠️ The two AI services are **not deployed** because they are compute-heavy. Features that depend on them are listed in the gaps register rather than claimed as working.

---

## 2. Core Functional Capabilities

### A. Customer Journey & Catalog Discovery
- **Real-Time Autocomplete Popover (`GET /api/products/suggest`)** — debounced 220ms dropdown with thumbnails, INR pricing, and brand/category discovery badges. Keyboard accessible.
- **Natural Language Query Search (`GET /api/products/search`)** — parses free-form queries (*"noise cancelling headphones under 10000 with fast delivery"*) into price bounds, `min_rating`, `next_day` and brand constraints, blended with pgvector cosine similarity. Renders an AI Intelligence Banner of extracted semantics.
- **Faceted Catalog (`/explore`)** — sticky sidebar with brand checkboxes, price presets, custom min/max, rating floor, discount and next-day filters.
- **3-Column PDP (`/products/:id`)** — multi-image gallery; narrative column with brand badge, savings breakdown, offers/EMI, specs; sticky buy box with pincode estimator, live stock, quantity picker. Mobile collapses to one column with a **fixed bottom purchase bar**.
- **Reviews & Seller Replies** — public reviews with verified-purchase badges and helpful counts, plus official seller reply threads.
- **Account Operations** — wishlist, address book, notification center, order tracking timeline.

### B. Seller Operations Console (`/seller/*`)
- **4-Step KYC Onboarding (`/seller/onboarding`)** — business profile, PAN/GSTIN, bank settlement coordinates, category selection. Real-time role elevation on submit.
- **Inventory Velocity (`/seller/inventory`)** — 30-day sales velocity, days of runway, stockout risk pills.
- **AI Listing Studio (`/seller/ai/listing`)** — SEO descriptions, bullet highlights, 384-dim embeddings into pgvector. *Requires the undeployed seller-agent service.*
- **Reviews Desk (`/seller/reviews`)** — audit buyer feedback, filter unanswered, publish merchant replies.
- **Order Fulfillment (`/seller/orders`)** — delivery snapshots, status transitions, courier assignment (Delhivery, Blue Dart, DTDC, India Post, self) with AWB numbers.
- **Support RAG Policies (`/seller/settings`)** — markdown editor for return and shipping policies, indexed for semantic retrieval.
- **Premium Showcase Page (`/store/:handle`)** — see below.

### C. Premium Seller Showcase Pages (`/store/:handle`)

An Instagram-style public landing page per seller, gated behind a paid plan. This is the monetization surface.

- **Public and indexable** by design — these pages are how free-tier sellers discover the upgrade.
- **Coexists with `/stores/:sellerId`**, the pre-existing UUID-keyed storefront. Both are live.
- **Every seller gets a page on the free tier** (12 media, 2 blocks, no video). `pro` raises this to 120 media / 8 highlights / 8 blocks and unlocks video, reels, custom theme, announcements and analytics; `elite` to 600 / 20 / 20.
- **Composable blocks** — all six block types render: `announcement`, `hero_banner`, `media_grid`, `featured_collection`, `reels`, `testimonials`. Blocks are time-windowed for scheduled promos.
- **Shoppable media** — a media post can carry a `product_id`, turning the grid into a storefront.
- **Publish gate** — a page is invisible until it passes the gate (valid handle, tagline, at least one media item) and `is_published` is set. Unpublished pages 404, so drafts cannot be enumerated.
- **Follow with optimistic UI** and rollback on failure.
- **Lazy 3-column grid** with `IntersectionObserver` infinite scroll, a keyboard-navigable lightbox, and skeleton loading states.
- **Seller-writable content is treated as untrusted**: `cta_href` is SQL-constrained to same-origin/`https://` *and* client-revalidated to neutralize `javascript:`/`data:`; `theme_accent` is constrained to a hex triplet; media URLs pass a host allowlist.

API surface: owner endpoints at `/api/seller-pages` (19 routes), public endpoints at `/api/public/stores` (7 routes, unauthenticated).

> ⚠️ **The editor is not built.** `/seller/page` does not exist as a route, yet `SellerShowcasePage` links to it from three places (Edit Page button, owner draft banner, owner preview). Those links currently 404. This is the top outstanding item.

### D. Admin Governance Desk (`/admin/*`)
- **Executive Overview (`/admin`)** — GMV, transaction volume, merchant and shopper counts.
- **User Governance (`/admin/users`)** — cross-platform index with role filters and suspension toggles.
- **Merchant KYC Desk (`/admin/sellers`)** — review of PAN, GSTIN and bank credentials.
- **Catalog Moderation (`/admin/products`)** — server-side pagination, cross-field search, faceted filters, bulk moderation, force-archive.
- **Category Taxonomy (`/admin/categories`)** — parent/child category management.
- **System Diagnostics (`/admin/system`)** — PostgreSQL latency, pgvector verification, Redis health, embedding coverage gauge with resync trigger.

---

## 3. Demo Credentials Reference

All demo accounts use password: **`Password@123`**

> ⚠️ Earlier revisions of this README documented `seller1@vyapari.com` / `seller2@` / `seller3@` for "Aura Living India", "Volt Tech Studio" and "AyurVeda Essentials". **Those accounts do not exist in the seed.** Sellers are seeded as brand stores.

| Role | Email | Name | Store |
|---|---|---|---|
| **Customer** | `customer1@vyapari.com` | Aarav Sharma | NLQ search, autocomplete, PDP, wishlist, checkout, reviews |
| **Customer** | `customer2@vyapari.com` | Priya Patel | Multi-item cart, order tracking, addresses |
| **Customer** | `customer3@vyapari.com` | Rohan Mehta | |
| **Customer** | `customer4@vyapari.com` | Neha Verma | |
| **Customer** | `customer5@vyapari.com` | Kabir Sen | |
| **Seller** | `store.nike@vyapari.com` | Nike Operations | Nike Official Store |
| **Seller** | `store.adidas@vyapari.com` | Adidas Operations | Adidas Official Store |
| **Seller** | `store.samsung@vyapari.com` | Samsung Operations | Samsung Official Store |
| **Seller** | `store.sony@vyapari.com` | Sony Operations | Sony Official Store |
| **Seller** | `store.dyson@vyapari.com` | Dyson Operations | Dyson Official Store |
| **Admin** | `admin@vyapari.com` | Vyapari Admin | KYC approvals, platform diagnostics, user governance |

**There are 47 seeded sellers**, one per brand, following the pattern `store.<brand-slug>@vyapari.com` with a user named `<Brand> Operations` and a store named `<Brand> Official Store`. The brand list spans sportswear, consumer tech, audio, computing, apparel, watches, home appliances, beauty, and sporting goods — see [walkthrough.md](./walkthrough.md) §2.

The seed contains 10,057 products and 10,000 embeddings, but **no orders, reviews, or payments**. The catalog will look empty until you place an order yourself.

---

## 4. Quickstart with Docker Compose

### Prerequisites
- Docker Desktop installed and running
- Git

### 1. Clone & Configure
```bash
git clone https://github.com/Kings-man-6969/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform.git
cd Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform
cp .env.example .env
```

### 2. Launch
```bash
docker compose up --build
```
The stack starts `db` → `db-migrate` (a one-shot job that applies `V1`–`V7` and must exit 0) → `redis` → services. Backends wait on healthchecks, not on wall-clock sleeps.

> If you are upgrading an existing database rather than creating one, read [Migrations](#6-database-migrations) first.

### 3. Endpoints
- **Web Application** — http://localhost:3000
- **Backend Core Health** — http://localhost:8000/health
- **OpenAPI Docs** — http://localhost:8000/docs
- **Recommendation Service** — http://localhost:8001/health *(not deployed to production)*
- **Seller Agent Service** — http://localhost:8002/health *(not deployed to production)*

---

## 5. Local Development (Without Docker)

### Prerequisites
- Node.js 18+ (CI uses Node 20)
- Python 3.11
- PostgreSQL 16 with pgvector
- Redis 7 (optional — the cache layer degrades to an in-memory store)

### 1. Database Migrations
```bash
# Fresh database
python scripts/migrate.py baseline --upto V1   # or: apply
python scripts/migrate.py status

# Existing database created from the legacy db/init.sql
python scripts/migrate.py baseline --upto V1
python scripts/migrate.py apply
```

### 2. Seed the catalog (optional, large)
```bash
psql -U postgres -d vyapari -f db/seed.sql   # 10,057 products, ~41 MB
```

### 3. Backend Core
```bash
cd backend-core-py
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev -- --port 3000
```
> Vite's default is 5173. The backend CORS allowlist permits only `localhost:3000` and `127.0.0.1:3000`, so use port 3000 or you will get CORS failures.

### 5. AI Microservices (optional — not required for the seller pages work)
```bash
cd service-recommendation
python -m venv venv && source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload

cd ../service-seller-agent
# same pattern, port 8002
```

---

## 6. Database Migrations

Migrations are the single source of truth for schema. `db/migrations/` holds `V1__…` through `V7__…`, applied by `scripts/migrate.py`.

| Command | Purpose |
|---|---|
| `python scripts/migrate.py status` | Applied / pending / checksum drift per migration |
| `python scripts/migrate.py plan` | What `apply` would do |
| `python scripts/migrate.py apply [--upto V7]` | Apply pending migrations in order |
| `python scripts/migrate.py baseline --upto V1` | Mark a legacy `db/init.sql` database as already at V1 |

Properties the runner guarantees:
- **SHA-256 checksums** — a modified applied migration is reported as tampering, not silently re-run.
- **Per-migration transactions** — a failing migration rolls back alone.
- **Postgres advisory lock** — concurrent runners cannot interleave.
- **Password redaction** — connection strings are never printed.

`db/init.sql` and `db/seed.sql` are retained for compose mounts and are verified in CI to still upgrade cleanly.

---

## 7. Automated Testing

### Backend (83 tests)
```bash
cd backend-core-py
python -m unittest discover -s tests -p "test_*.py"
```

| File | Tests | Covers |
|---|---|---|
| `test_all_endpoints.py` | 26 | Category trees, NLQ parser, cart, orders, seller dashboards, approvals, admin |
| `test_seller_pages.py` | 37 | Real-database integration: handle validation, plan gating, publish gate, media reorder, pagination, block filters, follows |
| `test_redis_cache.py` | 9 | Cache behaviour and in-memory fallback |
| `test_p0_correctness.py` | 7 | Idempotency, webhook HMAC + replay, MIME whitelist, security headers |
| `test_routes.py` | 4 | Auth and role guards |

> **The seller-page tests require a real PostgreSQL instance.** Set `TEST_DATABASE_URL` and provision the schema with `scripts/migrate.py apply`. They use per-test `asyncSetUp` (not `asyncSetUpClass`, which Python 3.10's `IsolatedAsyncioTestCase` does not support) and `TRUNCATE users, categories` to reset. Running the suite truncates the fixture — re-seed before any visual check.

Real-database tests earned their keep. They caught bugs no mock would have: avatar/cover URLs that never resolved because the media join was missing, a hand-rolled `get_my_page` response that had drifted from the shared select, `str` columns reaching asyncpg, `fetchval` on `UPDATE … RETURNING 1` returning `1` instead of a count, duplicate `sort_order` values from partial reorders breaking infinite-scroll pagination, and `jsonb` returned as raw text.

### Frontend
```bash
cd frontend
npm run build     # production bundle compile check
npm run smoke     # hermetic server-render assertions (33 assertions, 2 scenarios)
```

`npm run smoke` bundles and renders `StoreView` (the pure presentational component) with `react-dom/server` and asserts the markup — a populated pro-tier page and an empty free-tier draft. Artifacts are gitignored. This is a build-time check, not a browser test: **no visual, scroll, or lightbox behaviour is verified automatically.**

### CI
Four jobs in `.github/workflows/ci.yml`:

| Job | Verifies |
|---|---|
| `test-migrations` | Migrations apply in order on an empty DB; filenames unique and well-formed; legacy `init.sql` upgrades; V7 objects and constraints exist |
| `test-backend-core` | Provisions the schema from `db/migrations`, runs the full backend suite against real PostgreSQL + pgvector |
| `test-ai-services` | Seller-agent and recommendation service suites |
| `build-frontend` | `npm run build` and `npm run smoke` |

---

## 8. Documentation Inventory

| Document | Purpose | Authority |
|---|---|---|
| [README.md](./README.md) | Overview, architecture, quickstart, credentials | Current |
| [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) | Master documentation: architecture, schema, API matrix, runbooks, **gaps register** | Current |
| [docs/contracts.md](./docs/contracts.md) | Canonical contracts: response envelope, state machines, plan tiers, route names | **Highest** — code is ground truth |
| [product_bible.md](./product_bible.md) | UX specification for every page, edge-case contracts, acceptance criteria | Design spec |
| [DESIGN.md](./DESIGN.md) | Design tokens, palette, type scale, component ergonomics | Design spec |
| [implementation_plan.md](./implementation_plan.md) | Phased production-hardening plan with per-phase status | Roadmap |
| [walkthrough.md](./walkthrough.md) | Catalog ingestion engine, admin scaling work, seller-page build record | Historical record |

> **Schema ground truth is `db/migrations/`**, not this documentation. If the two disagree, the migrations are correct and the docs are stale.
