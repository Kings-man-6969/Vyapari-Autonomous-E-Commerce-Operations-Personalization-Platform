# Vyapari Canonical System Contracts & State Machines

This document establishes the canonical ground truth across the database, backend APIs, and frontend interfaces for the Vyapari Autonomous E-Commerce Operations & Personalization Platform.

---

## 1. Authentication & Token Contract

| Element | Location | Storage Mechanism | Security Attributes |
|---|---|---|---|
| **Access Token** | Memory (JS State) | React `AuthContext` state | Short-lived (15 min), never stored in `localStorage` or `sessionStorage` |
| **Refresh Token** | Cookie | HttpOnly Cookie | `Path=/api/auth/refresh`, `SameSite=Strict`, `Secure` (in prod), Token family rotation with reuse detection |
| **UI Preferences** | Storage | `localStorage` | Allowed strictly for non-sensitive UI state (e.g. dismissed banners, collapsed sidebars) |

---

## 2. Order & Payment State Machine

Order state and payment state are strictly decoupled:

### Order Lifecycle (`orders.status`)
```
PENDING_PAYMENT ────────┬───────────► CANCELLED (Customer / Timeout)
       │                │
       │ (Payment Capt) │
       ▼                │
     PAID ──────────────┘ (Refund / Cancellation)
       │
       ▼
   PROCESSING (Merchant Packaging)
       │
       ▼
    SHIPPED (Courier Assigned & AWB Created)
       │
       ▼
OUT_FOR_DELIVERY (Last Mile Dispatch)
       │
       ▼
   DELIVERED (Fulfilled)
```

**Allowed Order Status Values**:
- `pending_payment`: Order created, stock locked/decremented, awaiting payment authorization.
- `paid`: Payment captured successfully via gateway.
- `processing`: Merchant has acknowledged order and is preparing package.
- `shipped`: Handed over to courier with tracking reference.
- `out_for_delivery`: In transit to customer delivery address.
- `delivered`: Delivery confirmed.
- `cancelled`: Cancelled prior to fulfillment (stock replenished).

### Payment Lifecycle (`payments.status`)
- `created`: Gateway order initialized.
- `captured`: Payment successfully authorized and captured.
- `failed`: Payment gateway rejected transaction or expired.
- `refunded`: Funds returned to customer.

### Inventory Concurrency Policy (Option B — Transactional Decrement with Automatic Restoration)
1. `POST /api/orders`: Executes `SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE`. Decrements stock immediately and creates order with `status = 'pending_payment'`.
2. On payment success (`POST /api/payments/verify`): Order transitions to `status = 'paid'`.
3. On payment failure, timeout (15 mins), or explicit cancellation: Order transitions to `status = 'cancelled'` and stock is atomically restored:
   `UPDATE products SET stock_qty = stock_qty + $qty WHERE id = $prodId`.

---

## 3. Seller Lifecycle & KYC Model

```
REGISTER (/register?role=seller)
       │
       ▼
ACCOUNT CREATED (Store Name, Category)
       │
       ▼
DASHBOARD ACCESSIBLE (Status: pending_kyc)
       │
       ├── Can draft products
       ├── Can explore AI listing studio
       └── CANNOT publish live products or fulfill orders
       │
       ▼
ADMIN KYC REVIEW (/admin/sellers)
       ├── Approve ──► Status: active (Can publish & sell)
       ├── Reject  ──► Status: rejected
       └── Suspend ──► Status: suspended
```

**Allowed Seller Status Values**:
- `pending_kyc`: Default status upon seller registration. Allows store setup and drafting.
- `active`: Verified by admin. Full marketplace privileges.
- `rejected`: Onboarding documents rejected.
- `suspended`: Store locked due to compliance/dispute violations.

---

## 4. Public Catalog & Search Architecture

- **Catalog & Filter API**: `GET /api/products` (supports category, brand, price min/max, rating, sorting).
- **Search & NLQ API**: `GET /api/products/search` (handled by `backend-core`, which parses query filters, coordinates pgvector similarity with `service-recommendation`, and returns ranked results).
- **Autocomplete API**: `GET /api/products/suggest` (instant prefix and keyword suggestions).
- **Recommendations API**: `GET /api/recommendations/products/:id` (hybrid vector + collaborative recommendations).

---

## 5. Normalized Route Names

### Seller Console
- `/seller/dashboard`: Main merchant operational KPI desk.
- `/seller/products`: Catalog management.
- `/seller/products/new`: Add product.
- `/seller/products/:id/edit`: Edit product.
- `/seller/orders`: Order fulfillment and courier dispatch.
- `/seller/reviews`: Customer reviews and sentiment monitoring.
- `/seller/inventory`: Inventory velocity and reorder alerts.
- `/seller/ai`: Seller AI operations chat assistant.
- `/seller/ai/listing`: Seller AI automated listing studio.
- `/seller/approvals`: Human-in-the-loop approval queue.
- `/seller/settings`: Store and payout preferences.

### Courier Dispatch Logistics Enum
When marking orders as shipped, sellers select from canonical logistics providers:
- `self`: Merchant Self-Delivery / Local Messenger
- `delhivery`: Delhivery Express
- `bluedart`: Blue Dart Aviation
- `dtdc`: DTDC Express
- `india_post`: India Post Speed Post

---

## 6. Product Detail Page (PDP) Architecture

**Desktop Layout (1080px - 1400px)**:
- **Column 1 (45%)**: Media Gallery (Sticky thumbnail rail + high-res viewport + zoom).
- **Column 2 (30%)**: Product Narrative (Whisper-weight title, merchant credential pill, 384-dim semantic tags, specs table, verified reviews).
- **Column 3 (25%)**: Buy Box (Sticky purchase panel: pricing, stock status, courier delivery estimator, quantity selector, Pure White Pill CTA, guarantee tags).

**Mobile Layout (<768px)**:
- Stacked single-column hierarchy (Gallery -> Product Narrative -> Specs -> Reviews -> Seller Profile).
- Bottom Sticky Purchase Bar (`pdp-mobile-sticky-bar`) for one-tap checkout.
