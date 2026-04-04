**VYAPARI**

**_The Smart Merchant_**

Autonomous E-Commerce Operations & Personalization Platform

**Technical Requirements & System Design Document**

| Document Version | v1.0 — MVP Release |
| --- | --- |
| Document Type | Technical Requirements Specification |
| Project | B.Tech Final Year Major Project — PSIT Kanpur |
| Domain | AI/ML · NLP · Web Application |

_This document is a living specification. Fill in your name, roll number, and team details before submission._

# 1\. Executive Summary

Vyapari (Hindi: व्यापारी — Merchant) is a three-module agentic AI platform for e-commerce operations. It simultaneously addresses two persistent problems in digital retail: (1) customers receive generic, uninspired product recommendations that fail to reflect individual intent, and (2) store operations — inventory management, competitive pricing, and customer review engagement — remain reactive, manual, and unscalable.

Vyapari resolves both through a unified architecture. Three specialized AI agents run continuously in the background: a Recommendation Engine that personalises the shopping experience in real time, an Inventory & Pricing Agent that monitors stock health and competitor prices, and a Review Response Agent that classifies sentiment and drafts contextual customer replies. Every agent decision is surfaced through a Human-in-the-Loop (HITL) dashboard before execution, ensuring operator control is never compromised.

This document specifies the complete technical requirements for three user-facing surfaces: the Customer Dashboard (shopping experience), the Seller Dashboard (store management), and the HITL Operations Dashboard (agent oversight), as well as the backend architecture, data models, security requirements, and evaluation metrics.

# 2\. System Overview

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

## 2.3 Agent Decision Flow

Every autonomous action follows a standard pipeline: Observe → Reason → Propose → Human Review → Execute (or Reject). No agent writes to the database without an approved decision record in the audit log.

| Decision Boundary Rules |
| --- |
| Autonomous ModeAgent confidence > 0.85 AND action risk is LOW (e.g. restock alert for fast-moving commodity). Agent acts immediately and logs the decision.Advisory ModeAgent confidence 0.60–0.85 OR action is MEDIUM risk (e.g. pricing change). Agent proposes action, queues it for human approval.Escalation ModeAgent confidence < 0.60 OR action is HIGH risk (1-star review with legal keywords, price below cost threshold). Agent escalates with full context. No draft is generated. |

# 3\. Customer Dashboard — Technical Requirements

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

## 3.2 Recommendation Engine — Frontend Requirements

**3.2.1 Personalised Recommendation Strip**

*   Displayed on the Home page and Product Detail page
*   Fetches from GET /recommendations/{user\_id}?top\_n=6
*   Must display: product image placeholder, product name, category badge, price, stock status
*   Badge indicates recommendation source: 'For You' (SVD), 'Popular' (fallback), 'Similar' (content-based)
*   If user is not logged in, display top-rated products by default
*   Horizontal scroll on mobile, grid on desktop

**3.2.2 Semantic Search Bar**

*   Present on all pages via top navigation
*   Accepts natural language queries — minimum 2 characters before firing request
*   Calls GET /search?q={query}&top\_n=8
*   Debounce: 400ms after last keystroke before API call
*   Results page shows: product cards + 'Search matched because...' tooltip on hover
*   If zero results returned, show: 'No matches found. Showing popular items instead.'

## 3.3 Product Catalogue — Frontend Requirements

**3.3.1 Filters Panel**

*   Category filter: multi-select checkboxes (Electronics, Clothing, Books, Home & Kitchen, Sports)
*   Price range: dual-handle slider, min ₹0 to max ₹9999
*   Stock filter: 'In Stock Only' toggle
*   Sort: Relevance, Price Low→High, Price High→Low, Newest, Top Rated
*   All filters apply client-side on current result set (no full page reload)

**3.3.2 Product Card**

*   Fields: product image (placeholder), name, category, price in ₹, stock indicator
*   Stock indicator colour: green (> 20), orange (5–20), red (< 5 — 'Low Stock' label)
*   Quick Add to Cart button visible on hover
*   Clicking card navigates to /product/:id

## 3.4 Review Submission — Frontend Requirements

*   Accessible from Product Detail page
*   Fields: star rating (1–5, click-to-select), review text (min 10 chars, max 500 chars)
*   Character counter displayed below textarea
*   On submit: POST /reviews with { product\_id, user\_id, stars, text }
*   Success state: 'Thank you! Your review is under moderation.'
*   Reviews section on Product Detail shows: star rating, review text, sentiment badge (after processing), published response (if any)

## 3.5 Customer Dashboard — API Contracts

| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| GET /products | GET | ?category, sort, in_stock | Array of product objects |
| GET /products/:id | GET | — | Single product object |
| GET /recommendations/:uid | GET | ?top_n=6 | Array of product+source objects |
| GET /search | GET | ?q=string&top_n=8 | Array of product+match objects |
| POST /reviews | POST | { product_id, user_id, stars, text } | { id, status: 'pending' } |
| GET /cart | GET | — | Cart items for session user |
| POST /cart/add | POST | { product_id, qty } | Updated cart |

## 3.6 Customer Dashboard — Non-Functional Requirements

| Requirement | Target |
| --- | --- |
| Page load time (initial) | < 2 seconds on 10 Mbps connection |
| Recommendation API response | < 800ms p95 |
| Search debounce | 400ms — prevents excessive API calls |
| Mobile responsiveness | All pages functional on 375px viewport width |
| Accessibility | WCAG 2.1 Level AA: alt text, keyboard navigation, contrast ratio ≥ 4.5:1 |
| Session persistence | Cart and user preferences persist across browser refresh (localStorage) |

# 4\. Seller Dashboard — Technical Requirements

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
*   Alert types: LOW\_STOCK (red), PRICE\_DRIFT (yellow), ESCALATED\_REVIEW (red), AGENT\_ERROR (orange)
*   Each alert card: icon, product name, short description, 'View' button linking to relevant page
*   Alerts persist until the underlying decision is resolved

**4.2.3 Quick Actions**

*   'Run Inventory Scan' button: triggers POST /inventory/scan, shows spinner while running, refreshes stats on completion
*   'Process Reviews' button: triggers POST /reviews/process, shows progress indicator
*   'Add Product' button: navigates to /seller/products/add

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
*   Invalid values (negative stock, price below cost) show inline error and reject the update

**4.3.3 Bulk Actions**

*   Multi-select via checkboxes in first column
*   Bulk actions: Export selected to CSV, Trigger scan for selected products

## 4.4 Pricing Monitor Page

Displays a side-by-side comparison of Vyapari's price vs. competitor price for every product, with the agent's pricing recommendation.

| Column | Type | Description | Action |
| --- | --- | --- | --- |
| Product | Text | Name + ID + category | Click → product edit |
| Our Price | Number | Current price in ₹ | Inline editable |
| Competitor Price | Number | Latest scraped/simulated price | Read-only |
| Diff % | Percentage | ( our - competitor ) / competitor × 100 | Red if > 10%, green if ≤ 0% |
| Suggested Price | Number | Agent-recommended price | 'Apply' button → HITL queue |
| Status | Badge | OK / OVERPRICED / UNDERPRICED | Colour coded |

## 4.5 Add / Edit Product Form

**4.5.1 Form Fields**

| Field | Validation Rules |
| --- | --- |
| Product Name | Required, 3–100 characters, string |
| Category | Required, must be one of the 5 defined categories (select dropdown) |
| Price (₹) | Required, numeric, min ₹1, max ₹99999, 2 decimal places |
| Cost (₹) | Required, numeric, must be < Price |
| Stock (units) | Required, integer, min 0, max 99999 |
| Product Description | Optional, max 500 characters |
| SKU / Product ID | Auto-generated on create; read-only on edit |

*   Submit calls POST /products (create) or PATCH /products/:id (update)
*   On success: redirect to /seller/inventory with success toast notification
*   On validation error: inline error messages below each failing field

## 4.6 Analytics Page

**4.6.1 Charts Required**

*   Sales Velocity Chart: Line chart, last 7 days, one line per top-5 products by volume. X-axis: days, Y-axis: units sold. Rendered with Recharts.
*   Stock Health Pie Chart: Breakdown of products by status (Critical / Warning / OK)
*   Category Revenue Bar Chart: Total revenue by category (price × units sold simulation)
*   Review Sentiment Distribution: Doughnut chart — Positive / Neutral / Negative counts
*   All charts auto-refresh every 5 minutes
*   Hovering any data point shows a tooltip with exact values
*   Each chart has an 'Export PNG' button (uses HTML Canvas download)

## 4.7 Seller Dashboard — API Contracts

| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| GET /stats | GET | — | Dashboard KPI object |
| GET /inventory | GET | — | Products with health fields |
| POST /inventory/scan | POST | ?threshold_days=7 | { scanned, new_decisions } |
| PATCH /products/:id | PATCH | { field, value } | Updated product |
| POST /products | POST | Full product object | Created product |
| DELETE /products/:id | DELETE | — | { ok: true } |
| GET /reviews | GET | ?status=pending | Array of review objects |
| POST /reviews/process | POST | — | { processed: N } |

# 5\. HITL Operations Dashboard — Technical Requirements

The HITL (Human-in-the-Loop) Operations Dashboard is the control centre for the AI agents. It is designed for a technically literate operator — a store manager or AI supervisor — who needs to audit, approve, and occasionally override every autonomous decision the system makes. The dashboard must be fast, auditable, and transparent. It is the most critical surface in the Vyapari system.

## 5.1 Pages & Routes

| Route | Page Name | Purpose |
| --- | --- | --- |
| /hitl | Decision Queue | Pending agent decisions awaiting approval |
| /hitl/log | Audit Log | Full immutable history of all agent decisions |
| /hitl/reviews | Review Approvals | Pending AI-drafted review responses |
| /hitl/agents | Agent Status | Health and last-run status of each agent |
| /hitl/settings | Agent Settings | Configurable thresholds and guardrails |

## 5.2 Decision Queue Page

**5.2.1 Decision Card — Required Fields**

| Field | Description |
| --- | --- |
| Decision Type Badge | RESTOCK or PRICING — colour coded (blue/orange) |
| Product Name + ID | Clickable link to product edit page |
| Mode Badge | AUTONOMOUS (green) or ADVISORY (yellow) |
| Confidence Score | Numeric 0–100% + colour-coded progress bar |
| Agent Reasoning | Full natural language explanation of why agent made this decision |
| Triggering Data | Raw numbers that triggered the decision (e.g. current stock, days remaining) |
| Suggested Action | Exactly what will happen if approved (restock qty OR new price) |
| Timestamp | Created at, formatted as DD/MM/YYYY HH:MM |
| Approve Button | Green — executes the action and logs to audit trail |
| Reject Button | Red — dismisses the decision, logs rejection reason |

**5.2.2 Batch Actions**

*   'Approve All — Autonomous' button: approves all decisions with mode=autonomous in one click
*   'Reject All' button: rejects all pending decisions (requires confirmation modal)
*   Filter by type: All | Restock | Pricing
*   Filter by mode: All | Autonomous | Advisory
*   Sort by: Confidence (default desc), Created At, Product Name

**5.2.3 Decision Execution Logic**

*   Approving a RESTOCK decision: calls PATCH /products/:id with { field: 'stock', value: current + suggested\_qty }
*   Approving a PRICING decision: calls PATCH /products/:id with { field: 'price', value: suggested\_price }
*   Both trigger an audit log entry with operator identity and timestamp
*   Rejecting any decision marks it as 'rejected' in the DB — product data unchanged

## 5.3 Audit Log Page

The audit log is the single source of truth for all agent activity. It is append-only — no record can be deleted or modified after creation.

**5.3.1 Log Table Columns**

*   ID, Type, Product Name, Agent Mode, Confidence, Status (Pending/Approved/Rejected), Created At, Resolved At, Resolved By
*   Status column: colour-coded badges — Pending (blue), Approved (green), Rejected (red)
*   Clicking a row expands it to show full Payload JSON (the raw agent decision object)

**5.3.2 Filters & Export**

*   Date range picker: filter by Created At range
*   Status filter: All | Pending | Approved | Rejected
*   Type filter: All | Restock | Pricing
*   Search: filter by product name
*   Export to CSV: downloads all filtered rows as CSV file
*   Pagination: 20 rows per page, total count displayed

## 5.4 Review Approvals Page

**5.4.1 Review Card — Required Fields**

| Field | Description |
| --- | --- |
| Review ID + Product | Review identifier and product name |
| Star Rating | Visual stars display (1–5) |
| Review Text | Full customer review text in quote styling |
| Sentiment Badge | POSITIVE (green) / NEUTRAL (yellow) / NEGATIVE (red) |
| Sentiment Confidence | Model confidence score as percentage |
| Classification Source | 'distilbert' or 'rule_based' — shows which classifier was used |
| Draft Response | Editable textarea pre-filled with AI-generated draft |
| Escalation Flag | Red warning box if review was escalated — shows escalation reason |
| Approve & Publish | Green button — publishes the (edited) draft response |
| Reject Draft | Gray button — marks draft as rejected, no response published |

**5.4.2 Escalated Reviews**

*   Escalated reviews shown in a separate section at the top, highlighted with red border
*   No AI draft is generated for escalated reviews — operator must write response manually
*   Escalation criteria: 1-star rating OR text contains any of: refund, broken, dangerous, hazard, fraud, scam, injury, lawsuit, fire, explode, defective
*   Manual response textarea shown with 'Publish Response' button

## 5.5 Agent Status Page

| Agent | Monitored Metrics |
| --- | --- |
| Recommendation Agent | Last model load time, SVD training status, number of users with ratings, cold-start fallback rate |
| Inventory & Pricing Agent | Last scan timestamp, products scanned, decisions generated, avg confidence score |
| Review Response Agent | Reviews processed, sentiment model status (loaded/error), escalation rate, auto-draft rate |

*   Each agent card shows: status dot (green=healthy, yellow=degraded, red=error), last run timestamp, last run outcome
*   'Run Now' button on each card to manually trigger the agent
*   Error logs from the last 24 hours shown in expandable code block

## 5.6 Agent Settings Page

**5.6.1 Configurable Parameters**

| Parameter | Default | Min | Max |
| --- | --- | --- | --- |
| Restock Threshold (days) | 7 | 1 | 30 |
| Restock Buffer (days multiplier) | 14 | 7 | 30 |
| Price Drift Threshold (%) | 10 | 5 | 30 |
| Minimum Price Margin over Cost (%) | 10 | 5 | 50 |
| Escalation Star Threshold | 1 | 1 | 2 |
| Sentiment Confidence Min | 0.75 | 0.5 | 0.99 |
| Agent Confidence Threshold — Autonomous | 0.85 | 0.7 | 0.99 |
| Max Auto-Drafts per Run | 50 | 1 | 200 |

*   All settings validated on client before POST /settings
*   Settings persist in local config JSON file (backend)
*   'Reset to Defaults' button with confirmation modal

## 5.7 HITL Dashboard — API Contracts

| Endpoint | Method | Request | Response |
| --- | --- | --- | --- |
| GET /decisions/pending | GET | — | Array of pending decisions |
| GET /decisions | GET | ?limit=50 | Array of all decisions |
| POST /decisions/:id/resolve | POST | { action, resolved_by } | { ok, status } |
| GET /reviews?status=draft_ready | GET | — | Array of draft-ready reviews |
| POST /reviews/:id/approve | POST | { response } | { ok, status: 'published' } |
| POST /reviews/:id/reject | POST | — | { ok, status: 'rejected' } |
| GET /agent-status | GET | — | Agent health objects |
| GET /settings | GET | — | Current config object |
| POST /settings | POST | Config object | { ok, updated } |

# 6\. Backend Architecture — Technical Requirements

## 6.1 API Design Principles

*   RESTful design — nouns in URLs, HTTP verbs for actions
*   All responses return JSON with consistent envelope: { data, error, status }
*   All list endpoints return arrays (never null — return empty array if no results)
*   All write operations (POST, PATCH, DELETE) return the updated resource
*   Error responses include: { error: string, detail: string, code: int }

## 6.2 Data Models

**6.2.1 Product**

| Field | Type & Constraints |
| --- | --- |
| id | STRING — format P001..P999, primary key, auto-generated |
| name | STRING — 3–100 chars, required |
| category | ENUM — Electronics | Clothing | Books | Home & Kitchen | Sports |
| price | FLOAT — 2 decimal places, > 0, > cost |
| cost | FLOAT — 2 decimal places, > 0, < price |
| stock | INTEGER — ≥ 0 |
| description | STRING — optional, max 500 chars |
| created_at | ISO 8601 timestamp — auto-set on create |
| updated_at | ISO 8601 timestamp — auto-set on update |

**6.2.2 Decision (Audit Log Entry)**

| Field | Type & Constraints |
| --- | --- |
| id | INTEGER — auto-increment primary key |
| type | ENUM — restock | pricing |
| product_id | STRING — foreign key → products.id |
| product_name | STRING — denormalised for audit readability |
| mode | ENUM — autonomous | advisory |
| confidence | FLOAT — 0.0 to 1.0 |
| reasoning | TEXT — natural language agent explanation |
| payload | JSON TEXT — full raw agent decision object |
| status | ENUM — pending | approved | rejected |
| created_at | ISO 8601 timestamp |
| resolved_at | ISO 8601 timestamp — null if pending |
| resolved_by | STRING — operator identifier |

**6.2.3 Review**

| Field | Type & Constraints |
| --- | --- |
| id | STRING — format R001..R999 |
| product_id | STRING — foreign key → products.id |
| user | STRING — customer identifier |
| stars | INTEGER — 1 to 5 inclusive |
| text | STRING — 10 to 500 chars |
| sentiment | ENUM — positive | negative | neutral | null (unprocessed) |
| sentiment_confidence | FLOAT — 0.0 to 1.0 | null |
| sentiment_source | ENUM — distilbert | rule_based | null |
| escalated | BOOLEAN — default false |
| escalation_reason | STRING | null |
| draft_response | TEXT | null — AI-generated draft |
| status | ENUM — pending | draft_ready | published | rejected | escalated |
| processed_at | ISO 8601 | null |
| published_at | ISO 8601 | null |

## 6.3 Recommendation Engine — Technical Specification

| SVD Collaborative Filtering |
| --- |
| Library: scikit-surprise (SVD class)Parameters: n_factors=50, n_epochs=20, lr_all=0.005, reg_all=0.02, random_state=42Training: Build full trainset from user–item–rating DataFrame at server startup (lazy-loaded on first request)Cold-start fallback: If user_id has no ratings, return top products ranked by average rating across all usersEvaluation metric: NDCG@10, Precision@10, RMSE on held-out test split (20%) |

## 6.4 Sentiment Classification — Technical Specification

*   Model: distilbert-base-uncased-finetuned-sst-2-english (HuggingFace Hub)
*   Framework: transformers.pipeline('sentiment-analysis')
*   Input truncation: max\_length=512 tokens
*   Output: POSITIVE or NEGATIVE with confidence score 0.0–1.0
*   3-class mapping: POSITIVE (conf > 0.75) → positive; NEGATIVE (conf > 0.75) → negative; else → neutral
*   Fallback: If model fails to load (memory / environment constraint), rule-based keyword classifier activates
*   Rule-based fallback: positive keyword list (great, amazing, excellent, love, perfect) vs negative (terrible, broken, waste, disappointed, poor)

## 6.5 Review Response Generation — Technical Specification

*   Primary: OpenAI GPT-3.5-turbo via openai Python SDK
*   System prompt: brand voice instructions + 60-word limit constraint + 'do not use Dear Customer' rule
*   Fallback: Template bank of 2 templates per sentiment class (positive, negative, neutral)
*   The {product} placeholder in templates is replaced with the actual product name at runtime
*   OpenAI key sourced from OPENAI\_API\_KEY environment variable — system operates fully without it
*   Max tokens: 120, Temperature: 0.7

## 6.6 Inventory Agent — Technical Specification

*   Trigger: Manual (via POST /inventory/scan) or scheduled (configurable cron, default: every 6 hours)
*   Sales velocity: 7-day rolling average of daily sales units per SKU from sales\_velocity.json
*   Days of stock: current\_stock / avg\_daily\_sales — if avg\_daily\_sales = 0, return 999 (infinite)
*   Restock trigger: days\_of\_stock < threshold\_days AND stock < 20
*   Suggested restock quantity: max(50, avg\_daily\_sales × buffer\_days)
*   Pricing trigger: (our\_price - competitor\_price) / competitor\_price > drift\_threshold
*   Minimum price guardrail: suggested\_price ≥ cost × (1 + min\_margin\_pct / 100)
*   Duplicate prevention: If a pending decision for the same product+type already exists, skip — do not create a duplicate

# 7\. Security Requirements

| Requirement | Implementation |
| --- | --- |
| Authentication | JWT-based auth for Seller and HITL dashboards. Customer dashboard can be public-read. |
| CORS | Allowed origins: localhost:5173 (dev), production domain only |
| Input Validation | All POST/PATCH bodies validated via Pydantic models in FastAPI — reject malformed input with HTTP 422 |
| Price Guardrail Enforcement | Backend enforces minimum price rule — frontend can suggest but backend rejects price below cost × 1.10 |
| Sensitive Config | OPENAI_API_KEY, DB credentials stored in .env file — never committed to Git |
| Audit Log Integrity | Decision records INSERT-only — no UPDATE or DELETE on resolved records |
| Rate Limiting | POST /inventory/scan limited to 10 calls/hour per IP to prevent abuse |

# 8\. Evaluation Metrics & Success Criteria

| Metric | Baseline | MVP Target | Measurement Method |
| --- | --- | --- | --- |
| Recommendation NDCG@10 | ~0.50 (popularity ranking) | ≥ 0.65 | Evaluation on 20% held-out ratings |
| Recommendation Precision@10 | ~12% | ≥ 20% | Held-out test set |
| Sentiment F1 Score | N/A (zero-shot) | ≥ 88% on test set | Manually labelled 100-review test set |
| Restock Alert Accuracy (sim) | Threshold-only rule | ≥ 90% correct flags | Simulated stockout scenarios |
| Review Auto-Draft Coverage | 0% (all manual) | ≥ 75% of reviews | Percentage not escalated |
| Escalation Precision | N/A | ≥ 95% | Manual audit of 50 escalated reviews |
| Decision Queue Latency | N/A | < 500ms p95 | FastAPI response timing logs |
| Page Load Time | N/A | < 2 seconds | Lighthouse audit |

# 9\. Development Environment & Setup

## 9.1 Hardware Requirements

| Component | Minimum Specification |
| --- | --- |
| Processor | Intel Core i5 or AMD Ryzen 5, 2.5 GHz, quad-core |
| RAM | 8 GB (16 GB recommended for DistilBERT loading) |
| Storage | 20 GB free SSD space |
| GPU | Not required. NVIDIA 4 GB VRAM optional for faster DistilBERT inference |
| Internet | Required for first-time model download (~270 MB) and optional OpenAI API calls |

## 9.2 Software Requirements

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
| Database (production demo) | PostgreSQL 15+ |
| Operating System | Windows 10/11, Ubuntu 20.04+, or macOS 12+ |

## 9.3 Environment Variables

| Variable | Purpose |
| --- | --- |
| OPENAI_API_KEY | GPT-3.5-turbo API access for review response generation (optional) |
| DATABASE_URL | PostgreSQL connection string (optional — defaults to SQLite if not set) |
| VYAPARI_ENV | development | production — controls debug mode and CORS strictness |
| SECRET_KEY | JWT signing secret for Seller and HITL dashboard authentication |

# 10\. Known Limitations & Out-of-Scope Items

| MVP Scope Boundaries |
| --- |
| Not in MVP Scope:Real payment gateway integration (cart is display-only in MVP)Real-time competitor price scraping (simulated mock feed used instead)Live streaming of sales events (scheduled polling used instead of Kafka/Redis)Multi-tenant / multi-store supportMobile native apps (iOS / Android)Advanced A/B testing framework for recommendationsSentence-transformers vector search (keyword search used for MVP — upgrade path documented) |

# 11\. Future Roadmap

| Priority | Feature | Rationale |
| --- | --- | --- |
| High | Sentence-transformers semantic search | True NLP search beyond keyword matching — replaces current search module |
| High | Real competitor price scraping | Playwright-based scraper to replace mock price feed |
| High | Scheduled agent cron jobs | Automate agent runs without manual trigger |
| Medium | User authentication (customers) | Personalised recommendations require logged-in user history |
| Medium | Order management module | Cart → checkout → order history flow |
| Medium | MLflow model registry | Version and track recommendation model experiments |
| Low | Sentence-level review analysis | Extract specific product issues (delivery, quality) beyond sentiment |
| Low | Multi-store support | Allow multiple sellers on one Vyapari instance |
| Low | Mobile responsive PWA | Progressive Web App for mobile-first customer access |

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