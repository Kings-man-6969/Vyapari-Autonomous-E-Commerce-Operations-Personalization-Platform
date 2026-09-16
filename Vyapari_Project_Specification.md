# Vyapari — E-Commerce Platform
## Complete Project Plan & Technical Specification

**Version:** 1.0
**Backend:** Python (FastAPI)
**Primary Database:** PostgreSQL (AI/ML-ready with pgvector)

---

## 1. Project Overview

**Vyapari** is a dual-role e-commerce marketplace with two distinct entry experiences — **Customer** and **Seller** — accessed from a single landing page. The platform is architected from day one to support future AI/ML capabilities (recommendations, semantic search, fraud detection, demand forecasting, chatbots) without requiring a database migration later.

### 1.1 Core Principles
- **Single brand, dual experience** — one landing page, two role-based journeys.
- **API-first backend** — FastAPI serving a clean REST (and optionally GraphQL) API consumed by web/mobile clients.
- **AI/ML-ready from day one** — schema and infra designed to store embeddings, events, and features without re-architecture later.
- **Modular monolith → microservices path** — start as a well-structured monolith, split into services (catalog, orders, payments, ML) as scale demands.

---

## 2. User Flow & Dual Login Design

### 2.1 Landing Page (`/`)
- Vyapari logo, tagline, hero section
- Two primary CTA cards:
  - **"I'm a Customer"** → `/customer`
  - **"I'm a Seller"** → `/seller`
- Secondary link: "Vyapari for Business" (seller onboarding info) in the footer

### 2.2 Customer Branch
- `/customer/login` and `/customer/signup` (email/phone/OTP/social login)
- On success → Customer Home (`/customer/home`): catalog, banners, categories, recommendations

### 2.3 Seller Branch
- `/seller/login` and `/seller/signup` (business name, GSTIN/PAN, bank details, address)
- On success → Seller Dashboard (`/seller/dashboard`): store setup, listings, orders, analytics
- New sellers enter a **KYC/verification pending** state until admin approval

### 2.4 Shared Identity Model
- Single `users` table with a `role` enum (`customer`, `seller`, `admin`)
- One person *can* hold both a customer and seller profile under the same account (like Amazon/Flipkart), linked via `user_id`
- Role-based access control (RBAC) enforced at the API layer via FastAPI dependencies

---

## 3. Feature Set

### 3.1 Customer-Side Features
- Browse/search products (filters: category, price range, rating, brand, availability)
- Semantic + keyword search (AI/ML-ready, see Section 7)
- Product detail pages: images, description, variants, stock, reviews
- Cart, wishlist, "save for later"
- Checkout: address book, multiple payment methods, order summary
- Order tracking, order history, invoices
- Ratings & reviews with photo upload
- Return/refund/replacement requests
- Notifications: order status, price drops, restock alerts
- Personalized recommendations ("You may also like", "Frequently bought together")
- Customer support chat / ticketing

### 3.2 Seller-Side Features
- Seller onboarding with KYC (GSTIN/PAN, bank account, business address)
- Store profile & branding setup
- Product listing management (single add + bulk CSV/Excel upload)
- Inventory & stock management with low-stock alerts
- Order management: accept, pack, ship, cancel, return handling
- Sales analytics dashboard (revenue, top products, conversion)
- Payment settlement & payout tracking
- Coupon/discount/promotion creation
- Demand forecasting insights (AI/ML-ready, see Section 7)
- Customer query/dispute handling

### 3.3 Admin Panel
- Seller KYC approval/rejection
- Product & listing moderation (policy violations, counterfeit flags)
- Category/catalog/taxonomy management
- Commission structure & payout management
- Dispute resolution center
- Platform-wide analytics
- Fraud/anomaly review queue (AI/ML-ready, see Section 7)

### 3.4 Shared Platform Features
- Authentication: JWT access + refresh tokens, OTP verification
- Notifications: email (SendGrid/SES), SMS (Twilio/MSG91), push
- Payment gateway integration (Razorpay/Stripe)
- Shipping/logistics integration (Shiprocket/Delhivery API)
- Ratings & review engine
- Audit logging for sensitive actions
- Multi-language & multi-currency support (Phase 2)

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend framework | **FastAPI** (Python 3.12+) | Async, auto-generated OpenAPI docs, Pydantic v2 validation |
| ASGI server | Uvicorn + Gunicorn (prod) | Multi-worker deployment |
| Primary database | **PostgreSQL 16+** with **pgvector** extension | Relational data + native vector embedding storage for AI/ML |
| Caching / sessions | Redis | Session cache, rate limiting, Celery broker |
| Task queue | Celery + Redis/RabbitMQ | Async jobs: emails, ML inference, report generation |
| Search engine | OpenSearch / Elasticsearch | Keyword search; can host hybrid (keyword + vector) search |
| ORM | SQLAlchemy 2.0 (async) + Alembic | Migrations & type-safe queries |
| Auth | FastAPI + `python-jose` (JWT) + `passlib` (bcrypt) | RBAC via dependency injection |
| File/image storage | AWS S3 / Cloudinary | Product images, KYC documents |
| Data validation | Pydantic v2 | Request/response schemas |
| ML/AI stack (future) | scikit-learn, PyTorch, sentence-transformers, LangChain (optional) | Recommendation, embeddings, NLP |
| Feature store (future) | Feast (optional) or custom tables on PostgreSQL | ML feature serving |
| Containerization | Docker + Docker Compose | Local dev parity with prod |
| Orchestration | Kubernetes (post-MVP) | Horizontal scaling |
| CI/CD | GitHub Actions | Lint, test, build, deploy pipelines |
| Monitoring | Prometheus + Grafana, Sentry | Metrics + error tracking |
| Hosting | AWS (ECS/EKS) or GCP | Backend + DB managed services (RDS/Cloud SQL) |
| Frontend | React.js / Next.js | Separate route groups: `/customer/*`, `/seller/*`, `/admin/*` |

### 4.1 Why PostgreSQL + pgvector for AI/ML readiness
- Stores structured transactional data (orders, users, inventory) **and** high-dimensional vector embeddings in the same database — no need for a separate vector DB (e.g., Pinecone/Weaviate) at MVP stage.
- Enables similarity search (`<->` cosine/L2 distance operators) for:
  - Product recommendation ("similar products")
  - Semantic search ("comfortable running shoes for winter")
  - Duplicate/counterfeit listing detection
- Can migrate to a dedicated vector database (Milvus, Pinecone, Weaviate) later if embedding volume outgrows Postgres — the abstraction layer (a `VectorStore` service class) makes this swap low-risk.
- Time-series extensions (TimescaleDB, optional) can be added on top of PostgreSQL for sales forecasting without changing the core database engine.

---

## 5. Backend Project Structure (FastAPI)

```
vyapari-backend/
├── app/
│   ├── main.py                     # FastAPI app entrypoint
│   ├── core/
│   │   ├── config.py                # Settings (Pydantic BaseSettings)
│   │   ├── security.py              # JWT, password hashing
│   │   ├── dependencies.py          # RBAC, get_current_user, get_db
│   │   └── logging.py
│   ├── db/
│   │   ├── base.py                  # SQLAlchemy Base
│   │   ├── session.py               # Async engine/session
│   │   └── migrations/              # Alembic migrations
│   ├── models/                      # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── seller_profile.py
│   │   ├── customer_profile.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── review.py
│   │   ├── embedding.py             # Vector embedding tables
│   │   └── ml_event.py              # User behavior/event logging
│   ├── schemas/                     # Pydantic request/response models
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── order.py
│   │   └── ...
│   ├── api/
│   │   └── v1/
│   │       ├── router.py            # Aggregates all routers
│   │       ├── auth.py              # /auth/login, /auth/signup, /auth/refresh
│   │       ├── customer/
│   │       │   ├── catalog.py
│   │       │   ├── cart.py
│   │       │   ├── orders.py
│   │       │   └── reviews.py
│   │       ├── seller/
│   │       │   ├── products.py
│   │       │   ├── inventory.py
│   │       │   ├── orders.py
│   │       │   └── analytics.py
│   │       ├── admin/
│   │       │   ├── approvals.py
│   │       │   └── moderation.py
│   │       └── ml/
│   │           ├── recommendations.py
│   │           └── search.py
│   ├── services/                    # Business logic layer
│   │   ├── auth_service.py
│   │   ├── order_service.py
│   │   ├── payment_service.py
│   │   ├── recommendation_service.py
│   │   └── vector_store_service.py
│   ├── ml/                          # ML pipelines (future-facing, stubbed at MVP)
│   │   ├── embeddings/
│   │   │   └── product_embedder.py
│   │   ├── recommenders/
│   │   │   └── collaborative_filter.py
│   │   └── pipelines/
│   │       └── train_recommender.py
│   ├── tasks/                       # Celery tasks
│   │   ├── notifications.py
│   │   ├── embedding_refresh.py
│   │   └── report_generation.py
│   └── tests/
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## 6. Core Database Schema (High-Level)

### 6.1 Identity & Roles
- `users` — id, email, phone, password_hash, role (enum: customer/seller/admin), is_verified, created_at
- `customer_profiles` — user_id (FK), full_name, default_address_id, preferences (JSONB)
- `seller_profiles` — user_id (FK), business_name, gstin, pan, bank_account_details, kyc_status, verified_at

### 6.2 Catalog
- `categories` — id, name, parent_id (self-referencing, for nested categories)
- `products` — id, seller_id (FK), name, description, price, stock_qty, category_id, status, created_at
- `product_images` — id, product_id (FK), url, is_primary
- `product_variants` — id, product_id (FK), sku, attributes (JSONB: size/color), price_delta, stock_qty

### 6.3 Orders & Commerce
- `carts`, `cart_items`
- `wishlists`, `wishlist_items`
- `orders` — id, customer_id, status, total_amount, shipping_address_id, created_at
- `order_items` — order_id, product_id, seller_id, qty, unit_price
- `payments` — order_id, gateway_ref, status, amount, method
- `payouts` — seller_id, amount, status, settlement_date
- `coupons` — code, discount_type, value, valid_from, valid_to, seller_id (nullable for platform-wide)

### 6.4 Engagement
- `reviews` — product_id, customer_id, rating, comment, images (JSONB), created_at
- `notifications` — user_id, type, payload (JSONB), read_at

### 6.5 AI/ML-Ready Tables (see Section 7 for detail)
- `product_embeddings` — product_id (FK), embedding (`vector(768)`), model_version, updated_at
- `user_embeddings` — user_id (FK), embedding (`vector(768)`), model_version, updated_at
- `user_events` — user_id, event_type (view/click/cart/purchase), product_id, session_id, metadata (JSONB), timestamp
- `search_queries` — user_id, raw_query, query_embedding (`vector(768)`), results_clicked (JSONB), timestamp
- `model_registry` — model_name, version, artifact_path, metrics (JSONB), deployed_at, is_active

---

## 7. AI/ML Readiness — Design Decisions

Vyapari's data layer is built so ML features can be added **without schema migrations that break production**:

| Future AI/ML Feature | Enabled By |
|---|---|
| Product recommendations ("similar items", "for you") | `product_embeddings` + pgvector similarity search |
| Semantic/natural-language search | `search_queries.query_embedding` matched against `product_embeddings` |
| Personalization | `user_embeddings` derived from `user_events` behavior log |
| Fraud/anomaly detection (fake sellers, review manipulation) | `user_events` + `model_registry` scoring pipeline |
| Demand forecasting for sellers | Time-series aggregation over `order_items` (optionally via TimescaleDB) |
| Customer support chatbot / query classification | `search_queries` + NLP pipeline, served via a dedicated `/api/v1/ml/*` router |
| Dynamic pricing suggestions | Historical `order_items` + competitor data (future data source) |

### 7.1 Event Logging (Day 1 requirement)
Even before any ML model exists, the platform should log `user_events` (views, clicks, add-to-cart, purchases) from day one. This is the single most important AI/ML-readiness decision — **you cannot retroactively generate historical behavior data**, so the event pipeline must ship with the MVP even if no model consumes it yet.

### 7.2 Serving Pattern
- ML inference is exposed via internal FastAPI routers (`/api/v1/ml/recommendations`, `/api/v1/ml/search`) so the frontend never talks to model code directly.
- Models are trained offline (batch jobs via Celery/cron) and embeddings are refreshed periodically into `product_embeddings` / `user_embeddings`.
- `model_registry` table tracks which model version is live, enabling safe rollback.

---

## 8. Authentication & Authorization

- **JWT-based auth**: short-lived access token (15 min) + long-lived refresh token (7–30 days), issued at `/api/v1/auth/login`
- **OTP verification** for phone/email at signup
- **Password hashing**: bcrypt via `passlib`
- **RBAC**: FastAPI dependency (`require_role("seller")`, `require_role("admin")`) guards each router
- **Seller KYC gate**: sellers cannot list products until `kyc_status = approved`
- **Rate limiting**: Redis-backed, applied to auth and search endpoints to prevent abuse

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | API p95 latency < 300ms for catalog/search endpoints |
| Scalability | Stateless FastAPI instances behind a load balancer; horizontal scaling via Kubernetes |
| Security | HTTPS everywhere, OWASP Top 10 mitigations, input validation via Pydantic, secrets in a vault (AWS Secrets Manager) |
| Compliance | PCI-DSS via payment gateway tokenization (no raw card storage); GST-compliant invoicing (India) |
| Availability | 99.9% uptime target for MVP; managed DB with automated backups |
| Observability | Structured logging, Sentry error tracking, Prometheus/Grafana dashboards |
| Testing | Pytest for unit/integration tests, ≥80% coverage on service layer, contract tests for API |

---

## 10. Development Phases & Timeline

| Phase | Duration | Key Deliverables |
|---|---|---|
| **1. Planning & Design** | 1–2 weeks | Wireframes, ER diagram, API contract (OpenAPI spec), infra plan |
| **2. Core Infra & Auth** | 2 weeks | FastAPI skeleton, PostgreSQL + pgvector setup, JWT auth, dual landing page routing, RBAC |
| **3. Customer Module** | 3–4 weeks | Catalog, search, cart, checkout, orders, reviews |
| **4. Seller Module** | 3–4 weeks | Onboarding/KYC, product/inventory management, order fulfillment, seller analytics |
| **5. Admin Panel** | 2 weeks | KYC approvals, moderation, commission/payout management |
| **6. Payments & Logistics Integration** | 2 weeks | Razorpay/Stripe, Shiprocket/Delhivery |
| **7. Event Logging & ML Foundations** | 2 weeks | `user_events` pipeline, embedding tables, baseline "trending products" (non-ML fallback) |
| **8. Testing & QA** | 2 weeks | Unit/integration tests, load testing, security audit |
| **9. Deployment & Launch** | 1 week | Dockerized deployment, CI/CD, monitoring dashboards live |
| **10. Post-MVP: ML v1** | 3–4 weeks (parallel track) | Product embedding pipeline, collaborative-filtering recommendations, semantic search |

**Estimated MVP timeline:** ~5–6 months with a team of 4–6.

---

## 11. Suggested Team Roles

- 1 Product/Project Lead
- 2 Backend Engineers (FastAPI, PostgreSQL)
- 2 Frontend Engineers (customer UI + seller/admin UI)
- 1 ML Engineer (part-time until Phase 10, then full-time)
- 1 UI/UX Designer
- 1 QA/Test Engineer
- 1 DevOps Engineer (part-time, CI/CD & infra)

---

## 12. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Seller fraud / fake listings | KYC gate before listing; admin moderation queue; future ML anomaly detection |
| Vector search performance at scale | Start with pgvector (fine to millions of rows with proper indexing — IVFFlat/HNSW); plan migration path to dedicated vector DB if needed |
| Payment compliance | Delegate card handling entirely to PCI-DSS-compliant gateway (Razorpay/Stripe); never store raw card data |
| Cold-start ML problem (no data at launch) | Ship rule-based fallbacks (e.g., "trending", "best-selling") before any ML model exists; let `user_events` accumulate |
| Dual-UX complexity | Shared design system (component library) so customer/seller/admin UIs stay visually consistent despite different flows |

---

## 13. MVP Scope (Recommended Lean Launch)

1. Landing page with dual customer/seller entry
2. Auth (signup/login) for both roles + basic RBAC
3. Seller: product listing (manual + basic CSV upload), inventory
4. Customer: catalog browse, search (keyword-only at MVP), cart, checkout
5. One payment gateway integration
6. Basic order management (both sides)
7. `user_events` logging pipeline (even with no ML consuming it yet)
8. Admin: seller KYC approval only

**Deferred to v2:** recommendations, semantic search, coupons, multi-language, advanced analytics, dynamic pricing.

---

## 14. Next Steps

- [ ] Finalize wireframes for landing page + dual login/signup screens
- [ ] Lock the OpenAPI contract for MVP endpoints
- [ ] Set up PostgreSQL with `pgvector` extension in dev/staging
- [ ] Scaffold the FastAPI project structure (Section 5)
- [ ] Define the `user_events` schema and start logging from the first customer-facing release
