## Plan: Vyapari 1-Week Solo Build

Deliver a local-demo capable, vertically integrated slice of Vyapari in 7 days as a solo project by prioritizing end-to-end reliability over full TRD breadth. The approach is to implement a strict core MVP plus a small, high-visibility subset of Phase-2 enhancements that can be shown live without cloud dependencies.

**Current Status**
- The backend API, SQLite schema, seed data, and role guards are implemented.
- The frontend has separate customer, seller, and HITL routes with Clerk-based auth on the landing flow.
- Review approvals, agent settings, inventory, cart, profile, and order pages are already in place.
- Demo auth now fail-closes when `DEMO_AUTH_ENABLED=false`; real Clerk JWT verification is still pending.
- The next work is documentation cleanup, endpoint/requirements consolidation, and any remaining polish discovered during smoke testing.

**Project Overview**
- Build an AI-assisted e-commerce operations platform with three user surfaces: Customer Dashboard, Seller Dashboard, and HITL Dashboard.
- Solve two problems: weak personalization for customers and manual, delayed seller operations.
- Primary demo users: project evaluator (acts as customer, seller, operator) and developer/operator (you) for local walkthrough.
- Primary use cases: product discovery + recommendations, inventory/pricing suggestions, review sentiment + response approval, auditable human approval flow.

**Feature Breakdown**
- MVP Core (must ship in 1 week):
1. Customer: product list, product detail, keyword search, recommendation strip with fallback, review submission.
2. Seller: KPI overview, inventory table with status, inline stock/price edit, manual inventory scan trigger.
3. HITL: pending decision queue, approve/reject decision flow, audit log list.
4. Backend: products/reviews/decisions endpoints, inventory agent scan logic, recommendation fallback and simple personalized stub, review sentiment (rule-based baseline + optional DistilBERT if available).
5. Safety: price guardrail (price >= cost * 1.10), append-only style decision records, request validation.
- Phase-2 subset included in first release (high-impact only):
1. Review response drafting with template fallback and editable approval in HITL.
2. Agent settings page with persisted local config JSON.
3. Basic analytics page (2 charts only: stock health and sentiment distribution).
- Deferred to post-demo:
1. Real payment flow, multi-tenant support, production hardening, full semantic vector search, full competitor scraping automation.

**System Architecture**
- Frontend: React + Vite + Tailwind with route-based dashboards and shared component library.
- Backend: FastAPI monolith with domain routers (products, reviews, decisions, agents, settings, analytics).
- Data: SQLite for local demo with migration-ready schema design compatible with PostgreSQL.
- AI/ML integration:
1. Recommendations: popularity + lightweight user affinity heuristic first; optional SVD training as background enhancement.
2. Sentiment: rule-based first for guaranteed demo stability; DistilBERT feature-flagged.
3. Response generation: template bank first; optional OpenAI API if key present.
- Scalability/modularity:
1. Keep business logic in service layer independent from API routers.
2. Separate decision engine from execution service to preserve HITL boundary.
3. Use config service for thresholds to avoid hardcoding.

**Database Design**
- Core entities:
1. Product (id, name, category, price, cost, stock, description, timestamps).
2. Review (id, product_id, user, stars, text, sentiment fields, escalation fields, draft_response, status, timestamps).
3. Decision (id, type, product_id, product_name, mode, confidence, reasoning, payload, status, created/resolved metadata).
4. Settings (singleton config record for thresholds and safety guardrails).
- Relationships:
1. Product 1:N Review.
2. Product 1:N Decision.
- Schema rules:
1. Enforce non-negative stock, valid star range, and cost-price guardrail.
2. Prevent duplicate pending decisions for same product and decision type.

**Development Plan**
- Day 1: Project bootstrap
1. Initialize backend and frontend apps.
2. Create SQLite schema and seed script.
3. Implement base API envelope, error model, and validation conventions.
- Day 2: Core commerce APIs + customer surface
1. Build products, product detail, and search endpoints.
2. Implement customer product catalog/detail pages.
3. Add review submission endpoint and UI form with validation.
- Day 3: Inventory agent + seller inventory
1. Implement inventory scan logic and pending decision creation.
2. Build seller overview KPIs and inventory table.
3. Add inline edit for stock/price with backend guardrails.
- Day 4: HITL workflow
1. Build pending decisions endpoint, resolve endpoint, and audit log queries.
2. Implement HITL decision queue UI and approve/reject actions.
3. Ensure decision resolution updates product data only on approval.
- Day 5: Review AI + phase-2 subset
1. Add sentiment processing flow and escalation criteria.
2. Add draft response generation (templates first, optional OpenAI).
3. Build HITL review approvals screen and settings screen.
- Day 6: Analytics + stabilization
1. Add simple analytics endpoint(s) and 2 seller charts.
2. Run end-to-end walkthrough tests across all three dashboards.
3. Fix critical UX/API defects.
- Day 7: Hardening + demo prep
1. Add smoke tests and scriptable demo reset (seed reload).
2. Finalize README, architecture diagram, and demo script.
3. Run final local dry-run from clean startup.

**Completed Work**
- Backend:
1. FastAPI app entrypoint, schema creation, seeded data, and shared DB session handling.
2. Role-aware auth context and seller/customer guard rails.
3. Product, review, decision, settings, cart, order, inventory, and stats endpoints.
- Frontend:
1. Clerk provider setup and selection-first role flow.
2. Protected customer, seller, and HITL routes.
3. Seller overview, inventory, review approvals, agent settings, cart, profile, orders, and catalog/detail pages.
- Operations:
1. One-command launcher script for backend and frontend.
2. Build and compile verification passing for the current codebase.

**Parallelism and Dependencies**
- Sequential blockers:
1. DB schema before agent/services.
2. Decision resolve logic before HITL UI completion.
3. Review status workflow before review approval UI.
- Can run in parallel when stable:
1. Frontend page scaffolding parallel with backend endpoint stubs.
2. Analytics UI parallel with analytics endpoint implementation.

**Code Structure and Best Practices**
- Proposed structure:
1. backend/app/main.py
2. backend/app/api/routers/{products,reviews,decisions,agents,settings,analytics}.py
3. backend/app/services/{recommendation,inventory,pricing,sentiment,response_generation}.py
4. backend/app/models/{product,review,decision,settings}.py
5. backend/app/db/{session,migrations,seed}.py
6. frontend/src/{pages,components,services,hooks,store,types}
- Standards:
1. Typed request/response models for every endpoint.
2. Centralized constants for thresholds/status enums.
3. No direct DB writes from routers; route -> service -> repository flow.
4. Small reusable components (cards, tables, badges, modals, forms).
5. Keep business rules duplicated neither in multiple UI components nor multiple endpoints.

**Future-Proofing**
- API-first contracts: keep all dashboard logic backed by explicit endpoints to allow future mobile/PWA clients.
- Extensibility hooks:
1. Strategy interface for recommendation engines (popularity, heuristic, SVD, transformer-based).
2. Strategy interface for sentiment providers (rule-based, DistilBERT, future fine-tuned models).
3. Pluggable competitor data provider (mock now, scraper later).
- Data portability:
1. Use migration tooling even for SQLite to ease PostgreSQL transition.
2. Keep payload JSON in decisions for model and policy evolution.

**Testing and Deployment**
- Test strategy (fit to 1-week solo):
1. Unit tests for critical rules (price guardrail, decision dedupe, escalation detection).
2. Integration tests for top flows (inventory scan -> pending decision -> approve -> product update; review submit -> process -> draft approval).
3. UI smoke tests for each dashboard route.
4. Manual accessibility checks for keyboard navigation and contrast on critical pages.
- Deployment approach:
1. Local-only demo deployment using two terminals (FastAPI + Vite) or optional docker-compose if time remains.
2. Include one-command local startup scripts and one-command seed reset script.

**Risks and Mitigations**
- Major risks:
1. 1-week timeline overload due to broad scope.
2. ML dependencies causing setup/runtime instability.
3. Integration defects across three dashboards.
4. Scope creep from additional Phase-2 requests.
- Mitigations:
1. Freeze must-ship checklist by end of Day 1.
2. Implement deterministic fallbacks first; treat external AI as optional enhancement.
3. Daily end-to-end smoke run with fixed demo dataset.
4. Timebox advanced features; drop non-critical charts/pages before compromising core HITL flow.

**Relevant files**
- [Vyapari_TRD.md](Vyapari_TRD.md) — authoritative source for requirements and constraints used in this plan.

**Verification**
1. Start fresh local environment and run seed script; validate all three dashboards load.
2. Customer flow: browse product, search, submit review.
3. Seller flow: run inventory scan, observe pending decisions and KPI changes.
4. HITL flow: approve/reject decisions and confirm audit log updates.
5. Review flow: process reviews, approve or reject draft response, verify status transitions.
6. Guardrail checks: attempt invalid price below margin and confirm rejection.

**Decisions**
- Chosen due to constraints:
1. Local-first deployment prioritized over cloud.
2. Reliability-first AI fallbacks prioritized over full model sophistication.
3. Narrow Phase-2 subset included only if core flows are stable by Day 5.
- Explicitly excluded in 1-week build:
1. Real payment gateway, full production security hardening, advanced semantic vector search, true competitor scraping.

**Further Considerations**
1. If you want maximum scoring in viva, emphasize HITL governance and auditability as primary differentiator over pure chatbot-style e-commerce projects.
2. If time slips by Day 4, drop analytics and keep review drafting + decision pipeline intact.
3. If DistilBERT setup fails locally, proceed with rule-based sentiment and clearly document fallback design as resilience architecture.