**VYAPARI**

**_The Smart Merchant_**

Autonomous E-Commerce Operations & Personalization Platform

**Technical Requirements & System Design Document** *(Improved v1.1)*

| Document Version | v1.1 — MVP Release (Revised) |
| --- | --- |
| Document Type | Technical Requirements Specification |
| Project | B.Tech Final Year Major Project — PSIT Kanpur |
| Domain | AI/ML · NLP · Web Application |
| Last Updated | 2024 |

_This document is a living specification. Fill in your name, roll number, and team details before submission._

---

# 1. Executive Summary

Vyapari (Hindi: व्यापारी — Merchant) is a three-module agentic AI platform for e-commerce operations. It simultaneously addresses two persistent problems in digital retail: (1) customers receive generic, uninspired product recommendations that fail to reflect individual intent, and (2) store operations — inventory management, competitive pricing, and customer review engagement — remain reactive, manual, and unscalable.

Vyapari resolves both through a unified architecture. Three specialized AI agents run continuously in the background: a Recommendation Engine that personalises the shopping experience in real time, an Inventory & Pricing Agent that monitors stock health and competitor prices, and a Review Response Agent that classifies sentiment and drafts contextual customer replies. Every agent decision is surfaced through a Human-in-the-Loop (HITL) dashboard before execution, ensuring operator control is never compromised.

This document specifies the complete technical requirements for three user-facing surfaces: the Customer Dashboard (shopping experience), the Seller Dashboard (store management), and the HITL Operations Dashboard (agent oversight), as well as the backend architecture, data models, security requirements, and evaluation metrics.

---

# 2. System Overview

## 2.1 Architecture Layers

The system is composed of five distinct layers that communicate through a shared event bus and central data store.

| Layer | Components | Technology |
| --- | --- | --- |
| Presentation Layer | Customer UI, Seller Dashboard, HITL Dashboard | React 18 + Vite + Tailwind CSS |
| API Gateway | REST endpoints, CORS, auth middleware | FastAPI (Python 3.10+) |
| Intelligence Core | Recommendation engine, agent loop runners | scikit-surprise, HuggingFace Transformers |
| Data Layer | Products, users, ratings, reviews, decisions | SQLite (dev) / PostgreSQL (production) |
| Integration Layer | LLM API for response generation | OpenAI GPT-3.5-turbo / template fallback |

## 2.2 Three User Surfaces

| Surface | Primary User & Purpose |
| --- | --- |
| Customer Dashboard | End customer — browse, search, view personalised recommendations, leave reviews |
| Seller Dashboard | Store owner/manager — view inventory, monitor sales, manage products and pricing |
| HITL Operations Dashboard | Operator/AI supervisor — review and approve all autonomous agent decisions |

## 2.3 Agent Decision Flow: Three Tiers

Every autonomous action follows a three-tier decision model based on **confidence score** and **action risk level**:

| Decision Tier | Confidence Score | Risk Level | Behavior | Example |
| --- | --- | --- | --- | --- |
| **Autonomous Mode** | ≥ 0.85 | LOW | Agent acts immediately, logs decision to audit trail, executes. No human approval needed. | Restock alert for fast-moving commodity (500 units); confidence 0.92 |
| **Advisory Mode** | 0.60–0.84 | MEDIUM | Agent proposes action with draft (if applicable), queues in HITL dashboard for human review. Waits for approval before execution. | Price adjustment of 8% based on competitor drift; confidence 0.78 |
| **Escalation Mode** | < 0.60 | HIGH | Agent escalates to human immediately. No draft generated. Full context provided. Manual handling required. | 1-star review containing legal keywords (refund, lawsuit); confidence 0.45. Escalated with original review + metadata. |

**Risk Level Definitions**:
- **LOW**: Fast-moving inventory restock, non-breaking changes to metadata
- **MEDIUM**: Pricing changes 5–15%, new product categories, review responses
- **HIGH**: Pricing changes > 15%, reviews with negative legal/brand keywords, inventory below safety threshold

---

# 3. Customer Dashboard — Technical Requirements

The Customer Dashboard is the public-facing storefront. Its primary goals are product discovery, personalised recommendations, and seamless review submission. All pages must be responsive and load within 2 seconds on a standard connection.

## 3.1 Pages & Routes

| Route | Page Name | Purpose |
| --- | --- | --- |
| / | Home / Landing | Hero section, featured categories, personalised recommendation strip |
| /shop | Product Catalogue | Full product listing with filters and sort |
| /search?q= | Search Results | Semantic search results with relevance scores |
| /product/:id | Product Detail | Full product page with reviews, related items |
| /cart | Shopping Cart | Cart items, quantities, subtotal |
| /account | Customer Account | Order history, wishlist, preferences |
| /reviews/:product_id | Submit Review | Star rating + text review submission form |

## 3.2 Authentication & Session Management (REVISED)

### 3.2.1 Customer Authentication Model

**Anonymous Browsing**: Customers can browse products, search, and view recommendations **without login**.

**Authenticated Recommendations**: 
- Anonymous users receive **popularity-based recommendations** (top-rated products globally)
- Registered users receive **personalized recommendations** via SVD collaborative filtering

**Session Persistence**:
- Cart stored in browser localStorage (survives refresh, lost on browser clear)
- Session ID stored in httpOnly cookie; expires after 30 days of inactivity
- User preferences (display language, sort defaults) stored in browser sessionStorage

**Optional Login Prompt**: 
- Show login prompt after 2+ reviews submitted (to enable personalized recommendations)
- "Create account to see better recommendations" CTA on Home page recommendation strip

---

## 3.3 Recommendation Engine — Frontend Requirements

**3.3.1 Personalised Recommendation Strip**

*   Displayed on the Home page and Product Detail page
*   Fetches from GET /recommendations/{session_id}?top_n=6
*   Must display: product image, product name, category badge, price, stock status
*   Badge indicates recommendation source: 'For You' (SVD), 'Popular' (fallback), 'Similar' (content-based)
*   If user is not logged in or has < 3 ratings, display top-rated products by default (sorted by average rating descending, filtered to products with ≥ 10 reviews)
*   Horizontal scroll on mobile, grid on desktop
*   Loading state: skeleton cards

**3.3.2 Semantic Search Bar**

*   Present on all pages via top navigation
*   Accepts natural language queries — minimum 2 characters before firing request
*   Calls GET /search?q={query}&top_n=8
*   Debounce: 400ms after last keystroke before API call (adaptive: 600ms on 4G/3G networks)
*   Results page shows: product cards + 'Search matched because...' tooltip on hover
*   If zero results returned, show: 'No matches found. Showing popular items instead.'

---

## 3.4 Product Catalogue — Frontend Requirements

**3.4.1 Filters Panel**

*   Category filter: multi-select checkboxes (Electronics, Clothing, Books, Home & Kitchen, Sports)
*   Price range: dual-handle slider, min ₹0 to max ₹9999
*   Stock filter: 'In Stock Only' toggle
*   Sort: Relevance, Price Low→High, Price High→Low, Newest, Top Rated
*   All filters apply client-side on current result set (no full page reload)

**3.4.2 Product Card**

*   Fields: product image (placeholder), name, category, price in ₹, stock indicator
*   Stock indicator colour: green (> 20), orange (5–20), red (< 5 — 'Low Stock' label)
*   Quick Add to Cart button visible on hover
*   Clicking card navigates to /product/:id

---

## 3.5 Review Submission — Frontend Requirements

*   Accessible from Product Detail page
*   Fields: star rating (1–5, click-to-select), review text (min 10 chars, max 500 chars)
*   Character counter displayed below textarea
*   On submit: POST /reviews with { product_id, user_id, stars, text }
*   Success state: 'Thank you! Your review is under moderation. Response expected within 24 hours.'
*   Reviews section on Product Detail shows: star rating, review text, sentiment badge (after processing), published response (if any), response publication date

---

## 3.6 Customer Dashboard — API Contracts (REVISED)

| Endpoint | Method | Request | Response | Status Codes |
| --- | --- | --- | --- | --- |
| GET /products | GET | ?category, sort, in_stock | { products: [...] } | 200, 400 |
| GET /products/:id | GET | — | { product: {...} } | 200, 404 |
| GET /recommendations/:session_id | GET | ?top_n=6 | { recommendations: [...] } | 200, 400 |
| GET /search | GET | ?q=string&top_n=8 | { results: [...], total: int } | 200, 400 |
| POST /reviews | POST | { product_id, user_id, stars, text } | { id: string, status: 'pending' } | 201, 400, 422 |
| GET /cart | GET | (session cookie) | { items: [...], total: float } | 200 |
| POST /cart/add | POST | { product_id, qty } | { items: [...], total: float } | 200, 400 |

---

## 3.7 API Response Schemas (NEW)

### GET /products Response
```json
{
  "products": [
    {
      "id": "PRD_001",
      "name": "Wireless Headphones",
      "category": "Electronics",
      "price": 1499.99,
      "stock": 25,
      "avg_rating": 4.2,
      "review_count": 45,
      "image_url": "/images/products/PRD_001.jpg"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 20
}
```

### GET /recommendations Response
```json
{
  "recommendations": [
    {
      "product_id": "PRD_042",
      "name": "Running Shoes",
      "price": 2999,
      "source": "SVD",
      "confidence": 0.87,
      "image_url": "/images/products/PRD_042.jpg"
    }
  ],
  "generated_at": "2024-01-15T10:30:00Z"
}
```

### POST /reviews Response
```json
{
  "id": "REV_1024",
  "product_id": "PRD_001",
  "user_id": "USR_567",
  "stars": 5,
  "text": "Excellent product!",
  "status": "pending",
  "created_at": "2024-01-15T10:35:00Z"
}
```

---

## 3.8 Customer Dashboard — Non-Functional Requirements

| Requirement | Target |
| --- | --- |
| Page load time (initial) | < 2 seconds on 10 Mbps connection |
| Recommendation API response | < 800ms p95 |
| Search debounce | 400ms — prevents excessive API calls |
| Mobile responsiveness | All pages functional on 375px viewport width |
| Accessibility | WCAG 2.1 Level AA: alt text, keyboard navigation, contrast ratio ≥ 4.5:1 |
| Session persistence | Cart and user preferences persist across browser refresh (localStorage) |
| Concurrent users supported | 100 users without performance degradation |
| Error recovery | All failed API calls retry with exponential backoff (max 3 attempts) |

---

# 4. Seller Dashboard — Technical Requirements

The Seller Dashboard is the store management interface for the business owner or store manager. It provides visibility into all operational data — inventory health, pricing status, revenue trends, and customer sentiment — and exposes controls to update products, trigger agent scans, and view decision history.

## 4.1 Pages & Routes

| Route | Page Name | Purpose |
| --- | --- | --- |
| /seller | Overview | Summary stats, alert strip, quick-action buttons |
| /seller/inventory | Inventory Management | Full product table with health status and edit controls |
| /seller/pricing | Pricing Monitor | Competitor price comparison table with suggested adjustments |
| /seller/reviews | Review Manager | All reviews with sentiment, draft responses, publish controls |
| /seller/analytics | Analytics | Sales velocity charts, revenue trends, category breakdown |
| /seller/products/add | Add Product | Form to add a new product to the catalogue |
| /seller/products/:id/edit | Edit Product | Edit price, stock, name, category for existing product |

## 4.2 Overview Page

**4.2.1 KPI Strip (top of page)**

*   6 stat cards displayed horizontally: Total Products, Critical Stock Items, Stock Warning Items, Pending Agent Decisions, Pending Reviews, Escalated Reviews
*   Critical Stock card: red accent border, click navigates to /seller/inventory?filter=critical
*   Pending Decisions card: blue accent border, click navigates to HITL dashboard
*   All values fetched from GET /stats on page load and auto-refreshed every 60 seconds

**4.2.2 Alert Strip**

*   Horizontal scrolling list of unresolved alerts below KPI strip
*   Alert types: LOW_STOCK (red), PRICE_DRIFT (yellow), ESCALATED_REVIEW (red), AGENT_ERROR (orange)
*   Each alert card: icon, product name, short description, 'View' button linking to relevant page
*   Alerts persist until the underlying decision is resolved

**4.2.3 Quick Actions**

*   'Run Inventory Scan' button: triggers POST /inventory/scan, shows spinner while running, refreshes stats on completion
*   'Process Reviews' button: triggers POST /reviews/process, shows progress indicator
*   'Add Product' button: navigates to /seller/products/add

---

## 4.3 Inventory Management Page

**4.3.1 Product Table**

*   Columns: Product ID, Name, Category, Price (₹), Cost (₹), Stock, Avg Sales/Day, Days of Stock Remaining, Status
*   Status badge: CRITICAL (red), WARNING (yellow), OK (green) — colour coded
*   Sortable by any column header click
*   Filter tabs above table: All | Critical | Warning | OK
*   Search bar: filter rows by product name in real time (client-side)

**4.3.2 Inline Edit**

*   Clicking Price or Stock cell opens an inline edit input
*   Enter key or blur commits the change via PATCH /products/:id
*   Changed value highlighted in yellow for 2 seconds after save
*   Invalid values (negative stock, price below cost minimum) show inline error and reject the update

**4.3.3 Bulk Actions**

*   Multi-select via checkboxes in first column
*   Bulk actions: Export selected to CSV, Trigger scan for selected products

---

# 5. HITL Operations Dashboard (REVISED)

## 5.1 Pages & Routes

| Route | Page Name | Purpose |
| --- | --- | --- |
| /hitl | Decision Queue | All pending decisions awaiting human approval, sorted by timestamp desc |
| /hitl/:decision_id | Decision Detail | Full context for one decision, approval/rejection controls |
| /hitl/history | Decision History | All historical decisions (approved, rejected, auto-executed) with audit trail |
| /hitl/analytics | Agent Performance | Metrics: approval rate, rejection rate, escalation rate, avg processing time |

## 5.2 Decision Queue Page

**5.2.1 Queue Table**

*   Columns: Decision ID, Type (RESTOCK/PRICING/REVIEW), Product, Agent Confidence, Risk Level, Proposed Action, Created At
*   Rows color-coded by risk level: RED (HIGH), YELLOW (MEDIUM), GREEN (LOW / auto-executed)
*   Auto-executed decisions shown in gray (display only, not actionable)
*   Sort by: Timestamp (default), Confidence (ascending), Risk Level
*   Filter by: Type, Status (Pending, Approved, Rejected, Auto-Executed), Risk Level

**5.2.2 Bulk Approval**

*   Checkbox per row to select decisions
*   "Approve Selected" button appears when ≥1 decision selected
*   Confirmation modal: "Approve X decisions?" with list of affected products
*   On approval: each decision record marked APPROVED, timestamp added, returns to queue showing "✓ Approved" status

**5.2.3 Rejection Workflow**

*   "Reject" button per row
*   Modal opens: "Reason for rejection" (dropdown: insufficient data, business rule conflict, incorrect product, other + free text)
*   On rejection: decision marked REJECTED, reason logged, agent is not re-triggered for same product until conditions change

---

## 5.3 Decision Detail Page

Shows full context for a single decision:

*   **Decision Metadata**: ID, Type, Status, Created At, Agent Confidence Score
*   **Context**: Product details (ID, name, category, current price/stock), Previous decisions for same product (if any)
*   **Agent Analysis**: 
  - For RESTOCK: current stock, avg daily sales, days remaining, suggested restock quantity
  - For PRICING: current price, competitor price, diff %, suggested price, margin check
  - For REVIEW: review text, detected sentiment, suggested response
*   **Action Buttons**: Approve, Reject (with modal), View Audit Trail
*   **Audit Trail Link**: Click to see all related decisions for this product

---

## 5.4 HITL Dashboard — API Contracts (NEW)

| Endpoint | Method | Request | Response | Status Codes |
| --- | --- | --- | --- | --- |
| GET /hitl/decisions | GET | ?status=pending&type=RESTOCK | { decisions: [...], total: int } | 200, 401 |
| GET /hitl/decisions/:id | GET | — | { decision: {...} } | 200, 401, 404 |
| POST /hitl/decisions/:id/approve | POST | { approver_id } | { decision: {...}, approved_at: timestamp } | 200, 400, 401 |
| POST /hitl/decisions/:id/reject | POST | { reason: string, approver_id } | { decision: {...}, rejected_at: timestamp } | 200, 400, 401 |
| GET /hitl/analytics | GET | ?start_date, end_date | { approval_rate: %, rejection_rate: %, avg_wait_time_ms: int } | 200, 401 |

---

# 6. Error Handling & HTTP Status Codes (NEW)

## 6.1 Standard Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Price must be greater than cost",
    "details": [
      {
        "field": "price",
        "issue": "value (500) is below cost (600)"
      }
    ],
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

## 6.2 HTTP Status Code Mapping

| Code | Scenario | Example |
| --- | --- | --- |
| 200 | Successful GET or retrieval | GET /products returns product list |
| 201 | Resource created successfully | POST /reviews returns new review ID |
| 400 | Bad request (client error) | Missing required field, invalid query param |
| 401 | Unauthorized (missing/invalid token) | Seller dashboard accessed without JWT |
| 403 | Forbidden (insufficient permissions) | User tries to approve decision without HITL role |
| 404 | Resource not found | GET /products/INVALID_ID |
| 422 | Validation error (semantic) | Price < cost, negative stock |
| 429 | Rate limit exceeded | > 100 requests/min from single IP |
| 500 | Server error | Unexpected exception in agent logic |
| 503 | Service unavailable | Database connection failure, LLM API down |

## 6.3 Rate Limiting Headers

All responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705319700 (Unix timestamp)
```

When rate limit exceeded (429):
```
Retry-After: 60 (seconds)
```

---

# 7. Data Models & Database Schema (NEW)

## 7.1 Core Tables

### users
```
user_id (PK)          | UUID
email                 | VARCHAR (unique, nullable for anonymous)
name                  | VARCHAR
account_type          | ENUM: customer | seller | admin
created_at            | TIMESTAMP
last_login            | TIMESTAMP
is_active             | BOOLEAN
```

### products
```
product_id (PK)       | VARCHAR (e.g., 'PRD_001')
seller_id (FK)        | UUID (which seller owns this product)
name                  | VARCHAR (required)
category              | ENUM: Electronics | Clothing | Books | Home_Kitchen | Sports
description           | TEXT
price                 | DECIMAL (10,2)
cost                  | DECIMAL (10,2)
stock                 | INTEGER (>= 0)
sku                   | VARCHAR (unique)
image_url             | VARCHAR
created_at            | TIMESTAMP
updated_at            | TIMESTAMP
INDEX: (seller_id, category)
```

### ratings
```
rating_id (PK)        | UUID
user_id (FK)          | UUID
product_id (FK)       | VARCHAR
rating                | INTEGER (1-5)
created_at            | TIMESTAMP
INDEX: (user_id, product_id) — for collaborative filtering
```

### reviews
```
review_id (PK)        | VARCHAR (e.g., 'REV_1024')
product_id (FK)       | VARCHAR
user_id (FK)          | UUID
stars                 | INTEGER (1-5)
text                  | TEXT (min 10, max 500 chars)
sentiment             | ENUM: POSITIVE | NEGATIVE | NEUTRAL (null until processed)
status                | ENUM: pending | approved | rejected
agent_response        | TEXT (null until generated)
agent_response_status | ENUM: draft | published | rejected (null until processed)
response_published_at | TIMESTAMP (null if not published)
created_at            | TIMESTAMP
processed_at          | TIMESTAMP
INDEX: (product_id, status)
```

### decisions (Audit Log)
```
decision_id (PK)      | VARCHAR (e.g., 'DEC_1005')
agent_type            | ENUM: RECOMMENDATION | INVENTORY | PRICING | REVIEW_RESPONSE
product_id (FK)       | VARCHAR
decision_type         | ENUM: RESTOCK | PRICE_ADJUST | REVIEW_DRAFT
proposed_action       | JSONB (full action payload)
confidence_score      | FLOAT (0.0-1.0)
risk_level            | ENUM: LOW | MEDIUM | HIGH
decision_status       | ENUM: pending | approved | rejected | auto_executed
approver_id (FK)      | UUID (null if auto_executed)
approval_reason       | TEXT (null if rejected, contains reason)
created_at            | TIMESTAMP
updated_at            | TIMESTAMP
INDEX: (decision_status, created_at DESC)
INDEX: (product_id, decision_type)
```

---

# 8. Security Requirements (REVISED)

| Requirement | Implementation |
| --- | --- |
| Authentication | JWT-based auth for Seller and HITL dashboards. Customer dashboard supports anonymous browsing + optional auth for better recommendations. |
| JWT Token Life | Access token: 1 hour. Refresh token: 30 days. Stored in httpOnly cookie. |
| CORS | Allowed origins: localhost:5173 (dev), production domain only. No wildcard. |
| Input Validation | All POST/PATCH bodies validated via Pydantic models in FastAPI — reject malformed input with HTTP 422 |
| Price Guardrail Enforcement | Backend enforces minimum price rule: price ≥ cost × 1.10. Frontend can suggest but backend rejects if violated. |
| Sensitive Config | OPENAI_API_KEY, DB credentials, JWT_SECRET stored in .env file — never committed to Git. Use environment variables in production. |
| Audit Log Integrity | Decision records INSERT-only — no UPDATE or DELETE on resolved records. All changes immutable once status != 'pending'. |
| Rate Limiting | 100 requests/min per IP for GET endpoints; 50 requests/min per IP for POST endpoints. POST /inventory/scan limited to 10 calls/hour per IP. |
| Password Hashing | Seller/admin passwords hashed with bcrypt (min cost factor 12) before storage. |
| SQL Injection | All queries use parameterized statements (SQLAlchemy ORM prevents SQL injection). |
| XSS Protection | React automatically escapes JSX content. Content Security Policy header: `default-src 'self'` |

---

# 9. Monitoring & Observability (NEW)

## 9.1 Logging

All application logs follow this JSON structure:

```json
{
  "timestamp": "2024-01-15T10:35:00Z",
  "level": "INFO|WARNING|ERROR",
  "service": "recommendation-engine",
  "request_id": "req_12345",
  "user_id": "usr_789",
  "event": "recommendation_generated",
  "details": {
    "product_id": "PRD_042",
    "confidence": 0.87,
    "processing_time_ms": 145
  }
}
```

**Log Retention**: 30 days in production.

## 9.2 Key Metrics

| Metric | Target | Tool |
| --- | --- | --- |
| Recommendation API p95 latency | < 800ms | FastAPI middleware timer |
| SVD model inference time | < 200ms | Agent performance logger |
| Review sentiment classification latency | < 100ms | DistilBERT timing logs |
| Decision queue processing time (p95) | < 500ms | HITL dashboard logs |
| Approval rate (% of decisions approved) | > 85% | Decision audit log |
| Error rate (5xx responses) | < 0.5% | FastAPI error tracking |
| SVD model NDCG@10 (weekly evaluation) | ≥ 0.65 | Batch evaluation script |

## 9.3 Alerts

| Alert | Threshold | Action |
| --- | --- | --- |
| High error rate | > 1% errors in 5 min window | Page on-call engineer |
| Recommendation latency | p95 > 1500ms | Investigate cache hit rate |
| Decision queue backup | > 50 pending decisions | Auto-escalate to senior operator |
| Model inference failure | > 3 failures in 10 min | Fallback to rule-based mode, alert team |
| Database connection pool exhausted | Connection failures | Page database administrator |

---

# 10. Testing Strategy (NEW)

## 10.1 Unit Testing

- **Coverage Target**: 80%+ for core modules (recommendation engine, inventory agent, sentiment classifier)
- **Framework**: pytest for Python; Jest for React
- **Test Data**: Fixtures for 500 products, 1000 users, 5000 ratings

## 10.2 Integration Testing

| Test Suite | Scope | Target |
| --- | --- | --- |
| API Contract Tests | All endpoints return correct JSON schema | 28 endpoints × 3 scenarios each = 84 tests |
| End-to-End Dashboard Flow | Customer browse → review → submit; Seller inventory update → scan | 10 scenarios |
| HITL Approval Workflow | Decision queue → detail → approve/reject → audit log updated | 6 scenarios |
| Agent Integration | Recommendation engine loads model, inventory agent triggers scan, review agent processes sentiment | 3 scenarios |

## 10.3 Load Testing

- **Tool**: Apache JMeter or Locust
- **Scenario**: 100 concurrent users, 60-second ramp-up
- **Targets**:
  - GET /products: 50 req/sec sustained, p99 < 1.5s
  - GET /recommendations: 30 req/sec sustained, p99 < 1.2s
  - POST /reviews: 10 req/sec sustained, p99 < 800ms

## 10.4 Smoke Test Suite

Run after every deployment:
- Can GET /products?
- Can GET /recommendations?
- Can POST /reviews?
- Can GET /seller/inventory (requires JWT)?
- Can GET /hitl/decisions (requires JWT)?

---

# 11. Deployment & DevOps (NEW)

## 11.1 Containerization

**Docker Image Strategy**:
- Single backend image: Python 3.10 slim base, HuggingFace models baked in (~2GB), FastAPI server
- Frontend image: Node 18 base, React build output, nginx reverse proxy

**docker-compose.yml** includes:
- backend service (port 8000)
- frontend service (port 3000, proxies to backend)
- postgres database (port 5432)
- redis cache (port 6379, optional)

## 11.2 Environment Promotion

| Environment | Database | OPENAI_API_KEY | Debug Mode | CORS Origins |
| --- | --- | --- | --- | --- |
| Development | SQLite (local) | Optional | True | localhost:5173 |
| Staging | PostgreSQL (test data) | Test key | False | staging.vyapari.com |
| Production | PostgreSQL (live) | Live key | False | vyapari.com |

## 11.3 Database Migrations

- **Tool**: Alembic (Python SQL migration tool)
- **Workflow**: Each schema change committed as migration file (e.g., `001_create_users_table.py`)
- **On Deploy**: `alembic upgrade head` runs before server startup

## 11.4 Secrets Management

- **Development**: Store in `.env` file (not committed)
- **Production**: Use environment variables set by deployment platform (GitHub Actions, Cloud Run, etc.)
- **Keys to Manage**: OPENAI_API_KEY, JWT_SECRET, DATABASE_URL, POSTGRES_PASSWORD

---

# 12. Model Data Sources & Fallbacks

## 12.1 Recommendation Model (SVD)

**Training Data Source**:
- ratings table (user × product × rating history)
- Retrains every 24 hours or on-demand
- Uses 80% of data for training, 20% for evaluation

**Fallback Chain**:
1. SVD model (confidence > 0.60)
2. Content-based: products in same category with top ratings
3. Popularity: all-time top-rated products globally

---

## 12.2 Sentiment Classifier (DistilBERT)

**Model Source**: Hugging Face Hub - `distilbert-base-uncased-finetuned-sst-2-english`

**Fallback Chain**:
1. DistilBERT (model loads, inference succeeds)
2. Rule-based keyword matching if model fails to load (e.g., out of memory):
   - **Positive**: great, amazing, excellent, love, perfect, wonderful, outstanding
   - **Negative**: terrible, broken, waste, disappointed, poor, awful, useless
   - **Neutral**: all others

---

## 12.3 Competitor Price Feed

**MVP Implementation** (for non-real-time pricing):
- Mock JSON file: `/data/competitor_prices.json`
- Format:
```json
{
  "PRD_001": {
    "competitor_a": 1299,
    "competitor_b": 1349,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```
- Updated manually or via scheduled job

**Future Upgrade**: Replace with Playwright-based web scraper

---

# 13. Evaluation Metrics & Success Criteria

| Metric | Baseline | MVP Target | Measurement Method |
| --- | --- | --- | --- |
| Recommendation NDCG@10 | ~0.50 (popularity ranking) | ≥ 0.65 | Evaluation on 20% held-out ratings |
| Recommendation Precision@10 | ~12% | ≥ 20% | Held-out test set |
| Sentiment F1 Score | N/A (zero-shot) | ≥ 88% on test set | Manually labelled 100-review test set |
| Restock Alert Accuracy (sim) | Threshold-only rule | ≥ 90% correct flags | Simulated stockout scenarios |
| Review Auto-Draft Coverage | 0% (all manual) | ≥ 75% of reviews | Percentage not escalated |
| Escalation Precision | N/A | ≥ 95% | Manual audit of 50 escalated reviews |
| Decision Queue Latency | N/A | < 500ms p95 | FastAPI response timing logs |
| Page Load Time (Customer Dashboard) | N/A | < 2 seconds | Lighthouse audit on 10 Mbps connection |
| Seller Dashboard Inventory Update | N/A | < 1 second (inline) | Browser DevTools timing |

---

# 14. Development Environment & Setup

## 14.1 Hardware Requirements

| Component | Minimum Specification |
| --- | --- |
| Processor | Intel Core i5 or AMD Ryzen 5, 2.5 GHz, quad-core |
| RAM | 8 GB (16 GB recommended for DistilBERT loading) |
| Storage | 20 GB free SSD space (includes DistilBERT ~500 MB, PostgreSQL data) |
| GPU | Not required. NVIDIA 4 GB VRAM optional for faster DistilBERT inference |
| Internet | Required for first-time model download (~500 MB HuggingFace) and optional OpenAI API calls |

## 14.2 Software Requirements

| Component | Version / Specification |
| --- | --- |
| Python | 3.10 or higher |
| Node.js | 18.0 or higher |
| FastAPI | 0.115.x |
| scikit-surprise | 1.1.4 |
| HuggingFace Transformers | 4.44.x |
| PyTorch | 2.4.x (CPU build acceptable) |
| React | 18.3.x |
| Vite | 5.4.x |
| Tailwind CSS | 3.4.x |
| Database (dev) | SQLite 3 (bundled with Python) |
| Database (production) | PostgreSQL 15+ |
| Operating System | Windows 10/11, Ubuntu 20.04+, or macOS 12+ |

## 14.3 Environment Variables

| Variable | Purpose | Required? |
| --- | --- | --- |
| OPENAI_API_KEY | GPT-3.5-turbo API access for review response generation | Optional (fallback to templates) |
| DATABASE_URL | PostgreSQL connection string (optional — defaults to SQLite) | Optional |
| VYAPARI_ENV | Environment: development \| production | Required |
| SECRET_KEY | JWT signing secret (use `openssl rand -hex 32` to generate) | Required |
| REVIEW_RESPONSE_MAX_WORDS | Max tokens for LLM response (default: 60) | Optional |

---

# 15. Known Limitations & Out-of-Scope for MVP

| Item | Status | Rationale |
| --- | --- | --- |
| Real payment gateway integration | Out of scope | Cart is display-only; order checkout not implemented |
| Real-time competitor price scraping | Out of scope | Simulated mock feed used; upgrade planned Q2 |
| Live streaming of sales events | Out of scope | Scheduled polling used instead of Kafka/Redis |
| Multi-tenant / multi-store support | Out of scope | Single seller instance only |
| Mobile native apps (iOS / Android) | Out of scope | Responsive web only |
| Advanced A/B testing framework | Out of scope | Manual testing only |
| Sentence-transformers vector search | Out of scope | Keyword search used for MVP |
| Customer authentication (login/register) | Out of scope | Anonymous + optional auth; full auth in v1.1 |

---

# 16. Future Roadmap

| Priority | Feature | Rationale | Timeline |
| --- | --- | --- | --- |
| **High** | Sentence-transformers semantic search | True NLP search beyond keyword matching — replaces current search module | Q2 2024 |
| **High** | Real competitor price scraping | Playwright-based scraper to replace mock price feed | Q2 2024 |
| **High** | Scheduled agent cron jobs | Automate agent runs without manual trigger (celery + Redis) | Q1 2024 |
| **Medium** | Customer authentication (signup/login) | Personalised recommendations require logged-in user history | Q2 2024 |
| **Medium** | Order management module | Cart → checkout → order history flow | Q3 2024 |
| **Medium** | MLflow model registry | Version and track recommendation model experiments | Q2 2024 |
| **Low** | Sentence-level review analysis | Extract specific product issues (delivery, quality) beyond sentiment | Q3 2024 |
| **Low** | Multi-store support | Allow multiple sellers on one Vyapari instance | Q4 2024 |
| **Low** | Mobile PWA | Progressive Web App for mobile-first customer access | Q4 2024 |

---

# Appendix A — Glossary

| Term | Definition |
| --- | --- |
| HITL | Human-in-the-Loop — design pattern where AI proposes actions but humans approve before execution |
| SVD | Singular Value Decomposition — matrix factorisation technique used for collaborative filtering |
| Collaborative Filtering | Recommendation method that uses user–item interaction history to predict preferences |
| Cold-Start Problem | Challenge when a new user has no interaction history, making personalised recommendations impossible |
| DistilBERT | A lighter, faster version of BERT trained for text classification tasks (sentiment analysis here) |
| Decision Boundary | The rule that determines whether an agent acts autonomously, seeks advisory approval, or escalates |
| Confidence Score | Agent's estimated probability (0–1) that its proposed decision is correct |
| Audit Log | Permanent, append-only record of every agent decision with full context and outcome |
| Days of Stock | Current stock units divided by average daily sales — how many days before stockout |
| Semantic Search | Search that understands intent and meaning rather than exact keyword matching |
| JWT | JSON Web Token — stateless authentication credential with expiry |
| p95 / p99 | 95th and 99th percentiles of latency distribution (upper tail performance) |
| Fallback | Secondary/tertiary mechanism activated when primary system fails |
| Escalation | When low-confidence or high-risk decision is surfaced to human instead of auto-executed |

---

# Appendix B — Sample Decision Objects

## Restock Decision (Advisory Mode)

```json
{
  "decision_id": "DEC_1005",
  "agent_type": "INVENTORY",
  "product_id": "PRD_042",
  "product_name": "Running Shoes",
  "decision_type": "RESTOCK",
  "proposed_action": {
    "action": "restock",
    "quantity": 100,
    "reason": "Days of stock = 4.2, below threshold of 7"
  },
  "confidence_score": 0.78,
  "risk_level": "MEDIUM",
  "decision_status": "pending",
  "current_stock": 35,
  "avg_daily_sales": 8.3,
  "days_of_stock": 4.2,
  "created_at": "2024-01-15T10:35:00Z"
}
```

## Pricing Decision (Autonomous Mode)

```json
{
  "decision_id": "DEC_1006",
  "agent_type": "PRICING",
  "product_id": "PRD_001",
  "product_name": "Wireless Headphones",
  "decision_type": "PRICE_ADJUST",
  "proposed_action": {
    "action": "adjust_price",
    "new_price": 1349,
    "reason": "Competitor price ₹1299, price drift 3.2%"
  },
  "confidence_score": 0.92,
  "risk_level": "LOW",
  "decision_status": "auto_executed",
  "current_price": 1499,
  "competitor_price": 1299,
  "current_margin_pct": 24.5,
  "executed_at": "2024-01-15T10:40:00Z"
}
```

---

**End of Document**

*Version 1.1 — Improved with comprehensive error handling, API schemas, authentication clarification, database design, monitoring strategy, and deployment guide.*
