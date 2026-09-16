# 🛍️ Vyapari — Autonomous E-Commerce Operations & Personalization Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20%2B%20pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache%20%26%20Broker-Redis%207-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Task%20Queue-Celery-37814A?style=flat-square&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay%20INR-0C2340?style=flat-square&logo=razorpay&logoColor=white)](https://razorpay.com/)

**Vyapari** is a production-grade, dual-role e-commerce marketplace built specifically for the Indian market. It bridges buyers and sellers through tailored experiences: a high-converting transactional store for customers and an autonomous operations and analytics dashboard for sellers, backed by an AI/ML-ready foundation from Day 1.

---

## 📑 Table of Contents

- [Key Highlights](#-key-highlights)
- [System Architecture](#-system-architecture)
- [Design System & Aesthetics](#-design-system--aesthetics)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Running with Docker Compose (Recommended)](#running-with-docker-compose-recommended)
  - [Running Backend & Frontend Locally](#running-backend--frontend-locally)
- [API Reference](#-api-reference)
- [Database & AI/ML Readiness](#-databaseml-readiness)
- [Testing](#-testing)
- [Contributing & Development Guidelines](#-contributing--development-guidelines)

---

## 🌟 Key Highlights

- 👥 **Dual-Role Marketplace**: Seamless customer and seller workflows with role-based routing and permissions.
- 🔒 **KYC Verification Pipeline**: Strict seller onboarding with GSTIN/PAN validation, bank details verification, and an admin review queue. Sellers cannot list products until approved.
- 💳 **Indian Market Payments**: Deep Razorpay integration with INR-first transactions (paise precision), HMAC-SHA256 signature verification, and webhook handling.
- 🧠 **AI/ML Ready From Day 1**: PostgreSQL with `pgvector` enabled out of the box. Includes schemas for `product_embeddings`, `user_embeddings`, `user_events`, and `model_registry`. Rule-based fallback recommendations for MVP with direct upgrade paths to semantic search.
- 🎨 **Shopifi-Inspired Two-Canvas Design System**:
  - **Cinematic Dark (`#000000`)**: High-impact marketing, landing page hero, and footers.
  - **Transactional Cream/Light (`#fbfbf5` / `#ffffff`)**: High-contrast, clean customer storefront, checkout, and seller management dashboards.
  - **Typography**: Inter Display with OpenType stylistic set `ss03` enabled.
- ⚡ **Asynchronous Background Processing**: Celery + Redis for order confirmation emails, KYC notifications, and scheduled embedding refreshes.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        Web["Next.js 14+ Frontend (App Router, Turbopack)"]
    end

    subgraph API & Gateway Layer
        FastAPI["FastAPI Backend (Async / Uvicorn)"]
    end

    subgraph Service & Task Layer
        AuthSvc["Auth Service (JWT & Google OAuth2)"]
        OrderSvc["Order & Cart Service"]
        PaySvc["Payment Service (Razorpay)"]
        RecSvc["Recommendation Service"]
        VecSvc["Vector Store Service (pgvector)"]
        CeleryWorker["Celery Worker (SendGrid / Async Jobs)"]
        CeleryBeat["Celery Beat (Scheduled Tasks)"]
    end

    subgraph Data & Storage Layer
        Postgres[("PostgreSQL 16 + pgvector")]
        Redis[("Redis 7 (Broker & Session Cache)")]
    end

    Web -->|HTTP / REST| FastAPI
    FastAPI --> AuthSvc
    FastAPI --> OrderSvc
    FastAPI --> PaySvc
    FastAPI --> RecSvc
    FastAPI --> VecSvc

    FastAPI -->|Enqueue Jobs| Redis
    CeleryBeat -->|Trigger Periodic Tasks| Redis
    Redis -->|Consume Tasks| CeleryWorker

    AuthSvc --> Postgres
    OrderSvc --> Postgres
    PaySvc --> Postgres
    RecSvc --> Postgres
    VecSvc --> Postgres
```

---

## 🎨 Design System & Aesthetics

Vyapari adheres to the design specification described in [`DESIGN.md`](./DESIGN.md):

| Element | Specification |
| :--- | :--- |
| **Canvas Modes** | **Cinematic Dark**: `#000000` (Hero, Marketing, Footers)<br>**Transactional Cream**: `#fbfbf5` / `#ffffff` (Store, Dashboards, Auth) |
| **Accents** | **Aloe**: `#c1fbd4`, **Pistachio**: `#d4f9e0`, **Elevated Dark**: `#1e2c31` |
| **Typography** | Primary font: **Inter / Inter Display** with OpenType feature `font-feature-settings: "ss03"` |
| **Controls** | Pill-shaped CTA buttons (`border-radius: 9999px`), subtle hairline borders (`#e4e4e7` / `#1e2c31`), smooth elevation shadows |

---

## 💻 Tech Stack

### Backend (`vyapari-backend/`)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **ORM & DB Engine**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (Async with `asyncpg`)
- **Migrations**: [Alembic](https://alembic.sqlalchemy.org/) (Async configuration)
- **Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) + `pydantic-settings`
- **Database**: PostgreSQL 16 with `pgvector` and `pg_trgm` extensions
- **Background Tasks**: [Celery](https://docs.celeryq.dev/) with [Redis](https://redis.io/)
- **Auth & Security**: JWT (jose), Passlib (bcrypt), Authlib (Google OAuth2)
- **Payments**: Razorpay Python SDK (HMAC-SHA256 signature verification)
- **Logging & Monitoring**: Structlog (JSON in prod, colored in dev), Sentry SDK

### Frontend (`vyapari-frontend/`)
- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router, Turbopack, TypeScript)
- **Styling**: Pure Vanilla CSS with CSS Custom Properties and CSS Modules (no Tailwind lock-in)
- **Data Fetching**: [SWR](https://swr.vercel.app/) + native `fetch`
- **Icons**: [Lucide React](https://lucide.dev/)
- **Token Management**: `js-cookie`

---

## 📁 Repository Structure

```text
Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform/
├── DESIGN.md                          # UI/UX design tokens and design principles
├── Vyapari_Project_Specification.md   # Comprehensive product and technical spec
├── README.md                          # Project overview and instructions
├── memory.md                          # Engineering memory and design rationale
│
├── vyapari-backend/                   # FastAPI Backend
│   ├── Dockerfile                     # Multi-stage Docker build
│   ├── docker-compose.yml             # Full-stack local dev orchestration
│   ├── requirements.txt               # Backend dependencies
│   ├── alembic.ini                    # Database migration settings
│   ├── .env.example                   # Environment variable template
│   ├── scripts/
│   │   └── init_db.sql                # PostgreSQL extension initialization
│   └── app/
│       ├── main.py                    # FastAPI application entrypoint
│       ├── core/                      # Config, security, logging, RBAC dependencies
│       ├── db/                        # Base models, async session, Alembic env
│       ├── models/                    # SQLAlchemy ORM models (User, Product, Order, pgvector)
│       ├── schemas/                   # Pydantic validation and serialization schemas
│       ├── services/                  # Business logic (Auth, Order, Payment, Vector, Recs)
│       ├── api/v1/                    # Version 1 REST API routers
│       ├── tasks/                     # Celery application and background jobs
│       ├── ml/                        # ML embedders and registry stubs
│       └── tests/                     # Pytest suite with async SQLite test harness
│
└── vyapari-frontend/                  # Next.js 14+ Frontend
    ├── package.json                   # Dependencies and scripts
    ├── tsconfig.json                  # TypeScript compiler configuration
    ├── next.config.ts                 # Next.js build configuration
    ├── .env.example                   # Frontend environment template
    ├── .env.local                     # Local dev environment config
    └── app/
        ├── layout.tsx                 # Root layout with SEO and font configurations
        ├── globals.css                # Global design system tokens and utilities
        ├── page.tsx                   # Cinematic Dark Landing Page
        ├── page.module.css            # Landing page styles
        ├── customer/
        │   ├── login/                 # Customer login (Google OAuth + Email)
        │   ├── signup/                # Two-step customer onboarding
        │   ├── home/                  # Storefront, search, and category listing
        │   └── auth.module.css        # Shared customer authentication styles
        ├── seller/
        │   ├── login/                 # Seller sign-in
        │   ├── signup/                # Multi-step onboarding + KYC submission
        │   └── dashboard/             # Seller overview, metrics & inventory
        └── admin/
            └── dashboard/             # Admin KYC review and approval queue
```

---

## 🚀 Getting Started

### Prerequisites

- **Docker & Docker Compose** (recommended for instant setup)
- *OR* for local native development:
  - **Python 3.11+**
  - **Node.js 18+** & **npm 9+**
  - **PostgreSQL 16** (with `pgvector` extension)
  - **Redis 7**

---

### Environment Configuration

#### 1. Backend Configuration
Create your `.env` file in `vyapari-backend/`:
```bash
cp vyapari-backend/.env.example vyapari-backend/.env
```
Key variables to check:
```env
APP_ENV=development
SECRET_KEY=change_this_to_a_secure_random_string_32_chars_min
DATABASE_URL=postgresql+asyncpg://vyapari_user:vyapari_pass@localhost:5432/vyapari_db
REDIS_URL=redis://localhost:6379/0
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=rzp_secret_placeholder
```

#### 2. Frontend Configuration
Create your `.env.local` file in `vyapari-frontend/`:
```bash
cp vyapari-frontend/.env.example vyapari-frontend/.env.local
```
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Running with Docker Compose (Recommended)

To start the complete platform (PostgreSQL with pgvector, Redis, FastAPI backend, and Next.js frontend):

```bash
cd vyapari-backend
docker compose up --build
```

Access the services:
- **Customer Store & Landing**: [http://localhost:3000](http://localhost:3000)
- **Seller Dashboard**: [http://localhost:3000/seller/dashboard](http://localhost:3000/seller/dashboard)
- **Admin KYC Queue**: [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard)
- **FastAPI OpenAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Running Backend & Frontend Locally

#### 1. Start Backend

```bash
cd vyapari-backend

# 1. Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run database migrations
alembic upgrade head

# 4. Start the FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*(Optional) Start Celery Worker in a separate terminal:*
```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

#### 2. Start Frontend

```bash
cd vyapari-frontend

# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Start the Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Reference

Vyapari exposes a comprehensive RESTful API under `/api/v1`:

### 🔐 Authentication (`/api/v1/auth`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/customer/signup` | Register a new customer account |
| `POST` | `/api/v1/auth/seller/signup` | Register a new seller account (starts with KYC `pending`) |
| `POST` | `/api/v1/auth/login` | Authenticate with email and password |
| `POST` | `/api/v1/auth/refresh` | Obtain a new access token using a refresh token |
| `GET` | `/api/v1/auth/oauth/google` | Initiate Google OAuth2 login flow |
| `GET` | `/api/v1/auth/oauth/google/callback` | Google OAuth2 code exchange callback |

### 🛍️ Customer Catalog & Cart (`/api/v1/catalog`, `/api/v1/customer`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/catalog/categories` | Retrieve list of all categories |
| `GET` | `/api/v1/catalog/products` | Paginated product listing with filters & search |
| `GET` | `/api/v1/catalog/products/{id}` | Get full product detail (variants & images) |
| `GET` | `/api/v1/catalog/products/{id}/reviews` | Fetch verified reviews for a product |
| `POST` | `/api/v1/catalog/products/{id}/reviews` | Post a customer review (Customer role required) |
| `GET` | `/api/v1/customer/cart` | Get current customer's shopping cart |
| `POST` | `/api/v1/customer/cart/items` | Add item/variant to cart |
| `PATCH` | `/api/v1/customer/cart/items/{id}` | Update quantity or toggle save-for-later |
| `DELETE` | `/api/v1/customer/cart/items/{id}` | Remove item from cart |

### 💳 Checkout & Orders (`/api/v1/customer/orders`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/customer/orders/checkout` | Create order from cart & reserve stock |
| `GET` | `/api/v1/customer/orders` | List order history for customer |
| `GET` | `/api/v1/customer/orders/{id}` | Get details of a specific order |
| `POST` | `/api/v1/customer/orders/{id}/cancel` | Cancel a pending/confirmed order |
| `POST` | `/api/v1/customer/orders/{id}/pay` | Create Razorpay order for payment |
| `POST` | `/api/v1/customer/orders/{id}/capture` | Verify Razorpay HMAC signature & capture payment |

### 🏪 Seller Management (`/api/v1/seller`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/seller/products` | List all seller products (KYC gated) |
| `POST` | `/api/v1/seller/products` | Create a new product with auto-slugification |
| `PATCH` | `/api/v1/seller/products/{id}` | Update product details/stock |
| `DELETE` | `/api/v1/seller/products/{id}` | Soft-archive a product |
| `GET` | `/api/v1/seller/orders` | Orders containing items sold by this seller |
| `PATCH` | `/api/v1/seller/orders/{id}/status` | Update fulfillment state (processing, shipped, etc.) |
| `GET` | `/api/v1/seller/analytics/revenue` | Revenue summary (total, order count, AOV) |
| `GET` | `/api/v1/seller/analytics/top-products` | Top selling products by volume and revenue |

### 🛡️ Admin KYC (`/api/v1/admin`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/sellers/pending` | Fetch queue of pending KYC submissions |
| `POST` | `/api/v1/admin/sellers/{id}/kyc` | Approve or reject seller KYC submission |

### 🤖 AI/ML Recommendations (`/api/v1/ml/recommendations`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/ml/recommendations/trending` | Trending products (order volume based fallback) |
| `GET` | `/api/v1/ml/recommendations/bestsellers` | All-time bestsellers with optional category filter |
| `GET` | `/api/v1/ml/recommendations/similar/{id}` | Similar products (pgvector similarity slot) |

---

## 🧠 Database & ML Readiness

Vyapari is engineered to avoid retroactive migrations when deploying machine learning models:
1. **`product_embeddings` & `user_embeddings`**: Tables pre-configured with 768-dimensional `Vector(768)` columns (compatible with `sentence-transformers/all-mpnet-base-v2`).
2. **`user_events`**: Append-only event tracking (`view`, `click`, `cart_add`, `wishlist_add`, `purchase`, `review`, `search`) capturing interactions from Day 1 to train future recommendation models.
3. **`model_registry`**: Version tracking table supporting zero-downtime model cutovers and rollback.
4. **`vector_store_service.py`**: Storage abstraction enabling instant switching between pgvector and external vector databases.

---

## 🧪 Testing

The backend includes an asynchronous testing suite utilizing `pytest`, `pytest-asyncio`, `httpx`, and in-memory SQLite fixtures.

To execute tests:
```bash
cd vyapari-backend
pytest app/tests/ -v
```

---

## 🤝 Contributing & Development Guidelines

1. **Code Style**:
   - Python: Follow PEP 8 with explicit type hints and Ruff/Black standards.
   - TypeScript/React: Next.js App Router conventions with explicit interfaces.
2. **Design Integrity**: Always use CSS Custom Properties declared in `app/globals.css` instead of hardcoded hex colors.
3. **Database Integrity**: Never modify models without generating a matching Alembic migration (`alembic revision --autogenerate -m "description"`).

---

## 📄 License

Vyapari is released under the **MIT License**.
