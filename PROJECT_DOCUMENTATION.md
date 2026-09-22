# Vyapari — Master Project Documentation & Technical Knowledge Base

> **Platform:** Vyapari Autonomous E-Commerce Operations & Personalization Platform  
> **Status:** Production-Grade Hardened & Verified  
> **Repository:** `Kings-man-6969/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform`  
> **Scope:** Complete architectural decisions, technical specifications, system mechanics, data schemas, security boundaries, and operational runbooks.

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
   - [Migration History (V1 – V6)](#migration-history-v1--v6)
   - [Entity Relationship Details & Schemas](#entity-relationship-details--schemas)
   - [Vector Search & pgvector HNSW Configuration](#vector-search--pgvector-hnsw-configuration)
5. [Security & Cryptographic Architecture](#5-security--cryptographic-architecture)
   - [Authentication & Token Family Rotation (RFC 6749)](#authentication--token-family-rotation-rfc-6749)
   - [Atomic Order Idempotency & Concurrency](#atomic-order-idempotency--concurrency)
   - [Payment Gateway Webhook Verification](#payment-gateway-webhook-verification)
   - [SSRF Elimination & Presigned S3 Pipeline](#ssrf-elimination--presigned-s3-pipeline)
   - [Security Headers, CSP & Telemetry Ingestion](#security-headers-csp--telemetry-ingestion)
6. [Storefront & Customer Journey](#6-storefront--customer-journey)
   - [Natural Language Query (NLQ) Search Engine](#natural-language-query-nlq-search-engine)
   - [Real-Time Autocomplete Popover](#real-time-autocomplete-popover)
   - [Faceted Catalog Discovery (`/explore`)](#faceted-catalog-discovery-explore)
   - [3-Column Product Detail Page (PDP) & Buy Box](#3-column-product-detail-page-pdp--buy-box)
   - [Customer Reviews & Verified Purchase Gating](#customer-reviews--verified-purchase-gating)
   - [Cart, Checkout & Order Lifecycle](#cart-checkout--order-lifecycle)
   - [Customer Self-Service (Wishlist, Addresses, Notifications)](#customer-self-service-wishlist-addresses-notifications)
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
8. [Admin Governance Desk (`/admin/*`)](#8-admin-governance-desk-admin)
   - [Platform Executive Overview](#platform-executive-overview)
   - [User Governance & Role Elevation](#user-governance--role-elevation)
   - [Merchant KYC Verification Workflow](#merchant-kyc-verification-workflow)
   - [Global Catalog Moderation & Takedowns](#global-catalog-moderation--takedowns)
   - [Category Taxonomy Management](#category-taxonomy-management)
   - [System Diagnostics & Container Observability](#system-diagnostics--container-observability)
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
- `products.price_cents` or `products.stock_qty`
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
                        │    37 Pages · Vanilla CSS     │
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
| `vyapari-redis` | `redis:7-alpine` | `6379:6379` | Token blacklisting, rate limiters, AI quota counters, Celery message broker. |
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

### Migration History (V1 – V6)

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
   - Adds composite indexes for query optimization: `(category_id, status, price_cents)`, `(seller_id, status)`, `(user_id, created_at DESC)`.
5. **`V5__agent_privileges.sql`**:
   - Creates `vyapari_agent` role with least-privilege grants and explicit revokes.
6. **`V6__agent_audit_log.sql`**:
   - Creates immutable `agent_audit_log` with prompt versioning, input/output token counters, execution latencies, and seller correlation.

---

### Entity Relationship Details & Schemas

#### Core Relational Tables
```text
  ┌──────────────┐         1:1         ┌──────────────────┐
  │    users     ├─────────────────────┤ seller_profiles  │
  └──────┬───────┘                     └────────┬─────────┘
         │                                      │
         │ 1:N                                  │ 1:N
         ▼                                      ▼
  ┌──────────────┐         1:N         ┌──────────────────┐
  │    orders    │                     │     products     │
  └──────┬───────┘                     └────────┬─────────┘
         │                                      │
         │ 1:N                                  │ 1:1
         ▼                                      ▼
  ┌──────────────┐                     ┌──────────────────┐
  │ order_items  │◀────────────────────┤product_embeddings│
  └──────────────┘         M:1         └──────────────────┘
```

#### Detailed Column Specifications

- **`users`**:
  - `id` (UUID PK, default `uuid_generate_v4()`)
  - `email` (VARCHAR 255, UNIQUE, NOT NULL)
  - `password_hash` (VARCHAR 255, NOT NULL - bcrypt $2b$)
  - `full_name` (VARCHAR 255, NOT NULL)
  - `role` (VARCHAR 50, DEFAULT 'customer' — 'customer' | 'seller' | 'admin')
  - `status` (VARCHAR 50, DEFAULT 'active' — 'active' | 'suspended' | 'pending_kyc')
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`seller_profiles`**:
  - `id` (UUID PK)
  - `user_id` (UUID FK -> users.id, UNIQUE, NOT NULL)
  - `store_name` (VARCHAR 255, NOT NULL)
  - `store_slug` (VARCHAR 255, UNIQUE, NOT NULL)
  - `business_type` (VARCHAR 100 — 'individual' | 'proprietorship' | 'pvt_ltd')
  - `pan` (VARCHAR 10), `gstin` (VARCHAR 15)
  - `bank_account_number`, `bank_ifsc`, `bank_account_name`
  - `kyc_status` (VARCHAR 50, DEFAULT 'submitted' — 'submitted' | 'verified' | 'rejected')
  - `return_policy`, `shipping_policy` (TEXT — Markdown format indexed for Support RAG)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`products`**:
  - `id` (UUID PK)
  - `seller_id` (UUID FK -> seller_profiles.id, NOT NULL)
  - `category_id` (UUID FK -> categories.id, NOT NULL)
  - `sku` (VARCHAR 100, UNIQUE, NOT NULL)
  - `title` (VARCHAR 500, NOT NULL)
  - `slug` (VARCHAR 500, UNIQUE, NOT NULL)
  - `description` (TEXT)
  - `price_cents` (INTEGER NOT NULL — stores INR in paise or cents to avoid float drift)
  - `original_price_cents` (INTEGER)
  - `stock_qty` (INTEGER NOT NULL DEFAULT 0)
  - `images` (JSONB — array of URL strings)
  - `specifications` (JSONB — key/value technical specifications)
  - `features` (JSONB — array of bulleted highlights)
  - `status` (VARCHAR 50, DEFAULT 'active' — 'active' | 'draft' | 'archived' | 'out_of_stock')
  - `rating` (NUMERIC(3,2), DEFAULT 0.00)
  - `review_count` (INTEGER DEFAULT 0)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`product_stats_daily`**:
  - `product_id` (UUID FK -> products.id, NOT NULL)
  - `date` (DATE NOT NULL)
  - `region` (VARCHAR 100 NOT NULL DEFAULT 'global' — Contract correction C6 prevents NULL PK conflict)
  - `views`, `impressions`, `cart_adds`, `orders`, `revenue_cents` (INTEGER DEFAULT 0)
  - `conversion_rate` (NUMERIC(5,4) DEFAULT 0.0000)
  - `PRIMARY KEY (product_id, date, region)`

- **`orders`**:
  - `id` (UUID PK)
  - `order_number` (VARCHAR 50, UNIQUE, NOT NULL)
  - `user_id` (UUID FK -> users.id, NOT NULL)
  - `status` (VARCHAR 50, DEFAULT 'pending' — 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled')
  - `payment_status` (VARCHAR 50, DEFAULT 'pending' — 'pending' | 'paid' | 'failed' | 'refunded')
  - `total_cents`, `subtotal_cents`, `shipping_cents`, `tax_cents`, `discount_cents` (INTEGER NOT NULL)
  - `shipping_address` (JSONB NOT NULL)
  - `courier_name` (VARCHAR 100 — 'Blue Dart', 'Delhivery', 'DTDC', 'India Post')
  - `tracking_number` (VARCHAR 100)
  - `payment_provider` (VARCHAR 50, DEFAULT 'razorpay')
  - `payment_transaction_id` (VARCHAR 255)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`idempotency_records`**:
  - `id` (UUID PK)
  - `user_id` (UUID FK -> users.id, NOT NULL)
  - `idempotency_key` (VARCHAR 255, NOT NULL)
  - `request_hash` (VARCHAR 64, NOT NULL — SHA-256 of payload)
  - `response_code` (INTEGER)
  - `response_body` (JSONB)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())
  - `UNIQUE (user_id, idempotency_key)`

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
- If the payload's SHA-256 hash does not match `request_hash`, it rejects the request with `HTTP 422 Unprocessable Entity` (payload tampering protection).

---

### Payment Gateway Webhook Verification

Vyapari integrates with Razorpay (and supports Stripe/PayU patterns):
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
3. **Payment Failure Recovery (Contract C3)**:
   Provides `GET /api/payments/status/:orderId`. When a user returns to an order screen marked `pending`, the frontend checks the status once. If the gateway confirms payment but the webhook was delayed, the order status transitions to `confirmed` immediately.

---

### SSRF Elimination & Presigned S3 Pipeline

To prevent Server-Side Request Forgery (SSRF) and image upload attacks:
1. **Direct S3 Presigned PUT (`/api/uploads/presign`)**:
   - Available exclusively to authenticated sellers.
   - Client sends filename and MIME type.
   - Backend checks strict whitelist: `image/jpeg`, `image/png`, `image/webp`. Rejects all others (SVGs, executables).
   - Generates an Amazon S3 presigned URL with an upload limit of 5 MB and 15-minute expiration.
   - Browser uploads the image directly to S3. Backend never proxies file bytes.
2. **In-Memory Pillow Byte Sanitization**:
   Before an image is processed by AI agents, `image_validator.py` inspects the bytes:
   - Reads magic bytes header to verify legitimate JPEG/PNG/WebP data.
   - Rejects XML/SVG signatures (preventing SVG XSS).
   - Verifies dimensions ($\le 4096 \times 4096$) and aspect ratio sanity.

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
  - Enforces a 10 KB payload size limit and 60 requests/minute per IP rate limit.

---

## 6. Storefront & Customer Journey

The Vyapari storefront provides a frictionless, premium consumer shopping experience across 15 dedicated routes.

### Natural Language Query (NLQ) Search Engine

Vyapari’s search bar is powered by an NLQ semantic parser in `backend-core-py/app/routers/products.py`:
- **Free-Form Parsing**:
  - Extracts price bounds (`"under 5000"`, `"below 10k"`, `"less than 2000"`) $\to$ `price_cents <= X`.
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
- **Submission**: Elevated to `pending_kyc` status, pending administrator approval.

---

### Seller Dashboard & Executive Analytics

- **Metrics Cards**: 30-day Gross Merchandise Value (GMV), Total Orders, Units Sold, Low Stock Alert Count.
- **Sales Velocity Graph**: Daily order count and revenue trends.
- **Pending Actions**: Direct alert links to pending approvals, out-of-stock items, and unfulfilled orders.

---

### Product Catalog & Inventory Management

- Full CRUD capability over products at `/seller/products`.
- Real-time stock increment/decrement controls.
- Dynamic specification and bullet feature list builder.
- Direct S3 image upload with presigned URLs.

---

### AI Listing Studio & Content Synthesis

Located at `/seller/ai-listing`:
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
- The seller can **Approve** or **Reject** with one click.
- Upon approval, `backend-core` applies the mutation safely.

---

### Seller AI Copilot Chat & Support RAG

- **AI Copilot Chat (`/seller/ai-chat`)**:
  Conversational merchant assistant capable of analyzing sales performance, explaining return policies, and providing inventory recommendations.
- **Support RAG Desk (`/seller/settings`)**:
  Merchants author custom Shipping and Return policies in Markdown. The policies are embedded into vectors; when customers or copilot chat query store rules, relevant sections are retrieved via cosine similarity and synthesized into accurate policy answers.

---

## 8. Admin Governance Desk (`/admin/*`)

The administrative portal empowers platform operators to oversee transactions, enforce compliance, and maintain catalog integrity across 6 dedicated portals.

### Platform Executive Overview (`/admin`)

- **Top-Line Metrics**: Global Gross Merchandise Value (GMV), Total Active Users, Registered Sellers, Lifetime Orders.
- **Platform Health Status**: Redis cache connectivity, PostgreSQL connection pool latency, vector search indexing health.

---

### User Governance & Role Elevation (`/admin/users`)

- Searchable directory of all registered accounts.
- Filter by role (`customer`, `seller`, `admin`) and account status (`active`, `suspended`, `pending_kyc`).
- Instant suspension and reactivation toggles.
- Manual role elevation capability.

---

### Merchant KYC Verification Workflow (`/admin/sellers`)

- Auditing queue for sellers who have completed the 4-step onboarding.
- Inspects submitted business name, PAN, GSTIN, and bank coordinates.
- Actions: **Approve KYC** (elevates seller store to active status) or **Reject KYC** (prompts seller for revised documentation).

---

### Global Catalog Moderation & Takedowns (`/admin/products`)

- Global view across all merchant product listings.
- Filter by reported items, out-of-stock items, or category.
- Administrative moderation: Force delist / archive infringing products, toggle featured status for homepage exposure.

---

### Category Taxonomy Management (`/admin/categories`)

- Hierarchical tree manager for product categories.
- Create parent categories, child subcategories, URL slugs, and display order indices.

---

### System Diagnostics & Container Observability (`/admin/system`)

- Live telemetry monitoring container health checks across all 6 services.
- Real-time error log streaming from the `/api/telemetry/errors` ingest pipeline.

---

## 9. AI Microservices Deep Dive

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
- **Cold-Start Fallback (Contract C5)**:
  Logged-out users or new profiles receive the trending/popular feed (`/recommendations/popular?limit=20`) without requiring tracking cookies or device fingerprinting.

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

- **Seller Daily Quota**:
  - Max 500 requests per day per merchant.
  - Max 500,000 LLM tokens per day per merchant.
- Tracked in Redis using daily expiring keys (`quota:seller:{id}:{YYYY-MM-DD}`).
- Graceful Fail-Open: If Redis is temporarily unreachable, the quota check logs a warning and permits the request to preserve platform availability.

---

## 10. Frontend Architecture & Global Design System

The frontend is a lightweight, responsive React 18 Single-Page Application (SPA) built using Vite and Vanilla CSS.

### Design Tokens, Typography & Color Palette

All styling adheres to `DESIGN.md` and `product_bible.md`:
- **Canvas**: Clean white `#ffffff` across all page floors. No dark mode.
- **Primary Accent**: Vyapari Red (`#ff385c`) applied exclusively to primary CTAs, active wishlist hearts, the search orb, and the brand mark. Active state: `#e00b41`; disabled state: `#ffd1da`.
- **Neutral Palette**: Ink (`#222222`), Body (`#3f3f3f`), Muted (`#6a6a6a`), Light Gray (`#f7f7f7`), Border Gray (`#dddddd`).
- **Typography Scale (Inter)**:
  - Hero Display: 28px / 700
  - Product Detail H1: 22px / 500
  - Section Headings: 21px / 700
  - Card Titles / Nav: 16px / 600
  - Body Text: 16px / 400
  - Card Metadata / Captions: 14px / 400
  - Badges: 11px / 600
- **Soft Border Geometry**: Buttons (`8px`), Cards (`14px`), Search & Filter Pills (`9999px`).

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

All endpoints are mounted under `backend-core-py` and documented via OpenAPI at `/api/docs`:

| Path Prefix | Router File | Key Endpoints & Methods | Auth Level | Purpose |
|---|---|---|---|---|
| `/health` | `health.py` | `GET /health` | Public | Container liveness and DB/Redis health probes. |
| `/api/auth` | `auth/router.py` | `POST /register`<br>`POST /login`<br>`POST /refresh`<br>`POST /logout`<br>`GET /me` | Mixed | Registration, login, opaque cookie refresh, session clearance, identity check. |
| `/api/products` | `products.py` | `GET /`<br>`GET /:id`<br>`GET /suggest`<br>`POST /`<br>`PUT /:id`<br>`DELETE /:id` | Mixed | NLQ search, autocomplete suggestions, faceted query, seller catalog CRUD. |
| `/api/categories`| `categories.py` | `GET /`<br>`GET /:id`<br>`POST /` | Public / Admin | Category taxonomy trees and administration. |
| `/api/cart` | `cart.py` | `GET /`<br>`POST /items`<br>`PUT /items/:id`<br>`DELETE /items/:id` | Customer | User-scoped shopping cart operations. |
| `/api/orders` | `orders.py` | `GET /`<br>`GET /:id`<br>`POST /` (Idempotent)<br>`PUT /:id/cancel` | Customer / Seller | Order placement with `SELECT FOR UPDATE`, tracking, cancellation. |
| `/api/payments` | `payments.py` | `POST /create`<br>`POST /webhook`<br>`GET /status/:orderId` | Mixed | Payment creation, HMAC-SHA256 webhook ingest, payment recovery. |
| `/api/seller` | `seller.py` | `GET /dashboard`<br>`POST /onboarding`<br>`GET /inventory`<br>`GET /orders`<br>`PUT /orders/:id/fulfill`<br>`GET /reviews` | Seller | Merchant KYC, dashboard metrics, inventory velocity, courier fulfillment. |
| `/api/approvals` | `approvals.py` | `GET /`<br>`POST /:id/approve`<br>`POST /:id/reject` | Seller | Human-in-the-loop agent proposal approval queue. |
| `/api/ai` | `ai.py` | `POST /generate-listing`<br>`POST /inventory-advice`<br>`POST /chat` | Seller | Gateway proxy to `service-seller-agent`. |
| `/api/reviews` | `reviews.py` | `GET /product/:id`<br>`POST /product/:id`<br>`POST /:id/reply`<br>`POST /:id/helpful` | Mixed | Verified purchase reviews, seller reply threads, helpful votes. |
| `/api/wishlist` | `wishlist.py` | `GET /`<br>`POST /:productId`<br>`DELETE /:productId` | Customer | Wishlist management with optimistic toggling. |
| `/api/users` | `users.py` | `GET /profile`<br>`PUT /profile`<br>`GET /addresses`<br>`POST /addresses` | Customer | Profile editing, multi-address book management. |
| `/api/uploads` | `uploads.py` | `POST /presign` | Seller | S3 presigned PUT generation with MIME whitelist. |
| `/api/telemetry`| `telemetry.py`| `POST /errors` | Public (Rate Limited)| Client crash telemetry ingestion. |
| `/api/admin` | `admin.py` | `GET /metrics`<br>`GET /users`<br>`PUT /users/:id/status`<br>`GET /sellers`<br>`PUT /sellers/:id/kyc` | Admin | Executive metrics, user governance, seller KYC verification. |
| `/api/notifications`| `notifications.py`| `GET /`<br>`PUT /:id/read` | Customer / Seller | User notification center. |
| `/api/stores` | `stores.py` | `GET /:slug` | Public | Public storefront page for individual sellers. |

---

## 12. Verification, Testing, & Quality Assurance

The Vyapari platform is verified with automated test suites covering all critical correctness and reliability guarantees:

### Automated Test Results

#### 1. Backend Core Suite (`backend-core-py/tests`)
- **Total Tests**: 36 passed in 11.04s.
- **Route Suite (`test_routes.py` & `test_all_endpoints.py`)**: 29 tests validating category trees, NLQ parser, cart items, order transactions, seller dashboards, approvals queue, and administrative endpoints.
- **P0 Correctness Suite (`test_p0_correctness.py`)**:
  - `test_order_idempotency_same_key`: Confirms duplicate `Idempotency-Key` returns the original cached response.
  - `test_order_idempotency_payload_mismatch`: Confirms modified payloads with the same key are rejected with HTTP 422.
  - `test_payment_webhook_hmac_valid`: Confirms legitimate HMAC-SHA256 signatures are accepted and update order status.
  - `test_payment_webhook_hmac_invalid`: Confirms forged signatures are rejected with HTTP 400.
  - `test_payment_webhook_replay_deduplication`: Confirms duplicate event IDs are acknowledged without re-processing.
  - `test_s3_presign_mime_whitelist`: Confirms non-whitelisted upload types (e.g., SVG, PDF) are rejected with HTTP 400.
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

#### 4. Frontend Production Compilation
- Built with `vite build` producing a tree-shaken, gzipped production SPA bundle with zero syntax or import errors.

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
1. **Backend Tests Job**:
   - Boots PostgreSQL with pgvector and Redis services.
   - Runs database migrations.
   - Executes `pytest` across `backend-core-py/tests/`.
2. **Microservices Tests Job**:
   - Executes test suites in `service-recommendation/tests/` and `service-seller-agent/tests/`.
3. **Frontend Build Job**:
   - Installs Node.js dependencies and runs `npm run build` to verify production compilation.

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

# AWS S3 Storage (Direct presigned uploads)
AWS_REGION=ap-south-1
AWS_S3_BUCKET=vyapari-product-media
AWS_ACCESS_KEY_ID=placeholder_access_key
AWS_SECRET_ACCESS_KEY=placeholder_secret_key
```

---
*End of Master Project Documentation — Vyapari Autonomous E-Commerce Operations & Personalization Platform.*
