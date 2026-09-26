# Vyapari — Master Project Documentation & Technical Knowledge Base

> **Platform:** Vyapari Autonomous E-Commerce Operations & Personalization Platform  
> **Repository:** `Kings-man-6969/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform`  
> **Scope:** Complete architectural decisions, technical specifications, system mechanics, data schemas, security boundaries, and operational runbooks.

> ### ⚠️ Read This First
>
> **1. The schema of record is `db/migrations/V1`–`V7`, not this document.** Every column list, type and `CHECK` constraint below is transcribed from the migrations. Where prose and migration disagree, the migration is right.
>
> **2. Not everything described here is built.** This document has historically described the platform's *intended* surface, which overstated it. Features that are scaffolded-but-hollow (fake image uploads, simulated payments, six-integer analytics) and features that are absent (no cancellation, no refunds, no forgot-password, no rate limiting) are now called out explicitly — inline with ⚠️ markers, and collected in [§15](#15-known-gaps--hollow-features-register). **That register is the honest summary of this platform's maturity.**
>
> **3. Two services are not deployed.** `service-recommendation` and `service-seller-agent` are compute-heavy and are absent from production. Anything depending on them degrades, and the degradation is documented rather than hidden.

---

## Table of Contents

1. [Executive Summary & Project Vision](#1-executive-summary--project-vision)
2. [Architectural Philosophy & Decision Log](#2-architectural-philosophy--decision-log)
   - [Pragmatic Production vs. Overengineering](#pragmatic-production-vs-overengineering)
   - [Backend Core Migration: Node.js/Express to Python/FastAPI](#backend-core-migration-nodejsexpress-to-pythonfastapi)
   - [Core Security Boundary Axiom](#core-security-boundary-axiom)
   - [Single-Origin Gateway Model](#single-origin-gateway-model)
3. [System Topology & Infrastructure](#3-system-topology--infrastructure)
   - [High-Level Architecture Diagram](#high-level-architecture-diagram)
   - [Container & Service Registry](#container--service-registry)
   - [Network Topologies & Port Map](#network-topologies--port-map)
4. [Database Architecture & Migrations](#4-database-architecture--migrations)
   - [Database Role Privilege Separation](#database-role-privilege-separation)
   - [Migration Runner](#migration-runner)
   - [Migration History (V1 – V7)](#migration-history-v1--v7)
   - [Entity Relationship Details & Schemas](#entity-relationship-details--schemas)
   - [Seller Showcase Page Schema (V7)](#seller-showcase-page-schema-v7)
   - [Vector Search & pgvector HNSW Configuration](#vector-search--pgvector-hnsw-configuration)
5. [Security & Cryptographic Architecture](#5-security--cryptographic-architecture)
   - [Authentication & Token Family Rotation (RFC 6749)](#authentication--token-family-rotation-rfc-6749)
   - [Atomic Order Idempotency & Concurrency](#atomic-order-idempotency--concurrency)
   - [Payment Gateway Webhook Verification](#payment-gateway-webhook-verification)
   - [SSRF Elimination & Upload Pipeline](#ssrf-elimination--upload-pipeline)
   - [Security Headers, CSP & Telemetry Ingestion](#security-headers-csp--telemetry-ingestion)
6. [Storefront & Customer Journey](#6-storefront--customer-journey)
   - [Natural Language Query (NLQ) Search Engine](#natural-language-query-nlq-search-engine)
   - [Real-Time Autocomplete Popover](#real-time-autocomplete-popover)
   - [Faceted Catalog Discovery (`/explore`)](#faceted-catalog-discovery-explore)
   - [3-Column Product Detail Page (PDP) & Buy Box](#3-column-product-detail-page-pdp--buy-box)
   - [Customer Reviews & Verified Purchase Gating](#customer-reviews--verified-purchase-gating)
   - [Cart, Checkout & Order Lifecycle](#cart-checkout--order-lifecycle)
   - [Customer Self-Service (Wishlist, Addresses, Notifications)](#customer-self-service)
7. [Seller Operations Console (`/seller/*`)](#7-seller-operations-console-seller)
   - [4-Step Regulatory KYC Onboarding](#4-step-regulatory-kyc-onboarding)
   - [Seller Dashboard & Executive Analytics](#seller-dashboard--executive-analytics)
   - [Product Catalog & Inventory Management](#product-catalog--inventory-management)
   - [AI Listing Studio & Content Synthesis](#ai-listing-studio--content-synthesis)
   - [Inventory Velocity Advisor](#inventory-velocity-advisor)
   - [Order Fulfillment Desk & Logistics Tracking](#order-fulfillment-desk--logistics-tracking)
   - [Reviews Desk & Official Merchant Replies](#reviews-desk--official-merchant-replies)
   - [Human-in-the-Loop Approvals Queue](#human-in-the-loop-approvals-queue)
   - [Seller AI Copilot Chat & Support RAG](#seller-ai-copilot-chat--support-rag)
   - [Premium Seller Showcase Pages (`/store/:handle`)](#premium-seller-showcase-pages-storehandle)
8. [Admin Governance Desk (`/admin/*`)](#8-admin-governance-desk-admin)
   - [Platform Executive Overview](#platform-executive-overview-admin)
   - [User Governance & Role Elevation](#user-governance--role-elevation-adminusers)
   - [Merchant KYC Verification Workflow](#merchant-kyc-verification-workflow-adminsellers)
   - [Global Catalog Moderation & Takedowns](#global-catalog-moderation--takedowns-adminproducts)
   - [Category Taxonomy Management](#category-taxonomy-management-admincategories)
   - [System Diagnostics & Container Observability](#system-diagnostics--container-observability-adminsystem)
9. [AI Microservices Deep Dive](#9-ai-microservices-deep-dive)
   - [Recommendation Microservice (`service-recommendation`)](#recommendation-microservice-service-recommendation)
   - [Seller Agent Microservice (`service-seller-agent`)](#seller-agent-microservice-service-seller-agent)
   - [Asynchronous Celery Architecture & Deduplication](#asynchronous-celery-architecture--deduplication)
   - [Redis Quota Management & Rate Limiting](#redis-quota-management--rate-limiting)
10. [Frontend Architecture & Global Design System](#10-frontend-architecture--global-design-system)
    - [Design Tokens, Typography & Color Palette](#design-tokens-typography--color-palette)
    - [Application State Management & Contexts](#application-state-management--contexts)
    - [Global Error Boundary & Telemetry Reporting](#global-error-boundary--telemetry-reporting)
11. [Complete API Reference & Router Matrix](#11-complete-api-reference--router-matrix)
12. [Verification, Testing, & Quality Assurance](#12-verification-testing--quality-assurance)
13. [DevOps, Deployment, & Disaster Recovery](#13-devops-deployment--disaster-recovery)
    - [Docker Compose Orchestration](#docker-compose-orchestration)
    - [Automated Backup & Restore Verification Drill](#automated-backup--restore-verification-drill)
    - [CI/CD Pipeline (.github/workflows/ci.yml)](#cicd-pipeline-githubworkflowsciyml)
14. [Environment Configuration Reference](#14-environment-configuration-reference)
15. [Known Gaps & Hollow Features Register](#15-known-gaps--hollow-features-register)
    - [Missing Entirely](#missing-entirely)
    - [Hollow — Present but Misleading](#hollow--present-but-misleading)
    - [Deployed-State Gaps](#deployed-state-gaps)
    - [Data Integrity Defects](#data-integrity-defects)
16. [Corrected Documentation Log](#16-corrected-documentation-log)

---

## 1. Executive Summary & Project Vision

**Vyapari** (Sanskrit/Hindi for *Merchant* or *Trader*) is an enterprise-grade, multi-role autonomous e-commerce platform designed to bridge retail commerce with generative AI agentic operations. Benchmarked against modern global and regional giants (**Amazon**, **Flipkart**, **Shopify**), Vyapari re-engineers how online marketplaces balance consumer personalization, merchant automation, and platform governance.

### Core Distinctions
- **Dual-AI Architecture**: Employs two specialized microservices:
  1. *Dense Semantic Search & Personalization* via SentenceTransformers (`all-MiniLM-L6-v2`) and pgvector HNSW cosine similarity.
  2. *Autonomous Merchant Agent Copilot* powered by Google Gemini 1.5 Flash, executing listing creation, inventory runway forecasting, support policy RAG, and automated operational suggestions.
- **Human-in-the-Loop Safeguards**: An AI agent cannot unilaterally modify live prices or deduct stock. All agent actions produce non-destructive drafts routed to an Approvals Queue for seller confirmation.
- **ACID Commerce Guarantees**: Enforces transactional consistency using PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), atomic idempotency tables, cryptographically verified payment webhooks, and token family rotation with automatic reuse detection.
- **Multi-Device Parity**: 37 production screens built in React 18, featuring desktop 3-column Product Detail Pages (PDPs), floating Buy Boxes, debounced search suggestion popovers, and sticky mobile purchase bars.

---

## 2. Architectural Philosophy & Decision Log

### Pragmatic Production vs. Overengineering

During the development and hardening phases, architectural decisions were evaluated using a strict criterion: *implement robust correctness and security guarantees while rejecting unnecessary enterprise complexity.*

| Area | Overengineered Approach (Rejected) | Pragmatic Production Approach (Adopted) | Rationale |
|---|---|---|---|
| **Tenant Isolation** | Complex PostgreSQL Row-Level Security (RLS) on 5+ tables with pool session variables (`SET LOCAL app.seller_id`). | **Database Role Privileges** (`vyapari_agent` physically lacks write access) + strict JWT-derived query parameterization (`WHERE seller_id = $1`). | Zero risk of connection pool context leakage, significantly easier debugging, and native SQL query plan optimization. |
| **Image Security / SSRF** | Multi-bucket quarantine pipelines, ClamAV Lambda/ECS containers, S3 event fanout queues. | **Direct S3 Presigned PUT** (MIME whitelist, max 5MB) + in-memory Pillow byte inspection (rejects SVGs, corrupt magic bytes, checks dimensions). | Eliminates server SSRF vulnerability completely by never downloading arbitrary external URLs on the backend. |
| **Payment Webhooks** | 7-state distributed transition machine with out-of-order replay queues. | **HMAC-SHA256 signature verification** + atomic `payment_events` table deduplication + single-transaction conditional order update (`WHERE payment_status = 'pending'`). | Guarantees exact-once processing of payment milestones without complex distributed state coordination. |
| **Order Idempotency** | Multi-tier distributed lease managers and Redis distributed locks (Redlock). | **Single-transaction DB record reservation**: `INSERT INTO idempotency_records ... ON CONFLICT (user_id, key) DO NOTHING` within the order transaction. | ACID-compliant with the database write. If the database crashes, both the order and the idempotency record roll back together. |
| **Background Tasks** | Custom PostgreSQL task-leasing tables with polling loops. | **Celery + Redis Broker** with `task_acks_late=True` and task-level status deduplication against `agent_tasks`. | Standard battle-tested worker model with zero custom state machines to maintain. |
| **Database Roles** | 4 separate database users with complex DDL/DML permission matrices. | **2 Clean Roles**: `vyapari_app` (backend core full DML) and `vyapari_agent` (read catalog, write drafts/approval queue, zero write to commerce tables). | Directly enforces the core security boundary at the database protocol level. |
| **Frontend Telemetry** | Full user-agent parsing pipelines, network speed monitoring, device fingerprinting. | **React Error Boundary** logging fatal crashes to `/api/telemetry/errors` with payload bounds (10 KB) and strict IP rate limiting. | Captures production UI crashes without degrading client performance or violating user privacy. |

---

### Backend Core Migration: Node.js/Express to Python/FastAPI

The original platform architecture specified a Node.js/Express gateway for `backend-core`. In Phase 0-Hardening, the core was completely migrated to **Python FastAPI (`backend-core-py`)**.

#### Drivers of the Migration:
1. **Unified Python Ecosystem**: Both AI microservices (`service-recommendation` and `service-seller-agent`) run on Python 3.11. Migrating `backend-core` to Python unified linting, dependency management, serialization models (Pydantic v2), and testing across the entire stack.
2. **High-Performance Asynchronous DB Access**: Implemented using `asyncpg` with a pooled connection strategy, yielding sub-millisecond query latencies and native support for PostgreSQL data types (UUID, JSONB, arrays).
3. **Pydantic v2 Type Safety & OpenAPI Schema Generation**: Elimination of runtime type drift. Pydantic validates incoming request bodies, query strings, and headers automatically, generating interactive Swagger docs at `/api/docs`.
4. **Parity and Compatibility**: The migration preserved identical HTTP route signatures, error response shapes (`{success: false, error: {code, message, details}}`), and cookie configurations, requiring zero breaking changes in the React frontend.

---

### Core Security Boundary Axiom

> **Axiom**: Autonomous AI agents generate insights, drafts, and suggestions; the core application authorizes and executes commerce actions.

The agent microservice (`service-seller-agent`) is architecturally forbidden from directly modifying:
- `products.price` or `products.stock_qty`
- `orders` or `order_items`
- `users` or `seller_profiles`
- `payments` or transaction records

When an agent proposes an optimization (e.g., lowering a price to clear slow inventory), it writes to `agent_drafts` / `approvals`. The human seller reviews the proposal on `/seller/approvals`. If approved, `backend-core` (running as `vyapari_app`) executes the mutation.

---

### Single-Origin Gateway Model

The browser client interacts **exclusively** with `backend-core-py` on port `:8000` (or reverse-proxied via NGINX/Cloudflare in production):
- `/api/products/*`, `/api/orders/*`, `/api/auth/*` are handled directly by `backend-core-py`.
- `/api/recommendations/*` is proxied internally over Docker bridge network to `service-recommendation:8001`.
- `/api/ai/*` is proxied internally over Docker bridge network to `service-seller-agent:8002`.

**Benefits:**
- Eliminates CORS pre-flight complexity across multiple domains.
- Internal AI services have zero public internet ingress, defending against external probing and denial-of-service.
- Centralizes authentication, rate limiting, and security header injection in one gateway.

---

## 3. System Topology & Infrastructure

### High-Level Architecture Diagram

```text
                                [ CLIENT VIEWPORTS ]
                        Desktop (1440px) · Tablet · Mobile (375px)
                                        │
                                        ▼ HTTPS (Port 3000 / 80)
                        ┌───────────────────────────────┐
                        │     Frontend (React 18/Vite)  │
                        │    38 Pages · Vanilla CSS     │
                        └───────────────┬───────────────┘
                                        │ REST / Cookies
                                        ▼ (Port 8000)
                        ┌───────────────────────────────┐
                        │    Backend Core (FastAPI)     │
                        │   Gateway, Auth & Commerce    │
                        └───┬───────────┬───────────┬───┘
                            │           │           │
         ┌──────────────────┘           │           └──────────────────┐
         │ Proxy                        │ Direct                       │ Proxy
         ▼ (Port 8001)                  ▼                              ▼ (Port 8002)
┌───────────────────────┐   ┌───────────────────────┐      ┌───────────────────────┐
│Service-Recommendation │   │    PostgreSQL 16 DB   │      │ Service-Seller-Agent  │
│  FastAPI + pgvector   │──▶│   pgvector (384-dim)  │◀─────│  FastAPI + Gemini     │
│ (all-MiniLM-L6-v2)    │   │      Port 5432        │      │  Port 8002            │
└───────────────────────┘   └───────────▲───────────┘      └───────────┬───────────┘
                                        │                              │
                                        │ Cache / Bus                  ▼ Task Enqueue
                                        │                          ┌───────────────┐
                                        │                          │ Celery Worker │
                                        │                          │ (Redis Broker)│
                                        │                          └───────┬───────┘
                                        │                                  │
                                ┌───────┴───────┐                          │
                                │    Redis 7    │◀─────────────────────────┘
                                │  (Port 6379)  │
                                └───────────────┘
```

---

### Container & Service Registry

The complete system is containerized via Docker Compose:

| Container Name | Base Image / Runtime | Exposed Port | Purpose |
|---|---|---|---|
| `vyapari-postgres` | `pgvector/pgvector:pg16` | `5432:5432` | Primary ACID relational store + pgvector HNSW cosine embeddings. |
| `vyapari-db-migrate` | `python:3.11-slim` | — | **One-shot job.** Runs `scripts/migrate.py apply` to completion, then exits. Downstream services wait for a successful exit via a TCP healthcheck, not a sleep. |
| `vyapari-redis` | `redis:7-alpine` | `6379:6379` | Entitlement caching, query caching, Celery message broker. ⚠️ The rate limiter and AI quota counters it was originally meant to serve are **not implemented**. |
| `vyapari-backend-core` | `python:3.11-slim` | `8000:8000` | API Gateway, authentication, orders, payments, approvals, router proxy. |
| `vyapari-recommendation` | `python:3.11-slim` | `8001:8001` | Dense embeddings generation, semantic similarity scoring, personalized feeds. |
| `vyapari-seller-agent` | `python:3.11-slim` | `8002:8002` | Gemini 1.5 Flash agent, inventory advisor, RAG support, Celery worker tasks. |
| `vyapari-frontend` | `node:20-alpine` (Vite) | `3000:3000` | React 18 SPA serving Customer, Seller, and Admin interfaces. |

---

### Network Topologies & Port Map

- **External Host Access**:
  - `3000`: Frontend React web application
  - `8000`: Backend Core API Gateway (includes `/api/docs` OpenAPI viewer)
  - `5432`: PostgreSQL direct access for administrative migrations
  - `6379`: Redis direct monitoring
  - `8001`, `8002`: Internal AI services (exposed for testing; isolated in production)
- **Container Interconnect**:
  - All services share a dedicated default Docker bridge network.
  - DNS resolution uses container service names: `db`, `redis`, `service-recommendation`, `service-seller-agent`, `backend-core`.

---

## 4. Database Architecture & Migrations

### Database Role Privilege Separation

Vyapari implements least-privilege role segregation (`V5__agent_privileges.sql`):

1. **`vyapari_admin`**: Superuser for running DDL migrations, creating extensions, and managing users.
2. **`vyapari_app`**: Runtime user for `backend-core-py`. Holds full DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on all tables.
3. **`vyapari_agent`**: Restricted runtime user for `service-seller-agent`.
   - **Allowed**: `SELECT` on `products`, `categories`, `seller_profiles`, `reviews`, `product_stats_daily`.
   - **Allowed**: `INSERT` into `agent_drafts`, `approvals`, `agent_tasks`, `agent_audit_log`.
   - **Forbidden / Revoked**: Hard `REVOKE` on `UPDATE`, `DELETE` across all tables. Cannot modify `orders`, `users`, or `products`.

---

### Migration Runner

Migrations are the single source of truth for schema. They live in `db/migrations/` as `V<N>__<slug>.sql` and are applied by `scripts/migrate.py` — never by hand.

| Command | Purpose |
|---|---|
| `python scripts/migrate.py status` | Applied / pending / checksum-drift per migration |
| `python scripts/migrate.py plan` | What `apply` would do, without doing it |
| `python scripts/migrate.py apply [--upto V7]` | Apply pending migrations in version order |
| `python scripts/migrate.py baseline --upto V1` | Mark a legacy `db/init.sql` database as already at V1, then upgrade forward |

Guarantees the runner provides:

- **SHA-256 checksums** — an already-applied migration whose file has been edited is reported as tampering rather than silently skipped or re-run.
- **Per-migration transactions** — a failing migration rolls back on its own without poisoning the ones before it.
- **PostgreSQL advisory lock** — two concurrent runners cannot interleave DDL.
- **Password redaction** — connection strings are never printed to logs.
- **Deterministic ordering** — a V5-before-V6 ordering bug existed and is now impossible by construction.

`scripts/setup_remote_db.py` wires the same runner for a remote instance and now **exits non-zero on failure**, so a failed bootstrap cannot masquerade as success.

`db/init.sql` and `db/seed.sql` are retained for Compose mounts. CI asserts that a legacy `init.sql` database still upgrades cleanly.

---

### Migration History (V1 – V7)

All database migrations reside in `db/migrations/` and execute sequentially:

1. **`V1__init_schema.sql`**:
   - Enables `uuid-ossp` and `vector` extensions.
   - Creates baseline core tables: `users`, `seller_profiles`, `categories`, `products`, `product_embeddings`, `product_stats_daily`, `orders`, `order_items`, `cart_items`, `reviews`, `review_helpful`, `wishlists`, `user_addresses`, `notifications`, `agent_drafts`, `approvals`.
   - Sets up HNSW vector cosine distance index (`vector_cosine_ops`).
2. **`V2__refresh_token_sessions.sql`**:
   - Creates `refresh_token_sessions` table.
   - Enforces SHA-256 hashed refresh tokens, family UUIDs for replay detection, IP address tracking, and client user-agent logging.
3. **`V3__idempotency_and_payments.sql`**:
   - Creates `idempotency_records` table with unique constraint on `(user_id, idempotency_key)`.
   - Creates `payment_events` table for webhook deduplication.
   - Adds payment provider transaction IDs and refund tracking columns to `orders`.
4. **`V4__add_indexes.sql`**:
   - Adds composite indexes for hot query paths: `orders(user_id, created_at DESC)`, `products(seller_id, status)`, `cart_items(cart_id)`, `agent_approval_queue(seller_id, status, created_at DESC)`, `user_interactions(product_id, created_at DESC)`, `reviews(product_id, created_at DESC)`. No price-column index — the column is `price`, not `price_cents`.
5. **`V5__agent_privileges.sql`**:
   - Creates `vyapari_agent` role with least-privilege grants and explicit revokes.
6. **`V6__agent_audit_log.sql`**:
   - Creates immutable `agent_audit_log` with prompt versioning, input/output token counters, execution latencies, and seller correlation.
7. **`V7__seller_pages.sql`**:
   - Creates 7 tables for premium seller showcase pages: `seller_pages`, `seller_media`, `seller_highlights`, `seller_highlight_items`, `seller_page_blocks`, `seller_subscriptions`, `seller_page_follows`.
   - Resolves a **circular FK** (`seller_pages.avatar_media_id` → `seller_media`, which itself FKs back to `seller_pages`) using an idempotent `DO $$` block, because the target table does not exist at declaration time.
   - Enforces one live subscription per seller with the **partial unique index** `uq_seller_live_subscription ON (seller_id) WHERE status IN ('trialing','active')` — a plain unique on `seller_id` would wrongly forbid subscription history.
   - Adds domain `CHECK` constraints: `theme_accent` hex format, video posters required, positive media dimensions, single-target highlight items, block scheduling window ordering, `cta_href` same-origin-or-`https` only.
   - Introduces `set_updated_at()` and **5 `BEFORE UPDATE` triggers**. The rest of the schema declares `updated_at` columns but never refreshed them — there were zero triggers in the project before this. Legacy tables remain untriggered.

---

### Entity Relationship Details & Schemas

> ⚠️ **This section was wrong and has been corrected.** The previous revision documented columns that do not exist in any migration: `users.full_name`, `users.status`, `seller_profiles.store_slug`, `seller_profiles.pan`/`gstin`/bank columns as first-class, `seller_profiles.kyc_status`, `seller_profiles.return_policy`/`shipping_policy`, `products.sku`, `products.price_cents`, `products.specifications`, `products.features`, `products.rating`, `products.review_count`, `orders.order_number`, `orders.payment_status`, `orders.*_cents`, and an `order_items` table that did not exist in that form. The listings below are transcribed from `V1__init_schema.sql`.

#### Core Relational Tables
```text
  ┌──────────────┐         1:1         ┌──────────────────┐
  │    users     ├─────────────────────┤ seller_profiles  │
  └──────┬───────┘                     └──────────────────┘
         │
         │ 1:N
         ▼
  ┌──────────────┐         1:N         ┌──────────────────┐
  │    orders    │                     │     products     │
  └──────┬───────┘                     └────────┬─────────┘
         │ 1:N                                  │ 1:1
         ▼                                      ▼
  ┌──────────────┐                     ┌──────────────────┐
  │ order_items  │                     │product_embeddings│
  └──────────────┘                     └──────────────────┘
```

Note that `products.seller_id` and `order_items.seller_id` reference **`users(id)`**, not `seller_profiles(id)`. A seller's identity as a merchant is their `users` row; `seller_profiles` is a 1:1 extension carrying presentation and KYC data.

#### Full Table Inventory

`V1` (32 tables): `users`, `seller_profiles`, `addresses`, `categories`, `products`, `carts`, `cart_items`, `wishlists`, `wishlist_items`, `orders`, `order_items`, `order_status_history`, `payments`, `reviews`, `notifications`, `user_interactions`, `product_embeddings`, `user_preference_embeddings`, `product_stats_daily`, `recommendation_cache`, `agent_tasks`, `agent_action_logs`, `product_drafts`, `inventory_advisories`, `support_draft_replies`, `agent_approval_queue`, `policy_documents`, `policy_chunks`, `agent_chat_messages`.

`V2`: `refresh_token_sessions` · `V3`: `idempotency_records`, `payment_events` · `V4`: indexes only · `V5`: role grants only · `V6`: `agent_audit_log` · `V7`: 7 seller-page tables.

#### Detailed Column Specifications

**`users`**
- `id` (UUID PK, default `gen_random_uuid()`)
- `name` (VARCHAR 120, NOT NULL) — *not* `full_name`
- `email` (VARCHAR 150, UNIQUE, NOT NULL)
- `password_hash` (TEXT, NOT NULL — bcrypt `$2a$`)
- `role` (VARCHAR 20, NOT NULL, CHECK — `'customer' | 'seller' | 'admin'`)
- `phone` (VARCHAR 20), `is_active` (BOOLEAN, default `true`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

> There is **no `status` column**. Suspension is `is_active = false`; KYC state is `seller_profiles.is_verified`.

**`seller_profiles`**
- `id` (UUID PK), `user_id` (UUID FK → `users.id`, UNIQUE, NOT NULL, CASCADE)
- `store_name` (VARCHAR 150, NOT NULL) — *no `store_slug`; public handles live in `seller_pages.handle` (V7)*
- `description` (TEXT), `logo_url` (TEXT)
- `business_info` (JSONB, default `'{}'`) — `{gstin, pan, business_type, brand}`
- `rating_avg` (NUMERIC(3,2)), `is_verified` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**`products`**
- `id` (UUID PK)
- `seller_id` (UUID FK → **`users.id`**, NOT NULL, RESTRICT)
- `category_id` (UUID FK → `categories.id`, NOT NULL, RESTRICT)
- `title` (VARCHAR 200, NOT NULL), `slug` (VARCHAR 250, UNIQUE, NOT NULL)
- `description` (TEXT, **NOT NULL**)
- `price` (**NUMERIC(10,2)** NOT NULL, CHECK `price >= 0`) — *rupees, not cents*
- `compare_at_price` (NUMERIC(10,2), CHECK `compare_at_price >= price`)
- `stock_qty` (INTEGER NOT NULL, default 0, CHECK `stock_qty >= 0`)
- `images` (JSONB, default `'[]'`), `attributes` (JSONB, default `'{}'`)
- `status` (VARCHAR 20, default `'draft'`, CHECK — `'draft' | 'active' | 'out_of_stock' | 'archived'`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

> No `sku`, no `specifications`, no `features`, no denormalized `rating`/`review_count`. Aggregate rating is computed from `reviews` at read time. **No variants** — all stock is tracked at product level.

**`orders`**
- `id` (UUID PK), `user_id` (UUID FK → `users.id`, NOT NULL, RESTRICT)
- `total_amount` (NUMERIC(10,2) NOT NULL, CHECK `>= 0`)
- `status` (VARCHAR 30, default `'pending'`, CHECK — `'pending' | 'paid' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled'`)
- `shipping_address` (JSONB NOT NULL — snapshot at purchase time)
- `created_at`, `updated_at` (TIMESTAMPTZ)

> No `order_number`, no `payment_status` column, no `*_cents` breakdown. Courier and tracking live on `order_status_history` / the seller fulfillment path. **The order total is a single scalar** — there is no subtotal/tax/shipping decomposition in the schema.

**`order_items`**
- `id` (UUID PK), `order_id` (FK → `orders.id`, CASCADE)
- `product_id` (FK → `products.id`, NOT NULL, RESTRICT), `seller_id` (FK → `users.id`, NOT NULL, RESTRICT)
- `quantity` (INTEGER NOT NULL, CHECK `> 0`), `price_at_purchase` (NUMERIC(10,2) NOT NULL, CHECK `>= 0`)

**`payments`**
- `id` (UUID PK), `order_id` (FK → `orders.id`, CASCADE)
- `amount` (NUMERIC(10,2) NOT NULL)
- `status` (VARCHAR 30 NOT NULL, CHECK — `'created' | 'success' | 'failed' | 'cancelled' | 'pending_verification'`)
- `payment_gateway` (VARCHAR 50, default `'razorpay'`), `provider_ref` (VARCHAR 150)
- `provider_payload` (JSONB, default `'{}'`)

> Status is `success`, not `captured`. There is no `refunded` value.

**`idempotency_records`** (V3)
- `user_id`, `key` (idempotency key), `request_hash` (SHA-256 of payload), `status` (`in_progress` | `completed`), `response` (JSONB), `response_code` (INTEGER), `expires_at`
- `UNIQUE (user_id, key)` — the column is named `key`, not `idempotency_key`

**`product_stats_daily`**
- `product_id` (FK), `stat_date` (DATE NOT NULL) — *named `stat_date`, not `date`*
- `views`, `clicks`, `purchases` (INTEGER) — *no `impressions`/`cart_adds`/`orders`*
- `region` (VARCHAR 100 NOT NULL, default `'global'` — prevents a NULL PK collision), `revenue` (NUMERIC(12,2))
- `PRIMARY KEY (product_id, stat_date, region)`
- ⚠️ **Nothing writes to this table.** It is read by the admin metrics endpoint and is always empty.

---

### Seller Showcase Page Schema (V7)

Seven tables, added for premium `/store/:handle` pages. `handle` is the public slug; the storefront name lives in `seller_pages`, decoupled from `seller_profiles.store_name`.

| Table | Purpose | Key constraints |
|---|---|---|
| `seller_pages` | The page itself, 1:1 with `users` | `handle` UNIQUE matching `^[a-z0-9][a-z0-9_-]{2,29}$`; `theme_accent` hex CHECK; `avatar_media_id`/`cover_media_id` set later via `DO $$` |
| `seller_media` | Photo/video grid; `product_id` makes posts shoppable | `media_type` CHECK; video requires `poster_url`; dimensions positive; `sort_order` for grid ordering |
| `seller_highlights` | Circular story highlights | Ordered, soft-deletable via `is_active` |
| `seller_highlight_items` | Items inside a highlight | `num_nonnulls(media_id, product_id) = 1` — exactly one target |
| `seller_page_blocks` | Page composition | 6 block types CHECK; `ends_at > starts_at`; `cta_href` restricted to `^/` or `^https://` |
| `seller_subscriptions` | Plan entitlement | `plan` CHECK `free\|pro\|elite`; `status` CHECK; `price_inr >= 0`; **partial unique index** for one live sub per seller |
| `seller_page_follows` | Follow graph | Composite PK `(seller_page_id, user_id)` |

**Billing is intentionally not wired.** `seller_subscriptions` is entitlement-only: a row is granted by an admin or by a future gateway webhook, and Razorpay Subscriptions will attach to an existing entitlement row later. `POST /api/seller-pages/mine/plan` is **admin-only** — a seller must not be able to grant themselves a plan, which would be a privilege-escalation bug.

**Capacity enforcement** lives in `seller_page_service.TIERS` (free 12 media / 0 highlights / 2 blocks; pro 120/8/8; elite 600/20/20) and is checked with `require_feature` / `require_capacity` on every write, returning `402 PLAN_UPGRADE_REQUIRED` or `402 PLAN_LIMIT_REACHED`. Entitlements are cached 300 s in Redis, so a lapsed subscription serves premium content for at most five minutes.

---

### Vector Search & pgvector HNSW Configuration

Product semantic embeddings are generated as **384-dimensional dense vectors** by `all-MiniLM-L6-v2` and indexed via pgvector:

```sql
CREATE TABLE product_embeddings (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    embedding vector(384) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_embeddings_hnsw 
ON product_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### Vector Search Query Mechanics
When a user searches for a query $Q$:
1. `service-recommendation` encodes $Q$ into 384-dim normalized vector $\vec{v}_q$.
2. PostgreSQL computes cosine similarity via:
   $$\text{similarity} = 1 - (\text{embedding} \Leftrightarrow \vec{v}_q)$$
3. Queries enforce `status = 'active' AND stock_qty > 0` directly in SQL, ensuring out-of-stock items are never recommended.

---

## 5. Security & Cryptographic Architecture

### Authentication & Token Family Rotation (RFC 6749)

To achieve bank-grade authorization security, Vyapari implements token family rotation:
- **Access Tokens**: Short-lived JWTs (15-minute expiration) containing `{sub: user_id, role, email}`. Stored **in memory only** by the React client. Never saved to `localStorage` or `sessionStorage` (preventing XSS data theft).
- **Refresh Tokens**: Opaque 256-bit cryptographically secure strings (`secrets.token_urlsafe(32)`). Stored exclusively in an `HttpOnly`, `SameSite=Strict`, `Path=/api/auth/refresh` cookie.
- **Family UUID & Breach Detection**:
  - Each refresh token belongs to a `family_id` (UUID).
  - When a client refreshes, the existing token is marked as `is_used = TRUE`, and a new token with the same `family_id` is issued.
  - If an attacker intercepts and attempts to reuse an old token (`is_used == TRUE`), the backend detects a replay attack, immediately revokes **all** tokens belonging to that `family_id`, and requires full re-authentication.

---

### Atomic Order Idempotency & Concurrency

#### 1. Inventory Stock Concurrency (Contract C2)
When an order is placed, PostgreSQL executes:
```sql
SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE;
```
- Holds an exclusive row-level lock on the product record.
- If `stock_qty < requested_quantity`, rolls back transaction and returns `HTTP 409 Conflict` with `{code: 'INSUFFICIENT_STOCK', available: N}`.
- If sufficient, updates `stock_qty = stock_qty - requested_quantity` atomically.

#### 2. Atomic Order Idempotency
Checkout submissions require an `Idempotency-Key` HTTP header.
Within the order transaction:
```sql
INSERT INTO idempotency_records (user_id, idempotency_key, request_hash)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, idempotency_key) DO NOTHING;
```
- If the insert fails to return a row, the request was already submitted. The system returns the cached response.
- If the payload's SHA-256 hash does not match `request_hash`, it rejects with `HTTP 422` and code `IDEMPOTENCY_PAYLOAD_MISMATCH` (payload tampering protection).

The column is named `key`, not `idempotency_key`, and the table also carries `status`, `response`, `response_code` and `expires_at` — the cached-response columns this insert does not populate in a single statement.

> ⚠️ **The decrement is never balanced by an increment.** This section previously described automatic stock restoration on payment failure, timeout, or cancellation. **None of that is implemented.** There is no cancel route, no refund path, and no abandoned-order sweeper, so an abandoned `pending` order permanently consumes its inventory. See [§15](#15-known-gaps--hollow-features-register).

---

### Payment Gateway Webhook Verification

> ⚠️ **The gateway is Razorpay and it is only half-wired.** HMAC verification and event deduplication below are real and correct. But `create_order` never writes `razorpay_order_id`, so the order-match branch `WHERE razorpay_order_id = $2` can never fire — only the `id::text` fallback can. `CheckoutPage.jsx` sends a literal `pay_rzp_mock_${Date.now()}` as the provider reference. **No real money has ever moved through this platform.** The remediation order is: write `razorpay_order_id` at order creation → implement `POST /api/payments/create` → remove the mock reference → add cancel/refund → add the abandoned-order sweep.
1. **HMAC-SHA256 Signature Verification**:
   The webhook endpoint (`POST /api/payments/webhook`) computes:
   $$\text{expected} = \text{HMAC-SHA256}(\text{raw\_body}, \text{RAZORPAY\_WEBHOOK\_SECRET})$$
   Validates signatures using constant-time comparison (`hmac.compare_digest`).
2. **Event Deduplication**:
   Inserts the event ID into `payment_events`:
   ```sql
   INSERT INTO payment_events (event_id, provider, payload)
   VALUES ($1, 'razorpay', $2)
   ON CONFLICT (event_id) DO NOTHING;
   ```
   If already processed, returns `HTTP 200 OK` immediately without repeating state mutations.
3. **Payment Failure Recovery**:
   ⚠️ **NOT IMPLEMENTED.** This section previously described `GET /api/payments/status/:orderId` reconciling a delayed webhook on page return. That endpoint does not exist. `/api/payments` exposes only `POST /webhook`.

---

### SSRF Elimination & Upload Pipeline

**⚠️ This entire pipeline is currently hollow.** What follows is the design; what ships is a URL generator.

1. **Presigned PUT (`/api/uploads/presign`)**:
   - Available to authenticated sellers; client sends filename and MIME type.
   - Backend checks a strict whitelist: `image/jpeg`, `image/png`, `image/webp`, rejecting SVGs and executables. **This validation is real and is covered by a test.**
   - ⚠️ It then **fabricates** an S3 presigned URL (`uploads.py:61`). No bucket is contacted, no signature is computed against real credentials, and no bytes are ever stored. The response has the right shape, which is what makes it easy to mistake for working code.
   - `.env.example` contains no `AWS_*` variables, confirming no S3 integration exists.
2. **In-Memory Pillow Byte Sanitization** (in `service-seller-agent`):
   - Reads magic bytes to verify genuine JPEG/PNG/WebP data.
   - Rejects XML/SVG signatures, preventing SVG XSS.
   - Verifies dimensions ($\le 4096 \times 4096$) and aspect-ratio sanity.

**Agreed replacement: Appwrite Storage.** It provides CDN delivery, server-side WebP transforms, and video support — which unblocks both the hollow upload path and the video/highlights/reels tiers on premium seller pages. Migration is `scripts`-level work, not an architectural change: `seller_media.storage_provider` already defaults to `'appwrite'` and the schema carries `storage_id`, `url`, `thumbnail_url` and `poster_url` columns designed for exactly this.

**Ask for proof, not a demo.** The fastest way to test this claim: have someone upload a product photo through the seller console, then look for the file in the bucket. There is no file.

---

### Security Headers, CSP & Telemetry Ingestion

All HTTP responses pass through `security_and_correlation_headers` middleware:
- **`X-Request-ID`**: Propagates incoming UUIDv4 correlation ID or generates a new one for distributed tracing.
- **`X-Content-Type-Options`**: `nosniff`
- **`X-Frame-Options`**: `DENY` (clickjacking prevention)
- **`Referrer-Policy`**: `strict-origin-when-cross-origin`
- **`Permissions-Policy`**: `camera=(), microphone=(), geolocation=()`
- **`Content-Security-Policy`**:
  ```text
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; 
  img-src 'self' https: data: blob:; connect-src 'self' https://api.vyapari.com https://api.razorpay.com; 
  font-src 'self' https: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self';
  ```
- **Telemetry Ingestion (`POST /api/telemetry/errors`)**:
  - Catches unhandled frontend errors via React `GlobalErrorBoundary`.
  - ⚠️ A 10 KB payload limit is enforced. The documented 60 req/min per-IP rate limit is **not** — `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced anywhere. This endpoint is the **only** place in the platform with no authentication and no throttling.

> **`script-src 'self'` has a consequence.** Any third-party analytics script — GA4 included — is blocked by this policy today. Adding GA4 requires changing `script-src` and the `connect-src` allowlist in the same change. Doing the frontend half alone will produce a silently non-reporting tag, which is worse than no tag.

---

## 6. Storefront & Customer Journey

The Vyapari storefront provides a frictionless, premium consumer shopping experience.

> ⚠️ **Two parts of this section are degraded in production.** Semantic search falls back to `ILIKE` because `service-recommendation` is not deployed — the NLQ *filter parsing* still works, so queries return correct results, just without semantic ranking. Separately, `GET /api/products` returns HTTP 500 on some query combinations (`products.py:442`, an unvalidated value reaching a UUID comparison). A core public endpoint is intermittently broken. This is pre-existing, not introduced by the seller-page work.

### Natural Language Query (NLQ) Search Engine

Vyapari’s search bar is powered by an NLQ semantic parser in `backend-core-py/app/routers/products.py`:
- **Free-Form Parsing**:
  - Extracts price bounds (`"under 5000"`, `"below 10k"`, `"less than 2000"`) $\to$ `price <= X`. The column is `NUMERIC(10,2)` in INR — the parser's output is rupee-denominated, not paise.
  - Extracts quality intent (`"top rated"`, `"best"`, `"high rating"`) $\to$ `min_rating >= 4.0`.
  - Extracts delivery intent (`"fast delivery"`, `"next day"`, `"urgent"`) $\to$ `is_express = True`.
  - Extracts brand mentions matching database catalog brands.
- **Hybrid Search Execution**:
  Combines SQL relational filtering with pgvector cosine similarity. Returns matches along with an **AI Intelligence Banner** detailing extracted constraints to the user.

---

### Real-Time Autocomplete Popover

Located at `/api/products/suggest`:
- Debounced by **220ms** to prevent keystroke spam.
- Returns instant top 5 product matches with thumbnails, titles, INR prices, and star ratings.
- Surfaces matching brand pills (with live catalog count) and matching categories.
- Accessible via keyboard (Arrow navigation, Escape to dismiss, Click-outside handler).

---

### Faceted Catalog Discovery (`/explore`)

A multi-dimensional catalog browser:
- **Left Sticky Sidebar**: Brand selection checkboxes, category hierarchical trees, custom price sliders with Min/Max inputs, customer review rating filters (4★ & up), discount badges (30% off, 50% off), and Next-Day Delivery toggles.
- **Mobile Drawer**: Collapses into a sliding bottom drawer on viewports $< 768\text{px}$.
- **Sorting Options**: Featured, Price: Low to High, Price: High to Low, Highest Rated, Newest Arrivals.

---

### 3-Column Product Detail Page (PDP) & Buy Box

Benchmarked against Amazon and Flipkart desktop UX standards:
1. **Left Column (Gallery)**:
   - Vertical thumbnail carousel with active border indicator.
   - Large stage preview with smooth hover-to-zoom effect.
2. **Middle Column (Product Narrative)**:
   - Brand authorized verification badge.
   - Full title, customer rating stars, verified review count.
   - Pricing breakdown with MRP strikethrough and percentage discount tag.
   - Interactive Bank Offers & No-Cost EMI accordion.
   - Bulleted feature highlights and technical specifications table.
3. **Right Column (Sticky Buy Box)**:
   - Pinned on viewport scroll.
   - Real-time stock indicator ("In Stock", "Only 3 left", "Out of Stock").
   - 6-digit Pincode Delivery Estimator with delivery date calculation.
   - Quantity selector with stock ceiling limits.
   - Primary CTA "Add to Cart" and accent CTA "Buy Now".
   - 256-bit SSL trust assurance and 7-day replacement guarantee badge.
4. **Mobile Sticky Bottom Bar**:
   - On screens $< 768\text{px}$, a floating purchase bar anchors to the bottom of the viewport with price, "Add to Cart", and "Buy Now" buttons.

---

### Customer Reviews & Verified Purchase Gating

- **Verified Purchase Gate (Contract C7)**:
  Shoppers can only submit a review if they have purchased and received the product:
  ```sql
  SELECT 1 FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status = 'delivered'
  LIMIT 1;
  ```
- **Helpful Counter**: Logged-in users can upvote helpful reviews.
- **Official Seller Reply Threads**: Sellers can respond directly to customer reviews. Replies display a verified merchant badge, store name, and response timestamp.

---

### Cart, Checkout & Order Lifecycle

- **Cart Management (`/cart`)**: Optimistic quantity updates, item deletion, live subtotal computation, and coupon code entry.
- **Checkout Flow (`/checkout`)**: Multi-step single-page checkout:
  1. Shipping Address Selection (choose saved address or enter new).
  2. Order Summary Review.
  3. Payment Selection (Simulated Razorpay / UPI / Net Banking / COD).
  4. Idempotent order placement transaction.
- **Order Tracking & Timeline (`/orders/:id`)**:
  - Live progress stepper: `Placed` $\to$ `Confirmed` $\to$ `Shipped` $\to$ `Delivered`.
  - Courier logistics details: carrier name (Blue Dart, Delhivery) and AWB tracking number.
  - Downloadable invoice breakdown with tax and shipping lines.

---

### Customer Self-Service

- **Wishlist (`/wishlist`)**: One-click heart toggle on cards and PDP. Logged-out clicks open a sign-in modal and automatically retry upon authentication (Contract C8).
- **Address Book (`/account/addresses`)**: Add, edit, and set default shipping and billing addresses.
- **Notifications (`/account/notifications`)**: Real-time platform alerts, shipment updates, and promotional drops.

---

## 7. Seller Operations Console (`/seller/*`)

The Seller Console provides independent merchants with enterprise-level automation tools.

### 4-Step Regulatory KYC Onboarding

Sellers complete a regulatory onboarding flow compliant with Indian e-commerce norms:
- **Step 1: Business Profile**: Store name, registered company name, business type (Sole Proprietorship, Partnership, Private Limited).
- **Step 2: Regulatory Tax Information**: PAN card number (10 characters) and GSTIN (15 characters) format validation.
- **Step 3: Bank Settlement Coordinates**: Account number, IFSC code, and account holder name.
- **Step 4: Category & Regulatory Declaration**: Primary selling category, return policy acceptance, and electronic declaration.
- **Submission**: A `seller_profiles` row is created with `is_verified = false`; the account can draft but cannot publish or fulfill. Admin approval at `/admin/sellers` sets `is_verified = true` via `PUT /api/sellers/{seller_id}/verify`. Rejection is recorded via `/reject`. **There is no `kyc_status` column** — verification state is the `is_verified` boolean, and account suspension is `users.is_active`. PAN/GSTIN/bank details live inside the `business_info` JSONB, not in dedicated columns.

---

### Seller Dashboard & Executive Analytics

- **Metrics Cards**: 30-day Gross Merchandise Value (GMV), Total Orders, Units Sold, Low Stock Alert Count.
- **Sales Velocity Graph**: Daily order count and revenue trends.
- **Pending Actions**: Direct alert links to pending approvals, out-of-stock items, and unfulfilled orders.

---

### Product Catalog & Inventory Management

- Catalog CRUD over products at `/seller/products`, backed by `POST /api/seller/products` and `PUT /api/seller/products/{id}`.
- Real-time stock increment/decrement controls.
- Dynamic `attributes` builder (color, size, specs, material, brand) stored as JSONB.
- ⚠️ Image upload is non-functional: the presigned URL is fabricated and no bytes are stored. **No `DELETE /api/products/{id}` route exists**, so archived products are moved by status, not deleted.

---

### AI Listing Studio & Content Synthesis

> ⚠️ Proxies `service-seller-agent`, which is **not deployed**. The seller AI console is entirely non-functional in production.

Located at `/seller/ai/listing`:
- Seller enters raw bullet points or a brief product overview.
- Invokes `service-seller-agent` (Gemini 1.5 Flash).
- Generates:
  1. Catchy, SEO-optimized title adhering to marketplace standards.
  2. Professional HTML/Markdown product description.
  3. 5 structured bullet points highlighting key customer benefits.
  4. Recommended technical specifications.
- Directly invokes `service-recommendation` to compute 384-dim dense embeddings and index them into pgvector.

---

### Inventory Velocity Advisor

Located at `/seller/inventory`:
- Computes 30-day sales velocity:
  $$\text{Run-Rate} = \frac{\sum \text{units sold in last 30 days}}{30}$$
- Calculates Runway Days:
  $$\text{Runway} = \frac{\text{Current Stock Qty}}{\text{Run-Rate}}$$
- Visual Badging:
  - Critical ($\le 7$ days): Red alert pill. Suggests immediate restocking.
  - Warning ($8 - 14$ days): Amber alert pill.
  - Healthy ($> 14$ days): Green status badge.
- Reorder quantity recommendations calculated using economic order quantity formulas.

---

### Order Fulfillment Desk & Logistics Tracking

Located at `/seller/orders`:
- Filter orders by status (`confirmed`, `shipped`, `delivered`).
- Customer shipping address snapshot view.
- Fulfillment modal: Transition status to `shipped`, select courier (Blue Dart, Delhivery, DTDC, India Post), and input AWB tracking number. Emits customer notification automatically.

---

### Reviews Desk & Official Merchant Replies

Located at `/seller/reviews`:
- Aggregates all buyer reviews across the seller's catalog.
- Filter by unanswered reviews or star rating.
- Inline reply form allowing verified merchant responses to be published directly beneath customer reviews.

---

### Human-in-the-Loop Approvals Queue

Located at `/seller/approvals`:
- When AI agents identify opportunities (e.g., price reduction for slow-moving stock, automated listing enrichment), they generate proposals in the `approvals` table.
- Each approval item displays:
  - Proposed action type (`PRICE_UPDATE`, `STOCK_REORDER`, `DESCRIPTION_REWRITE`).
  - Target product details.
  - Current value vs. Proposed value diff.
  - AI confidence score and reasoning narrative.
- The seller can **Approve** or **Reject** with one click (`POST /api/approvals/{item_id}/approve` | `/reject`).
- Upon approval, `backend-core` applies the mutation safely.

> ⚠️ `seller.py:483` contains a **broken INSERT into `agent_approval_queue`** referencing columns that do not exist. This is pre-existing and unrelated to the seller-page work.

---

### Seller AI Copilot Chat & Support RAG

- **AI Copilot Chat (`/seller/ai`)**:
  Conversational merchant assistant capable of analyzing sales performance, explaining return policies, and providing inventory recommendations. *(`/seller/ai/chat` redirects to `/seller/ai`.)*
- **Support RAG Desk (`/seller/settings`)**:
  Merchants author custom Shipping and Return policies in Markdown. The policies are embedded into vectors; when customers or copilot chat query store rules, relevant sections are retrieved via cosine similarity and synthesized into accurate policy answers.

> ⚠️ Both of the above proxy `service-seller-agent`, which is **not deployed**. They return errors in production.

---

### Premium Seller Showcase Pages (`/store/:handle`)

An Instagram-style public landing page per seller, gated behind a paid plan. This is the platform's monetization surface and the reason a seller would pay.

**Routing decision.** The public page lives at `/store/:handle` (singular) and **coexists** with the pre-existing `/stores/:sellerId` (plural, UUID-keyed) storefront. Both are live. The public API base is `/api/public/stores` — deliberately not `/api/stores`, which would have collided with the existing UUID storefront router.

**What a page contains**
- Announcement strip (pro+) and an owner-only draft banner for unpublished pages.
- Profile header: avatar, handle, tagline, bio, follower count, and a follow button with optimistic update and rollback on failure.
- Hero banner, story highlights, then tabbed gallery / listings.
- Composable content blocks, all six of which render: `announcement`, `hero_banner`, `media_grid`, `featured_collection`, `reels`, `testimonials`. Blocks are time-windowed for scheduled promos.
- Shoppable media: a media post can reference a `product_id`, making the grid a storefront rather than a brochure.

**Plan gating** (see [§4](#seller-showcase-page-schema-v7) for the schema and `seller_page_service.TIERS` for the code):

| | free | pro | elite |
|---|---|---|---|
| Media items | 12 | 120 | 600 |
| Highlights | 0 | 8 | 20 |
| Blocks | 2 | 8 | 20 |
| Video, reels, custom theme, announcements, analytics | ❌ | ✅ | ✅ |

Every seller gets a page on the free tier. Premium is the upsell, and the pages are public and indexable so the upsell is discoverable.

**Publish gate.** A page is invisible to the public API until `is_published = true`, which requires a valid handle, a tagline, and at least one media item. Unpublished pages return `404` from the public API — deliberately indistinguishable from a nonexistent handle, so drafts cannot be enumerated.

**Security posture.** Seller-authored content is untrusted input and is defended twice:
- `cta_href` is constrained in SQL (`^/` or `^https://` only) **and** re-validated client-side by `safeHref`, which neutralizes `javascript:` and `data:` URLs.
- `theme_accent` is constrained to a 6-digit hex triplet in SQL **and** re-validated by `safeAccent`.
- Media URLs pass a host allowlist (`validate_media_url`) before persistence, so a seller cannot point the grid at an internal address.

**Verification status.** The page is verified by **server-rendered markup assertions** (`npm run smoke`, 33 assertions across a populated pro page and an empty free draft) plus 37 real-database integration tests. **It has never been viewed in a browser.** Layout, image loading, lightbox interaction and scroll behaviour are unverified and need a human pass before shipping.

> ⚠️ **The editor does not exist.** `/seller/page` is not a route. Three links in `SellerShowcasePage` point at it and currently 404. The 19 owner endpoints under `/api/seller-pages` are implemented and tested, but nothing in the UI calls them yet.

---

## 8. Admin Governance Desk (`/admin/*`)

The administrative portal empowers platform operators to oversee transactions, enforce compliance, and maintain catalog integrity across 6 dedicated portals.

### Platform Executive Overview (`/admin`)

- **Top-Line Metrics**: Global Gross Merchandise Value (GMV), Total Active Users, Registered Sellers, Lifetime Orders.
- **Platform Health Status**: Redis cache connectivity, PostgreSQL connection pool latency, vector search indexing health.

---

### User Governance & Role Elevation (`/admin/users`)

- Searchable directory of all registered accounts.
- Filter by role (`customer`, `seller`, `admin`).
- Instant suspension and reactivation toggles via `PUT /api/admin/users/{user_id}/status`, writing `users.is_active`.
- **There is no `pending_kyc` account status.** The previous revision of this section documented one; the `users` table has no `status` column at all. KYC state lives on `seller_profiles.is_verified`.

---

### Merchant KYC Verification Workflow (`/admin/sellers`)

- Auditing queue for sellers who have completed the 4-step onboarding.
- Inspects `business_info` (business name, PAN, GSTIN, business type).
- Actions: **Approve KYC** (`PUT /api/admin/sellers/{seller_id}/verify` → `is_verified = true`) or **Reject KYC** (`PUT /api/admin/sellers/{seller_id}/reject`).

---

### Global Catalog Moderation & Takedowns (`/admin/products`)

- Global view across all merchant product listings.
- **Server-side pagination** (`page`, `limit` 25/50/100 with `OFFSET` and total page counts) — this was the fix for a hardcoded `LIMIT 150` that left 98.5% of a 10,000-product catalog invisible, with the React console filtering client-side over those 150 rows.
- **Cross-field server search**: SQL `ILIKE` across title, slug, store name, and category, with 350 ms debounce.
- **Faceted filters**: `status`, `seller` (brand), `category`, plus live status-count badges.
- **Bulk moderation**: `POST /api/admin/products/bulk-moderate` for batch status changes; per-item status via `PUT /api/admin/products/{product_id}/status` and a reasoned moderation path via `/moderate`.

---

### Category Taxonomy Management (`/admin/categories`)

- Hierarchical tree manager for product categories (`POST /api/admin/categories`).
- `categories.name` is UNIQUE; `products.category_id` is `ON DELETE RESTRICT`, so a category with products cannot be deleted out from under them.

---

### System Diagnostics & Container Observability (`/admin/system`)

- PostgreSQL connection latency, pgvector extension verification, Redis cache health, and vector embedding coverage with a resync trigger (`POST /api/admin/system/sync-embeddings`).
- ⚠️ Diagnostics cover `backend-core`, PostgreSQL, and Redis. The two AI services are not deployed, so they are not monitored and the "all 6 services healthy" claim in earlier revisions of this section is not achievable.

---

## 9. AI Microservices Deep Dive

> ⚠️ **Neither service in this section is deployed.** Both are compute-heavy and were held back from the production deployment. The architecture below is real and unit-tested, but in production:
> - Search degrades from pgvector cosine similarity to `ILIKE` filtering.
> - `GET /api/ai/similar/{product_id}` returns empty, so the "You may also like" rail **silently disappears** rather than erroring.
> - `/seller/ai`, `/seller/ai/listing`, `/seller/ai-approvals` and the Support RAG desk are non-functional.
> - `/admin/system` cannot report on them.
>
> The correct reading of §9 is "what is specified and tested", not "what a customer sees today".

### Recommendation Microservice (`service-recommendation`)

- **Runtime**: Python 3.11, FastAPI, SentenceTransformers, asyncpg.
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` producing 384-dimensional L2-normalized embeddings. Includes a deterministic fallback generator for environments without PyTorch weights.
- **Percentile Rank Normalization**:
  Prevents extreme raw distance scores from distorting feeds by scaling scores from 1.0 (highest) to 0.0 (lowest) within candidate sets.
- **Time-Decayed Popularity Scoring**:
  Calculates item recency-adjusted popularity using an exponential decay function ($\lambda = 0.05$, ~14-day half-life):
  $$\text{Decayed Score} = \text{Base Popularity} \times e^{-\lambda \times \Delta t_{\text{days}}}$$
- **Stock-Aware Filtering**:
  All SQL vector lookups enforce `WHERE p.status = 'active' AND p.stock_qty > 0`.
- **Cold-Start Fallback**:
  Logged-out users or new profiles receive a trending/popular feed without requiring tracking cookies or device fingerprinting. The real route is `GET /api/ai/popular` — there is no `/api/recommendations/*` router mounted.

> ⚠️ **The seeded embeddings are fake.** `scraper_bot.py:416` generates deterministic **hash vectors** rather than `all-MiniLM-L6-v2` output. They satisfy the `vector(384)` column type and will cosine-compute without error, but they encode no semantics whatsoever — every pairwise similarity is effectively arbitrary. A real re-embed of the ~10k catalog is mandatory before any semantic claim about this catalog is true. The plan is a one-time re-embed through a hosted embedding API (cheap, no in-process model), then pgvector in-process for serving.
>
> Related: **`product_stats_daily` has no application writer**, so the `product_stats_daily` view above has no data source. `user_interactions` *is* written — four routes insert into it (`products.py` on view, `cart.py` on add-to-cart, `orders.py` on purchase, `wishlist.py` on wishlist add), so time-decayed popularity and collaborative filtering do have a real feed. What has no frontend call site is `POST /api/ai/interactions`, the proxy that forwards events to the recommendation service.

---

### Seller Agent Microservice (`service-seller-agent`)

- **Runtime**: Python 3.11, FastAPI, Google Gemini 1.5 Flash, Celery, Redis.
- **Prompt Versioning**:
  All prompts maintain immutable version tags (`listing_v1.2`, `inventory_v1.1`, `support_v1.1`) logged into `agent_audit_log` for compliance tracing.
- **Tenacity Exponential Backoff with Jitter**:
  Decorates LLM provider calls with:
  ```python
  @retry(
      retry=retry_if_exception(should_retry_gemini),
      stop=stop_after_attempt(3),
      wait=wait_random_exponential(min=1, max=10),
      reraise=False
  )
  ```
  - **Retryable Errors**: HTTP 429 (Rate Limit), 500, 502, 503, 504, connection timeouts.
  - **Non-Retryable Errors**: HTTP 400 (Bad Request), authentication failures, schema invalidation.

---

### Asynchronous Celery Architecture & Deduplication

- **Broker**: Redis (`redis://redis:6379/1`).
- **Worker Configuration**: Configured with `task_acks_late=True` to guarantee task preservation across container restarts.
- **Task Deduplication**:
  Celery tasks check `agent_tasks.status == 'done'` before invoking the LLM. If a network blip causes a task redelivery, the worker skips re-execution, preventing redundant inference costs.

---

### Redis Quota Management & Rate Limiting

- **Seller Daily Quota** (agent service only, so moot while undeployed):
  - Max 500 requests per day per merchant.
  - Max 500,000 LLM tokens per day per merchant.
- Tracked in Redis using daily expiring keys (`quota:seller:{id}:{YYYY-MM-DD}`).
- Graceful Fail-Open: if Redis is unreachable, the quota check logs a warning and permits the request.

> ⚠️ **There is no rate limiting anywhere in `backend-core-py`.** The mechanism is half-present and unused: `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced. There is no throttling on login, signup, password reset, order placement, search, or uploads. The only unauthenticated write endpoint in the platform, `POST /api/telemetry/errors`, is also unthrottled. This is a straightforward gap to close and should not be described as implemented.

---

## 10. Frontend Architecture & Global Design System

The frontend is a lightweight, responsive React 18 Single-Page Application (SPA) built using Vite and Vanilla CSS.

### Design Tokens, Typography & Color Palette

All styling adheres to `DESIGN.md` and `product_bible.md`. The theme is **Metallic Dark** — obsidian graphite canvas, layered gunmetal and titanium surfaces, Liquid Platinum pill CTAs, hairline bevels instead of heavy shadows. See `DESIGN.md` for the full token table.

> ⚠️ This section previously described a **light theme** (white canvas, Vyapari Red `#ff385c` accent, 8px/14px radii). That is not what is implemented. `frontend/src/index.css` defines the Metallic Dark palette, and the radii are 12px for cards with 9999px for pills. The code is correct and this description was stale.

**Implementation constraints worth knowing before editing components:**

- **No Tailwind, no CSS framework.** `index.css` is hand-written plain CSS. Any `animate-*` or utility class referenced in JSX is dead unless it is defined in that file. This is an easy way to ship a silently broken animation — a live example was `.animate-spin` in `AdminProductsPage.jsx`, which did nothing until the `.spin` keyframes were added.
- **`.spin` and `.animate-spin`** keyframes are defined in `index.css` alongside a `prefers-reduced-motion` guard.
- **Seller-controlled values are re-validated at render.** `theme_accent` goes through `safeAccent` (hex triplet) and `cta_href` through `safeHref` (same-origin or `https://` only, neutralizing `javascript:` and `data:`). This is deliberate: the database constrains both, and the client re-checks because a UI that trusts stored seller input is one XSS away from a bad day.

---

### Application State Management & Contexts

State is managed via modular React Contexts without external heavyweight state libraries:
- **`AuthContext`**: Manages user identity, role, login, registration, logout, and automatic in-memory token refreshes.
- **`CartContext`**: Manages shopping cart items, optimistic quantity adjustments, and subtotal computations.
- **`WishlistContext`**: Handles optimistic heart toggling and auto-retry upon authentication.
- **`NotificationContext`**: Dispatches toast notifications and milestone alerts.

---

### Global Error Boundary & Telemetry Reporting

Mounted at the root of `frontend/src/App.jsx`:
- Traps unhandled React component tree exceptions.
- Renders an elegant fallback UI ("Something went wrong") with a reload button.
- Submits error payloads (`message`, `stack`, `componentStack`, `url`) to `POST /api/telemetry/errors`.

---

## 11. Complete API Reference & Router Matrix

All endpoints are mounted under `backend-core-py` (19 routers) and documented via OpenAPI at `/docs`. Every JSON response uses one envelope: success is `{"success": true, "data": {...}}`, error is `{"success": false, "error": {"code", "message", "details"}}`. **Error codes live at `error.code`.** Request-shape validation maps to `400 VALIDATION_ERROR` (not 422); plan-gated features return `402`. See [docs/contracts.md](./docs/contracts.md) §1.

| Path Prefix | Router File | Key Endpoints & Methods | Auth Level | Purpose |
|---|---|---|---|---|
| `/health` | `health.py` | `GET /health` | Public | Container liveness and DB/Redis health probes. |
| `/api/auth` | `auth/router.py` | `POST /register`<br>`POST /login`<br>`POST /refresh`<br>`POST /logout`<br>`GET /me` | Mixed | Registration, login, opaque cookie refresh, session clearance, identity check. |
| `/api/products` | `products.py` | `GET /`<br>`GET /{id}`<br>`GET /facets`<br>`GET /suggest`<br>`POST /`<br>`POST /reviews`<br>`PUT /{id}` | Mixed | NLQ search, autocomplete, facets, seller catalog write. **⚠️ No `DELETE /{id}` route exists.** `GET /` has a known 500 on some UUID-string query combinations. |
| `/api/categories`| `categories.py` | `GET /`<br>`GET /{slug}` | Public | Category taxonomy tree. Admin writes go through `/api/admin/categories`. |
| `/api/cart` | `cart.py` | `GET /`<br>`POST /items`<br>`PUT /items/{id}`<br>`DELETE /items/{id}`<br>`DELETE /` | Customer | User-scoped shopping cart operations. |
| `/api/orders` | `orders.py` | `GET /`<br>`GET /:id`<br>`POST /` (Idempotent)<br>`POST /{id}/confirm-payment` | Customer / Seller | Order placement with `SELECT FOR UPDATE` and idempotency, plus payment confirmation. **⚠️ No cancel endpoint exists.** |
| `/api/payments` | `payments.py` | `POST /webhook` | Mixed | **Webhook-only.** HMAC-SHA256 verification + event dedup. `POST /create` and `GET /status/:orderId` are **not implemented**. Payments are simulated end-to-end. |
| `/api/seller` | `seller.py` | `GET /dashboard`<br>`GET /onboarding/status`<br>`POST /onboarding`<br>`POST /onboarding/submit`<br>`GET /inventory/velocity`<br>`POST /inventory/advisory`<br>`GET /orders`<br>`PUT /orders/{id}/status`<br>`PUT /orders/{id}/fulfill`<br>`GET /products`<br>`POST /products`<br>`GET /products/{id}`<br>`PUT /products/{id}`<br>`GET /settings`<br>`PUT /settings`<br>`POST /ai/chat` | Seller | Merchant KYC, dashboard metrics, inventory velocity, catalog CRUD, courier fulfillment, store settings. |
| `/api/approvals` | `approvals.py` | `GET /`<br>`POST /{item_id}/approve`<br>`POST /{item_id}/reject` | Seller | Human-in-the-loop agent proposal approval queue. |
| `/api/ai` | `ai.py` | `GET /popular`<br>`GET /search`<br>`GET /recommendations/home/{user_id}`<br>`GET /similar/{product_id}`<br>`POST /generate-listing`<br>`POST /inventory-advisory`<br>`POST /support-reply`<br>`POST /interactions` | Mixed | Gateway proxy to AI services. ⚠️ Depends on undeployed `service-recommendation` and `service-seller-agent` — endpoints return empty data or 503 in production. |
| `/api/reviews` | `reviews.py` | `GET /product/{product_id}`<br>`GET /seller`<br>`POST /`<br>`POST /{review_id}/reply`<br>`POST /{review_id}/helpful` | Mixed | Verified purchase reviews, seller reply threads, helpful votes. |
| `/api/wishlist` | `wishlist.py` | `GET /`<br>`POST /{product_id}`<br>`DELETE /{product_id}` | Customer | Wishlist management with optimistic toggling. |
| `/api/users` | `users.py` | `GET /profile`<br>`PUT /profile`<br>`GET /addresses`<br>`POST /addresses`<br>`PUT /addresses/{addr_id}`<br>`PUT /addresses/{addr_id}/default`<br>`DELETE /addresses/{addr_id}` | Customer | Profile editing, multi-address book management. |
| `/api/uploads` | `uploads.py` | `POST /presign` | Seller | **⚠️ Fabricated S3 presigned URL.** No bucket is contacted and no bytes are stored. Appwrite Storage is the agreed replacement. |
| `/api/telemetry`| `telemetry.py`| `POST /errors` | Public | Client crash telemetry ingestion. |
| `/api/admin` | `admin.py` | `GET /metrics`<br>`GET /dashboard`<br>`GET /users`<br>`PUT /users/{user_id}/status`<br>`GET /sellers`<br>`PUT /sellers/{seller_id}/verify`<br>`PUT /sellers/{seller_id}/reject`<br>`GET /products`<br>`PUT /products/{product_id}/status`<br>`PUT /products/{product_id}/moderate`<br>`POST /products/bulk-moderate`<br>`GET /system`<br>`GET /system/health`<br>`POST /system/sync-embeddings`<br>`POST /categories` | Admin | Executive metrics, user governance, KYC workflow, catalog moderation (server-side pagination + search + bulk), system diagnostics, embedding resync. |
| `/api/notifications`| `notifications.py`| `GET /`<br>`PUT /{notif_id}/read`<br>`PUT /read-all` | Customer / Seller | User notification center. |
| `/api/stores` | `stores.py` | `GET /{seller_id}` | Public | Legacy UUID-keyed storefront. |
| `/api/seller-pages` | `seller_pages.py` | `GET /mine`<br>`PUT /mine`<br>`POST /mine/publish`<br>`POST /mine/media`<br>`PATCH /mine/media/{media_id}`<br>`DELETE /mine/media/{media_id}`<br>`POST /mine/highlights`<br>`PUT /mine/media/order`<br>`PUT /mine/highlights/order`<br>`PUT /mine/blocks/order`<br>`DELETE /mine/highlights/{highlight_id}`<br>`POST /mine/blocks`<br>`DELETE /mine/blocks/{block_id}`<br>`GET /mine/analytics`<br>`POST /mine/plan`<br>`GET /plans` | Seller | Owner/editor endpoints for premium showcase pages. `POST /mine/plan` is **admin-only** — a seller must not be able to grant themselves a plan. |
| `/api/public/stores` | `public_pages.py` | `GET /{handle}`<br>`GET /{handle}/media`<br>`GET /{handle}/products`<br>`POST /{handle}/view`<br>`POST /{handle}/follow`<br>`DELETE /{handle}/follow`<br>`GET /{handle}/highlights/{highlight_id}` | Public | Unauthenticated showcase pages backing `/store/:handle`. Unpublished pages 404. |
| `/api/stores` | `stores.py` | `GET /:slug` | Public | Public storefront page for individual sellers. |

---

## 12. Verification, Testing, & Quality Assurance

The Vyapari platform is verified with automated test suites covering all critical correctness and reliability guarantees.

> ⚠️ These counts were previously reported as 36 tests. The real figure is **83**, and the earlier total omitted the entire seller-page suite. Counts below are transcribed from the test files, not from a CI transcript.

### Automated Test Results

#### 1. Backend Core Suite (`backend-core-py/tests`) — 83 tests

| File | Tests | Covers |
|---|---|---|
| `test_all_endpoints.py` | 26 | Category trees, NLQ parser, cart items, order transactions, seller dashboards, approvals queue, administrative endpoints |
| `test_seller_pages.py` | **37** | Real-database integration for premium seller pages |
| `test_redis_cache.py` | 9 | Cache behaviour and in-memory fallback |
| `test_p0_correctness.py` | 7 | Idempotency, webhook HMAC + replay, MIME whitelist, security headers |
| `test_routes.py` | 4 | Auth and role guards |
| `mock_db.py` | — | Shared fixture helper, no tests |

Run with:
```bash
cd backend-core-py
python -m unittest discover -s tests -p "test_*.py"
```

**The seller-page tests run against a real PostgreSQL instance**, not mocks. They set up in per-test `asyncSetUp` — Python 3.10's `IsolatedAsyncioTestCase` has no class-level async setup, so `asyncSetUpClass` is not an option — and reset with `TRUNCATE users, categories` (both must be listed explicitly). `TEST_DATABASE_URL` must be set and the schema provisioned via `scripts/migrate.py apply`. Running the suite truncates the fixture, so re-seed before any visual check.

Real-database testing earned its keep. It caught defects that mocked tests passed straight through:
- Avatar and cover URLs never resolving, because the `seller_media` join was missing from the select.
- A hand-rolled `get_my_page` response that had drifted away from the shared select fragment.
- Python `str` values reaching asyncpg columns typed as something else.
- `fetchval` on `UPDATE … RETURNING 1` returning the integer `1` instead of a count.
- Duplicate `sort_order` values from partial reorders, silently breaking keyset pagination for infinite scroll.
- A `jsonb` column returned as raw text.

##### P0 Correctness Suite (`test_p0_correctness.py`)
- `test_order_idempotency_same_key`: Confirms duplicate `Idempotency-Key` returns the original cached response.
- `test_order_idempotency_payload_mismatch`: Confirms modified payloads with the same key are rejected.
- `test_payment_webhook_hmac_valid`: Confirms legitimate HMAC-SHA256 signatures are accepted and update order status.
- `test_payment_webhook_hmac_invalid`: Confirms forged signatures are rejected with HTTP 400.
- `test_payment_webhook_replay_deduplication`: Confirms duplicate event IDs are acknowledged without re-processing.
- `test_s3_presign_mime_whitelist`: Confirms non-whitelisted upload types (e.g. SVG, PDF) are rejected with HTTP 400. *Note: the endpoint's URL is fabricated, so this validates request validation only — not actual storage.*
- `test_security_headers_present`: Confirms CSP, nosniff, DENY, and correlation IDs are attached to responses.

#### 2. Seller Agent Service Suite (`service-seller-agent/tests`)
- **Image Validation (`test_image_validation.py`)**:
  - Confirms SVGs, HTML, and binary shells disguised as images are rejected.
  - Confirms JPEG, PNG, and WebP images within 5 MB pass inspection.
- **Resilience & Quota (`test_agent_resilience.py`)**:
  - Confirms Tenacity retry logic triggers on 429/5xx and fails immediately on 400.
  - Confirms Redis quota checks fail open gracefully if Redis is offline.

#### 3. Recommendation Service Suite (`service-recommendation/tests`)
- **Vector & Ranking (`test_recommendations.py`)**:
  - Validates 384-dimensional normalized vector generation.
  - Validates percentile rank normalization from 1.0 to 0.0.
  - Confirms single-item and empty result edge cases are handled safely.

#### 4. Frontend Verification
```bash
cd frontend
npm run build   # production bundle compile
npm run smoke   # hermetic server-render assertions
```

- **`npm run build`** produces a gzipped production SPA bundle with zero syntax or import errors. It does **not** warn about bundle size, because there is no code splitting — the single chunk is roughly 657 kB and every visitor downloads all of it.
- **`npm run smoke`** (`frontend/.smoke/`) bundles and server-renders `StoreView`, the pure presentational component, with `react-dom/server` and asserts the markup across two scenarios: a populated pro-tier page and an empty free-tier draft. 33 assertions. Artifacts are gitignored. Wired into the `build-frontend` CI job.

Two constraints shape this suite. `renderToString` inserts `<!-- -->` between adjacent text and expression children, so assertions strip those markers before matching. And `useEffect` never runs during SSR, so the test renders `StoreView` directly rather than the `SellerShowcasePage` shell — the shell is where the data fetching lives.

> ⚠️ **No browser test exists.** These checks prove the component renders correct markup given correct data. They prove nothing about layout, image loading, lightbox interaction, or scroll behaviour. `/store/:handle` has never been viewed in a browser and needs a human pass before shipping.

---

## 13. DevOps, Deployment, & Disaster Recovery

### Docker Compose Orchestration

The entire environment starts with a single command:
```bash
docker compose up -d --build
```
- Includes healthchecks for PostgreSQL (`pg_isready`) and Redis (`redis-cli ping`).
- Services declare startup dependencies (`condition: service_healthy`) to ensure database schemas are fully initialized before applications boot.

---

### Automated Backup & Restore Verification Drill

Located in `scripts/`:
- **`backup.sh`**:
  - Executes compressed PostgreSQL dumps:
    ```bash
    pg_dump -Fc -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
    ```
  - Computes SHA-256 checksums and automatically prunes local backups older than 7 days.
  - Supports optional encrypted synchronization to AWS S3 using AWS KMS (`aws s3 cp`).
- **`verify_backup.sh`**:
  - Automated disaster recovery drill.
  - Creates a temporary scratch database (`vyapari_dr_test`).
  - Restores the latest compressed dump and verifies row counts across `users`, `products`, and `orders`.
  - Drops the scratch database and outputs an audit result (`[OK] Disaster recovery drill PASSED`).

---

### CI/CD Pipeline (`.github/workflows/ci.yml`)

The repository includes a GitHub Actions continuous integration workflow that triggers on all pushes to `main` and pull requests:

| Job | What it does |
|---|---|
| `test-migrations` | Boots PostgreSQL with pgvector, validates migrations apply in order on an empty database, checks for duplicate/ill-named migration files, verifies legacy `init.sql` upgrades cleanly, and asserts V7 seller-page objects and constraints hold. |
| `test-backend-core` | Provisions the full schema from `db/migrations`, starts Redis, runs the complete Python backend test suite (including real-DB seller-page integration tests) against the provisioned database. |
| `test-ai-services` | Runs unit/integration suites for `service-seller-agent` and `service-recommendation`. |
| `build-frontend` | Installs Node 20 dependencies, runs `npm run build`, and executes `npm run smoke` (hermetic server-render assertions). |

---

## 14. Environment Configuration Reference

All configurable environment variables are documented in `.env.example`:

```dotenv
# General Environment
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:3000

# PostgreSQL Configuration
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=vyapari
POSTGRES_USER=vyapari_admin
POSTGRES_PASSWORD=vyapari_secure_password
DATABASE_URL=postgresql://vyapari_admin:vyapari_secure_password@db:5432/vyapari

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/0

# JWT Security Secrets (Use minimum 256-bit random keys in production)
JWT_ACCESS_SECRET=vyapari_jwt_access_secret_sample_key_change_in_production_384b
JWT_REFRESH_SECRET=vyapari_jwt_refresh_secret_sample_key_change_in_production_384b
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Payment Gateway (Razorpay Simulated / Live)
RAZORPAY_KEY_ID=rzp_test_placeholder_key_id
RAZORPAY_KEY_SECRET=rzp_test_placeholder_key_secret
RAZORPAY_WEBHOOK_SECRET=rzp_webhook_placeholder_secret

# AI Microservices Internal URLs
RECOMMENDATION_SERVICE_URL=http://service-recommendation:8001
SELLER_AGENT_SERVICE_URL=http://service-seller-agent:8002

# Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Frontend (Vite) — exposed to the browser, must be prefixed VITE_
VITE_API_BASE_URL=http://localhost:8000/api
```

> ⚠️ **The AWS S3 block in earlier revisions of this document was fictional.** `.env.example` contains no `AWS_*` variables, and `uploads.py` fabricates a presigned URL without contacting S3. Appwrite Storage is the agreed replacement (CDN + WebP transforms + video). See [§15](#15-known-gaps--hollow-features-register).
>
> `REDIS_URL` is intentionally commented out in `.env.example` alongside the `REDIS_HOST`/`REDIS_PORT` fallback. The cache layer degrades to an in-memory store rather than failing startup, so a missing Redis is safe — but it also means the seller-page entitlement cache and all query caching are per-process and lost on restart.

---

## 15. Known Gaps & Hollow Features Register

This is the authoritative statement of what this platform does **not** do. It exists because the surface area of the codebase overstates its maturity: several features render a complete UI and a plausible API response while doing nothing.

### Missing Entirely

| Gap | Evidence |
|---|---|
| **Order cancellation** | No `PUT /api/orders/{id}/cancel` route exists. `docs/contracts.md` previously documented one. |
| **Refunds** | `payments.status` has no `refunded` value. No refund endpoint, no refund state, no reconciliation. |
| **Stock restoration** | `POST /api/orders` decrements stock under `SELECT … FOR UPDATE`, and **no code path ever increments it back**. An abandoned `pending` order permanently burns that inventory. |
| **Abandoned-order sweep** | Nothing transitions stale `pending` orders. The 15-minute timeout in the contracts document was never implemented. |
| **Forgot / reset password** | Zero routes, zero token tables. A user who forgets their password has no recovery path. **This also blocks the planned mobile app.** |
| **Product variants** | No `product_variants` table, no variant endpoint, no variant selector on the PDP. All stock is product-level. |
| **Rate limiting** | `TTL_RATE_LIMIT` is defined at `redis_client.py:34` and never referenced. Only the telemetry endpoint is documented as rate-limited. No login, signup, order or search throttling. |
| **Code splitting** | Zero `React.lazy` / `Suspense` in the codebase. A single ~657 kB chunk is shipped to every visitor, including those who only open a product page. |
| **Best-sellers ranking** | `product_stats_daily` exists and is read, but **nothing writes to it**. Any "popular" figure is a fallback heuristic. |
| **Leads / enquiries** | No table, no route. |
| **Ad banners / promotions** | Homepage promotional content is hardcoded JSX in `HomePage.jsx`. No CMS, no scheduling. |
| **GA4 / analytics** | No `gtag` anywhere. The CSP `script-src 'self'` would block an injected GA script even if one were added — both must change together. |
| **`/seller/page` editor** | The showcase page renders but there is no editor. `SellerShowcasePage` links to `/seller/page` from three places and those links 404. **This is the single highest-priority gap.** |

### Hollow — Present but Misleading

| Feature | Reality |
|---|---|
| **Image upload** | `uploads.py:61` returns a fabricated S3 presigned URL. No bytes are ever stored, no bucket is contacted. The API shape is right; the storage is fictional. |
| **Payments** | Simulated end to end. `create_order` never writes `razorpay_order_id`, so the webhook's `WHERE razorpay_order_id = $2` branch can never match. `CheckoutPage.jsx:96` sends a literal `pay_rzp_mock_${Date.now()}`. |
| **Admin analytics** | `admin.py:22` computes six integers inline. No time series, no cohort, no real aggregation. |
| **Popular products / "You may also like"** | Depend on `service-recommendation`, which is not deployed. `/api/ai/similar/{id}` returns empty and the recommendation rail silently disappears. |
| **Semantic search** | Degrades to `ILIKE` in production because the embedding service is down. The NLQ filter parsing still works. |
| **Seller AI console** | Listing studio, inventory advisor and copilot chat all proxy a service that is not deployed. |
| **Catalog embeddings** | `scraper_bot.py:416` generates deterministic **hash vectors**, not `all-MiniLM-L6-v2` output. They are 384-dimensional and satisfy the `vector(384)` type, but carry no semantic meaning. A real re-embed is required. |
| **Homepage promotions** | Hardcoded JSX, not CMS-driven content. |

### Deployed-State Gaps

- `service-recommendation` and `service-seller-agent` are **not deployed** (compute-heavy).
- `product_stats_daily` has no application writer, so the recommendation cache and that table are permanently empty. `user_interactions` is written by four routes, so it is not.
- The production database's migration state is **unverified**. It is unknown whether `refresh_token_sessions`, `idempotency_records`, `payment_events`, `agent_audit_log` or the `vyapari_agent` role exist there. The proven remediation is:
  ```bash
  python scripts/migrate.py baseline --upto V1 && python scripts/migrate.py apply
  ```
- `service-seller-agent:483` contains a **broken INSERT into `agent_approval_queue`** referencing columns that do not exist.

### Data Integrity Defects

- **`GET /api/products` returns 500** on some query combinations: `invalid input for query argument $1: '1' (invalid UUID '1')` at `products.py:442`. An unvalidated value reaches a UUID comparison. This is a pre-existing defect on a core public endpoint, not introduced by the seller-page work.
- **Duplicate `sort_order` on partial reorder** can break keyset pagination on the media grid. Fixed for seller pages; the pattern is worth checking anywhere else ordering is user-controlled.
- **`jsonb` columns arrive as raw text** from asyncpg because no codec is registered on the pool. Parsed per-endpoint where the contract requires an object; frontend code is tolerant of both shapes.

### How to Verify These Claims

Each item above is falsifiable. The cheapest checks:

- *"Show me a real image in S3"* — upload via the seller console, then `ls` the bucket.
- *"Show me a real Razorpay payment in the Razorpay dashboard"* — complete checkout and look for a real `payment.captured` event.
- *"Show me product #3 after I upload a photo"* — the uploaded image will not appear in the bucket or on the CDN.
- *"Show me the analytics page after a week of orders"* — `admin.py:22` computes six integers inline; there is no time series and `product_stats_daily` is never written.

---

## 16. Corrected Documentation Log

This revision reconciled the documentation against `db/migrations/V1`–`V7` and the running code. Substantive corrections, for anyone who read an earlier version:

| Was | Now |
|---|---|
| 36 backend tests | **83** across 5 files |
| 15 routers, "15 dedicated routes" | **19 routers**, 38 frontend pages |
| 3 CI jobs | **4** jobs, with correct names |
| `products.price_cents`, `orders.*_cents` | `NUMERIC(10,2)` **INR** throughout |
| `users.full_name`, `users.status` | `users.name`, `users.is_active` |
| `seller_profiles.store_slug`, `pan`, `gstin`, bank columns, `kyc_status` | `seller_profiles.business_info` JSONB, `is_verified` boolean |
| `products.sku`, `specifications`, `features`, `rating`, `review_count` | none exist; `attributes` JSONB only |
| `orders.order_number`, `orders.payment_status` | do not exist; single `total_amount` |
| `orders.status = 'confirmed'` | `'pending' \| 'paid' \| 'processing' \| 'shipped' \| 'out_for_delivery' \| 'delivered' \| 'cancelled'` |
| `payments.status = 'captured' \| 'refunded'` | `'created' \| 'success' \| 'failed' \| 'cancelled' \| 'pending_verification'` |
| `product_stats_daily.date`, `impressions`, `cart_adds` | `stat_date`, `views`, `clicks`, `purchases` |
| `idempotency_records.idempotency_key` | `idempotency_records.key` |
| Migrations V1–V6 | V1–**V7**, plus the runner that applies them |
| `PUT /api/orders/:id/cancel` | **does not exist** |
| `POST /api/payments/create`, `GET /payments/status/:orderId` | **do not exist** |
| `DELETE /api/products/:id` | **does not exist** |
| `GET /api/recommendations/products/:id` | `GET /api/ai/similar/{product_id}` |
| `GET /api/categories/:id`, `POST /` | `GET /api/categories/{slug}`; writes via `/api/admin/categories` |
| Light theme, Vyapari Red `#ff385c`, 8px/14px radii | **Metallic Dark**, 12px cards / 9999px pills |
| Demo sellers `seller1@`… "Aura Living India" | **`store.<brand>@vyapari.com`**, 47 brand stores |
| 58 brand stores | **47** |
| Automatic stock restoration on cancel/timeout | **never implemented** |
| Presigned S3 uploads with real bucket writes | **fabricated URL**, no storage |
| 60 req/min telemetry rate limit | **no rate limiting anywhere** |
| 15-minute abandoned-order timeout | **no sweeper exists** |

---
*End of Master Project Documentation — Vyapari Autonomous E-Commerce Operations & Personalization Platform.*
