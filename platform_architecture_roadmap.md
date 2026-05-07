# Vyapari Platform Architecture & Scaling Roadmap

## 1. Current Architecture Audit
**Existing State:**
*   **Backend:** A minimal FastAPI setup primarily in `main.py`. Includes basic authentication, product fetching, simple carts, and an MVP Human-in-the-Loop (HITL) approval system. 
*   **Frontend:** A monolithic React + Vite setup in `App.jsx`. Contains basic customer flows (Shop, Product, Cart) and initial seller/HITL surfaces (Inventory, Pricing, Decisions).
*   **Database:** SQLite/SQLAlchemy with basic models (User, Product, Review, Decision, PriceHistory).

**Identified Gaps & Missing Pieces:**
*   **Customer:** No checkout flow, order placement, order tracking, wishlist, or user profile settings. Missing payment gateway integrations.
*   **Seller:** Missing comprehensive order fulfillment management, payouts, onboarding, advanced store customization, and active AI co-pilot views (beyond basic HITL queue).
*   **Admin:** Completely missing an Admin dashboard for platform moderation, user management, and dispute handling.
*   **Agentic System:** Currently reliant on basic endpoints. Missing a robust agent orchestration layer (e.g., LangChain/LlamaIndex), persistent memory/context, background task workers (Celery/RQ), and streaming conversational interfaces.
*   **Code Structure:** Both frontend and backend need refactoring into scalable feature-based or domain-driven modules to support a growing team and codebase.

---

## 2. Scalable Folder Structure Architecture

To support a production-grade multi-tenant platform, the codebase should migrate to a domain-driven structure.

### **Frontend (React)**
```text
src/
├── app/                  # App initialization, global providers, store setup
├── features/             # Feature-based modules
│   ├── auth/             # Login, Onboarding
│   ├── customer/         # Catalog, Cart, Checkout, Profile
│   ├── seller/           # Dashboard, Inventory, Orders, Payouts
│   ├── admin/            # Moderation, Users, System Health
│   └── agent/            # Chat interfaces, HITL workspace, AI logs
├── shared/               # Shared UI components (Design System: buttons, modals)
├── services/             # API client, interceptors, WebSockets for agents
└── utils/                # Formatters, helpers
```

### **Backend (FastAPI)**
```text
backend/app/
├── api/
│   ├── dependencies.py   # Auth, DB, Agent context providers
│   └── v1/
│       ├── customer/     # Customer-facing endpoints
│       ├── seller/       # Seller operations
│       ├── admin/        # Admin operations
│       └── agent/        # AI interactions, webhooks
├── core/                 # Config, security, logging
├── models/               # SQLAlchemy ORM models (split by domain)
├── schemas/              # Pydantic models (split by domain)
├── services/             # Business logic (e.g., order processing)
└── agents/               # AI/Agentic Engine
    ├── workflows/        # Autonomous pipelines (e.g., auto-pricing)
    ├── tools/            # Actions agents can take (refund, update stock)
    └── memory/           # Conversation and state context handlers
```

---

## 3. Production-Level Route & Page Architecture

### A. Customer Side (The Buyer Experience)

**Routes & Purpose:**
*   `/` or `/shop` - **Home Page:** Dynamic storefront, personalized banners, AI-driven recommendations.
*   `/shop/search` - **Product Listing/Search:** Faceted search, filtering, semantic AI search results.
*   `/shop/product/:id` - **Product Details:** High-fidelity view, reviews, Q&A, Add to Cart.
*   `/cart` - **Cart:** Persistent cart, tax estimation, shipping calculation.
*   `/checkout` - **Checkout:** Multi-step flow (Shipping, Payment, Review). Integrates Stripe/Razorpay.
*   `/orders` & `/orders/:id` - **Orders & Tracking:** Order history, real-time logistics tracking, invoice generation.
*   `/wishlist` - **Wishlist:** Saved items, price drop alerts.
*   `/profile` - **User Profile & Settings:** Address book, payment methods, preferences.
*   `/support` - **Help Center:** AI chatbot for tier-1 support, ticketing system.

**Required Backend Integrations:**
*   Payment Gateway API (Stripe, Razorpay).
*   Order Management System (OMS) state machine.
*   Vector Search API (for semantic product search).
*   Shipping/Logistics API (e.g., ShipEngine, EasyPost).

### B. Seller Side (The Merchant Console)

**Routes & Purpose:**
*   `/seller/onboarding` - **Seller Authentication/Onboarding:** KYC, bank details, store setup.
*   `/seller/dashboard` - **Seller Dashboard:** High-level metrics, pending tasks, AI insights overview.
*   `/seller/products` & `/seller/products/new` - **Product Management:** Add/edit products, bulk upload, AI-generated descriptions.
*   `/seller/inventory` - **Inventory Management:** Stock levels, low-stock alerts, demand forecasting.
*   `/seller/orders` - **Order Management:** Fulfillment pipeline (Pending -> Shipped -> Delivered), printing shipping labels.
*   `/seller/analytics` - **Sales Analytics:** Revenue charts, conversion rates, traffic sources.
*   `/seller/finance` - **Revenue & Payouts:** Ledger, pending payouts, transaction history.
*   `/seller/marketing` - **Marketing & Promotions:** Discount codes, flash sales, sponsored products.
*   `/seller/assistant` - **AI Seller Assistant:** Chat interface to command the store ("Summarize my bad reviews", "Generate a promotion for dead stock").
*   `/seller/settings` - **Store Customization:** Storefront banners, policies, notification preferences.

**Required Backend Integrations:**
*   Ledger/Wallet system for multi-vendor payouts (Stripe Connect).
*   AI Prompt Engineering layer for generation (Descriptions, Replies).
*   Time-series database or aggregated tables for fast analytics.

### C. Admin Side (The Platform Overlord)

**Routes & Purpose:**
*   `/admin/dashboard` - **Admin Dashboard:** Platform gross merchandise value (GMV), active users, system health.
*   `/admin/users` - **User/Seller Management:** Suspend accounts, verify KYC, role management.
*   `/admin/moderation` - **Product & Content Moderation:** Flagged products, counterfeit detection, banned keywords.
*   `/admin/finance` - **Payment & Dispute Management:** Refund approvals, chargebacks, platform fee configuration.
*   `/admin/reports` - **Analytics & Reports:** Platform-wide data exports.
*   `/admin/support` - **Support Ticket Handling:** Inbox for escalations from the AI support agent.
*   `/admin/content` - **Content/Banner Management:** Global announcements, homepage layout control.

**Required Backend Integrations:**
*   Strict Role-Based Access Control (RBAC) middleware.
*   Audit logging API to track all admin actions.
*   Reporting engine (e.g., generating PDFs/CSV asynchronously).

### D. Agentic / AI Features (The Intelligent Core)

**Routes & Purpose:**
*   `/hitl` & `/hitl/queue` - **Decision Queue (Existing):** Review actions proposed by agents before execution.
*   `/agent/insights` - **AI Insights Dashboard:** Proactive notifications generated by background agents (e.g., "Competitor lowered price by 10%").
*   `/agent/workflows` - **Autonomous Workflows:** Configuration interface for sellers to set autopilot boundaries (e.g., "Auto-approve refunds under $10").
*   `/agent/chat` - **Conversational Assistant Routes:** Global floating UI for sellers/customers to chat with the platform AI.
*   `/agent/history` - **AI Actions/History/Logs:** Transparency dashboard showing every action an AI took on the seller's behalf.
*   `/admin/agents/prompts` - **Prompt Management:** Admin interface to tweak system prompts dynamically without redeploying.

**Required Backend Integrations:**
*   **Orchestration Layer:** Framework like LangChain/LangGraph or LlamaIndex to manage agent routing.
*   **Tool Execution API:** Secure wrappers around existing APIs (e.g., `update_price_tool()`) that agents can call.
*   **Memory Store:** Redis or Postgres JSONB to store conversation history and agent context.
*   **Asynchronous Workers:** Celery or FastAPI Background Tasks for long-running agentic thoughts and periodic cron jobs (e.g., nightly demand forecasting).
*   **Streaming WebSockets:** For real-time typing indicators and chunked LLM responses in the frontend.
