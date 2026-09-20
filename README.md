# Vyapari — Autonomous E-Commerce Operations & Personalization Platform

Vyapari is a production-grade, multi-role autonomous e-commerce platform benchmarked against Amazon, Flipkart, and Shopify. Built with a dual-AI microservice architecture, it combines real-time pgvector dense semantic search with agentic generative AI seller copilots, resilient transaction concurrency, and an intuitive multi-device responsive interface.

---

## 1. System Architecture

Vyapari is orchestrated as a 6-tier containerized ecosystem coordinated via Docker Compose:

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
                                  │    Backend Core (Node.js) │
                                  │    Express API Gateway    │
                                  └──────┬──────┬──────┬──────┘
                                         │      │      │
                ┌────────────────────────┘      │      └────────────────────────┐
                ▼ (Port 8001)                   ▼ (Port 5432)                   ▼ (Port 8002)
    ┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
    │ Service-Recommendation│       │   PostgreSQL 16 DB    │       │ Service-Seller-Agent  │
    │ Python / FastAPI      │──────▶│   pgvector (384-dim)  │◀──────│ Python / FastAPI      │
    │ (all-MiniLM-L6-v2)    │       │   + Redis 7 (Cache)   │       │ (Google Gemini RAG)   │
    └───────────────────────┘       └───────────────────────┘       └───────────────────────┘
```

### Component Responsibilities

| Service | Technology | Port | Responsibilities |
|---|---|---|---|
| **Frontend** | React 18, Vite, Lucide Icons, Vanilla CSS | `3000` | Multi-role UI/UX (Customer, Seller, Admin), responsive 3-column PDP, search autocomplete popover, mobile sticky bottom purchase bar, sliding faceted drawer. |
| **Backend Core** | Node.js, Express, `pg` Pool, JWT | `8000` | API Gateway, role authorization, ACID transaction management with `SELECT ... FOR UPDATE`, Natural Language Query parser, Razorpay simulated checkout. |
| **Recommendation Service** | Python 3.11, FastAPI, SentenceTransformers | `8001` | Dense vector embeddings generation via `all-MiniLM-L6-v2` (384-dim), pgvector cosine similarity search (`1 - (pe.embedding <=> $1::vector)`), personalized recommendations. |
| **Seller Agent Service** | Python 3.11, FastAPI, Google Gemini | `8002` | Automated listing generation, inventory velocity advisory, merchant copilot chat, Support RAG policy retrieval. |
| **Database** | PostgreSQL 16 + pgvector v0.8.6 | `5432` | Relational tables, HNSW vector indexes (`vector_cosine_ops`), audit trails, order state machines, review reply threads. |
| **Cache** | Redis 7 Alpine | `6379` | Session caching, vector lookup acceleration, search debounce caching. |

---

## 2. Core Functional Capabilities

### A. Customer Journey & Catalog Discovery
- **Real-Time Autocomplete Popover (`/api/products/suggest`):**
  - Debounced (220ms) instant dropdown beneath search inputs on all viewports.
  - Displays product matches with image thumbnails, titles, brand/category tags, INR pricing, and gold star rating pills.
  - Dynamic discovery badges for matching brands (with item count) and categories.
  - Keyboard accessible (Escape dismisses, click-outside closes, clear button).
- **Natural Language Query (NLQ) Search Engine:**
  - Ingests free-form conversational queries (e.g., *"noise cancelling headphones under 10000 with fast delivery"*).
  - Automatically parses price bounds (`price <= 10000`), quality intents (`min_rating = 4.0`), delivery constraints (`next_day = true`), and catalog brand mentions.
  - Combines SQL constraints with pgvector 384-dimensional cosine similarity search into a hybrid match score.
  - Displays an **AI Intelligence Banner** detailing extracted semantics and active filter pills.
- **Faceted Product Catalog (`/explore`):**
  - Left-hand sticky sidebar with brand checkboxes, price range presets, custom Min/Max inputs, 4★ & up customer rating filters, discount tags, and next-day delivery toggles.
- **3-Column Amazon / Flipkart Standard PDP (`/products/:id`):**
  - **Column 1:** Multi-image gallery with vertical thumbnail strip and hover staging view.
  - **Column 2:** Brand authorized badge, full title, review ratings, savings breakdown, interactive bank offers & EMI widget, bulleted feature highlights, and technical specifications table.
  - **Column 3:** Sticky Buy Box with 6-digit Pincode Delivery Estimator, live stock status, quantity picker, 256-bit SSL trust badge, and return policies.
  - **Mobile Experience (<768px):** Clean single-column stack with a **Fixed Bottom Purchase Bar** pinned to the bottom of the viewport for instant checkout.
- **Customer Reviews & Official Seller Reply Threads:**
  - Public reviews displaying reviewer name, star rating, review headline, detailed comment, verified purchase badge, and helpful counter.
  - Official seller reply boxes nested under reviews (`seller_reply`, `seller_reply_at`, store name, verified brand tag).
- **Account Operations:**
  - Wishlist management with instant optimistic heart toggles.
  - Address Book with multiple delivery addresses and default shipping assignment.
  - Notification Center for order milestones and platform announcements.
  - Order tracking timeline with live order status (`pending`, `confirmed`, `shipped`, `delivered`).

### B. Seller Operations Console (`/seller/*`)
- **4-Step Regulatory KYC Onboarding (`/seller/onboarding`):**
  - Step 1: Business Profile & Brand Information.
  - Step 2: Tax & Regulatory Identifiers (PAN & GSTIN validation).
  - Step 3: Bank Settlement Coordinates (Account number, IFSC, Holder name).
  - Step 4: Primary Category Selection & Regulatory Declaration.
  - Real-time role elevation upon submission.
- **Inventory Velocity Forecasting (`/seller/inventory`):**
  - Computes 30-day sales velocity, estimated days of stock runway, and automatic stockout risk alert pills.
- **AI Listing Studio (`/seller/ai-listing`):**
  - Generates SEO-optimized descriptions, bullet highlights, and computes 384-dim dense embeddings directly into pgvector.
- **Seller Reviews Desk (`/seller/reviews`):**
  - Audit buyer feedback across entire store catalog, filter unanswered reviews, and publish official merchant responses.
- **Order Fulfillment Desk (`/seller/orders`):**
  - View buyer delivery snapshots, update fulfillment statuses, and assign courier providers (Blue Dart, Delhivery, DTDC) with AWB tracking numbers.
- **Support RAG Policy Desk (`/seller/settings`):**
  - Markdown editor for Return and Shipping policies, indexed for semantic RAG retrieval.

### C. Admin Governance Desk (`/admin/*`)
- **Platform Executive Overview (`/admin`):**
  - Live GMV metrics, gross transaction volumes, active merchant count, shopper registrations.
- **User Governance (`/admin/users`):**
  - Cross-platform user index with role-based filters and instant suspension/reactivation toggles.
- **Merchant KYC Verification Desk (`/admin/sellers`):**
  - Verification review workflow for merchant PAN, GSTIN, and settlement bank credentials.
- **Catalog Governance (`/admin/products`):**
  - Platform-wide catalog audit with compliance force-archive controls.
- **System & AI Diagnostics (`/admin/system`):**
  - Live PostgreSQL connection latency, pgvector extension verification, Redis cache health, and vector embedding coverage gauge with resync triggers.

---

## 3. Demo Credentials Reference

All demo accounts use password: `Password@123`

| Role | Email | Entity / Name | Focus Areas |
|---|---|---|---|
| **Customer** | `customer1@vyapari.com` | Aarav Sharma | NLQ search, autocomplete, 3-column PDP, wishlist, checkout, review submission |
| **Customer** | `customer2@vyapari.com` | Priya Patel | Multi-item cart, order status tracking, address management |
| **Seller** | `seller1@vyapari.com` | Rohan Mehra (*Aura Living India*) | Home & Lifestyle catalog, inventory forecasting, reviews desk |
| **Seller** | `seller2@vyapari.com` | Ananya Singhania (*Volt Tech Studio*) | Audio & Electronics catalog, order fulfillment, AI listing studio |
| **Seller** | `seller3@vyapari.com` | Vikramaditya Joshi (*AyurVeda Essentials*) | Wellness catalog, store settings, support RAG policies |
| **Admin** | `admin@vyapari.com` | Vyapari Admin | Merchant KYC approvals, platform diagnostics, user governance |

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

### 2. Launch All Services
```bash
docker compose up --build
```

### 3. Service Access Endpoints
- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **Backend Core API Health**: [http://localhost:8000/health](http://localhost:8000/health)
- **Recommendation Service Health**: [http://localhost:8001/health](http://localhost:8001/health)
- **Seller Agent Service Health**: [http://localhost:8002/health](http://localhost:8002/health)

---

## 5. Local Development (Without Docker)

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 16 with pgvector extension enabled
- Redis 7+

### 1. Database Initialization
```bash
# Connect to local PostgreSQL instance
psql -U postgres -d vyapari -f db/init.sql
psql -U postgres -d vyapari -f db/seed.sql
```

### 2. Backend Core Gateway
```bash
cd backend-core
npm install
npm run dev
```
Runs on `http://localhost:8000`.

### 3. Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:3000`.

### 4. Recommendation Microservice
```bash
cd service-recommendation
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

### 5. Seller Agent Microservice
```bash
cd service-seller-agent
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload
```

---

## 6. Automated Testing

### Backend Unit & Security Tests
```bash
cd backend-core
npm test
```
Validates JWT authentication, bearer token extraction, and role authorization guards.

### Frontend Build Validation
```bash
cd frontend
npm run build
```
Validates zero JSX/CSS compile errors and builds production bundle assets.

---

## 7. Documentation Inventory

| Document | Purpose |
|---|---|
| [README.md](file:///c:/Users/gungu/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform/README.md) | Platform overview, system architecture, quickstart instructions, and credentials. |
| [product_bible.md](file:///c:/Users/gungu/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform/product_bible.md) | Authoritative 80KB UX specification, user journeys, edge-case contracts, and API schemas. |
| [DESIGN.md](file:///c:/Users/gungu/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform/DESIGN.md) | Design system tokens, color palettes, typography scales, and responsive layout rules. |
| [walkthrough.md](file:///c:/Users/gungu/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform/walkthrough.md) | Comprehensive implementation walkthrough, verification test outputs, and feature audits. |
