# Vyapari — Product Bible & UX Specification

> **Status:** Pre-implementation contract. No screen goes to code without a corresponding spec in this document.
> **Authority:** This document supersedes individual team interpretations. Changes require a team PR review.
> **Foundation:** Built on the Implementation Plan (architecture, schema, APIs) and DESIGN.md (visual language).
> **Anti-overengineering:** Every specification decision must serve a real user task.

---

## Part 0 — Contract Corrections

These tighten pre-implementation decisions before anyone writes code.

### C1. Token Storage (Security)

**Problem:** Storing the access token in `localStorage` exposes it to XSS.
**Decision:** Store the access token in **memory only** (React context/state). Store the refresh token in an **`httpOnly` cookie** set by the server. The Axios client reads the in-memory access token; on 401, it hits `/api/auth/refresh` (cookie is sent automatically) to get a new access token.
**Impact:** `backend-core` must set `Set-Cookie: refreshToken=...; HttpOnly; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800`. No `localStorage.setItem('accessToken')` anywhere in the frontend.

### C2. Order Stock Concurrency

**Problem:** Two customers buying the last unit simultaneously can both succeed.
**Decision:** The `POST /api/orders` transaction must use `SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE` before decrementing. If `stock_qty < requested_quantity`, return `409 Conflict` with `{code: 'INSUFFICIENT_STOCK', available: N}`.
**Frontend behavior:** On 409, show "Only N left in stock" inline, update quantity control, do not redirect.

### C3. Payment Failure Recovery

**Problem:** User closes browser after payment is initiated but before the webhook fires. Order is stuck in `pending`.
**Decision:** Add `GET /api/payments/status/:orderId`. On returning to `/orders/:id` with status `pending` and a payment exists with `status='created'`, the frontend polls this endpoint once to check gateway status. If the gateway confirms success and the webhook hasn't fired yet, the backend re-triggers the order update. If the payment is failed, offer a "Retry Payment" button.
**Polling:** One check on page load only. Not a polling loop.

### C4. Service Exposure / Single Origin

**Problem:** Frontend talking to 3 different ports (8000, 8001, 8002) creates CORS complexity and exposes internal services.
**Decision:** Frontend **only** talks to `backend-core` (`:8000`). `backend-core` proxies `/api/recommendations/*` to the recommendation service and `/api/agent/*` to the agentic service via internal HTTP. The two Python services are never directly reachable from the browser.

### C5. Recommendation User Identity for Logged-Out Users

**Problem:** `GET /api/recommendations/home/:userId` requires a userId. Logged-out users have none.
**Decision:** For logged-out users, the frontend sends `GET /api/recommendations/popular?limit=20` instead. The explore page simply shows the popular/trending feed without user personalization. No anonymous user ID or fingerprinting needed.

### C6. `product_stats_daily` PRIMARY KEY with NULL region

**Problem:** SQL's `PRIMARY KEY` treats `NULL != NULL`, so multiple rows with `region=NULL` (global stats) are allowed, breaking uniqueness.
**Decision:** Replace `region VARCHAR(100)` (nullable) with `region VARCHAR(100) NOT NULL DEFAULT 'global'`. Global stats use `region='global'`; city stats use the city name. The API filters with `WHERE region = 'global'` for global stats.

### C7. Review Purchase Gate

**Problem:** The gate checks for a `delivered` `order_item`, but `order_item` has no direct status — status is on the `order`.
**Decision:** The review gate query is: `SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status = 'delivered' LIMIT 1`. This is the correct join. Document this in `docs/api-contracts.md`.

### C8. Wishlist for Logged-Out Users

**Problem:** Heart icon exists on every product card; logged-out users can click it.
**Decision:** Clicking the heart while logged out opens the Login Prompt Modal (not a redirect). After successful login, the wishlist mutation is retried automatically. The heart does not navigate the user away from the current page.

---

## Part 1 — Global Design System

All values derived from [DESIGN.md](./DESIGN.md) with the Inter font substitution applied.

### 1.1 Visual Principles

- **Canvas is white.** Every page floor is `#ffffff`. No dark mode.
- **One accent.** `#ff385c` (Vyapari Red, analogous to DESIGN.md's Rausch) appears on: primary CTA buttons, the search button orb, the wishlist heart (saved state), and the brand wordmark. Nowhere else.
- **Type is modest.** Page headlines are 22–28px at weight 500–700. The system trusts product images for visual weight, not typographic muscle.
- **Shape is soft.** Buttons: `border-radius: 8px`. Cards: `border-radius: 14px`. Search bar and pills: `border-radius: 9999px`. No hard corners on interactive elements.
- **One shadow.** Either `box-shadow: rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px` or no shadow at all. Never multiple tiers.
- **Card density.** Cards sit 16px apart (tight marketplace). Sections breathe at 64px vertical padding. This contrast — open editorial, dense grid — is intentional.

### 1.2 Typography Scale (Inter, applied)

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `--text-display-xl` | 28px / 700 | Page hero headlines |
| `--text-display-lg` | 22px / 500 | Product detail h1 |
| `--text-display-md` | 21px / 700 | Section headings |
| `--text-display-sm` | 20px / 600 | Sub-section titles |
| `--text-title-md` | 16px / 600 | Card titles, nav labels |
| `--text-title-sm` | 16px / 500 | Footer column heads |
| `--text-body-md` | 16px / 400 | Running text |
| `--text-body-sm` | 14px / 400 | Card meta, captions |
| `--text-caption` | 14px / 500 | Input labels, segment labels |
| `--text-caption-sm` | 13px / 400 | Legal, timestamps |
| `--text-badge` | 11px / 600 | Floating badge text |
| `--text-button-md` | 16px / 500 | Primary CTA labels |
| `--text-button-sm` | 14px / 500 | Pill/secondary labels |
| `--text-nav-link` | 16px / 600 | Top nav links |

### 1.3 Color Palette

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#ff385c` | Primary CTA bg, heart saved, search button |
| `--color-primary-active` | `#e00b41` | Button press state |
| `--color-primary-disabled` | `#ffd1da` | Disabled primary button |
| `--color-ink` | `#222222` | Headlines, body, nav |
| `--color-body` | `#3f3f3f` | Long-form review copy |
| `--color-muted` | `#6a6a6a` | Sub-labels, inactive tabs |
| `--color-canvas` | `#ffffff` | Page floor, all surfaces |
| `--color-surface-soft` | `#f7f7f7` | Hover backgrounds, filter band |
| `--color-surface-strong` | `#f2f2f2` | Icon-button backgrounds |
| `--color-hairline` | `#dddddd` | Dividers, card borders |
| `--color-error` | `#c13515` | Form validation error text |
| `--color-scrim` | `rgba(0,0,0,0.5)` | Modal backdrop |

### 1.4 Spacing

`2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64px`. Card grids use 16px gutters. Major page sections use 64px vertical padding.

### 1.5 Responsive Breakpoints

| Name | Width | Grid |
|------|-------|------|
| Mobile | < 744px | 1 column |
| Tablet | 744–1128px | 2–3 columns |
| Desktop | 1128–1440px | 4+ columns |
| Wide | > 1440px | Content caps at 1440px, gutters absorb |

### 1.6 Accessibility Baseline

- All interactive elements are `<button>` or `<a>`. Never `<div onClick>`.
- Every image has `alt` text.
- Every form input has an associated `<label>`.
- Focus rings are visible. Never `outline: none` without a custom replacement.
- Minimum touch target: 48×48px for primary actions, 44×44px for secondary.
- Color contrast: WCAG AA minimum (`#6a6a6a` on white = 4.6:1 — passes AA).
- Error messages are announced by `role="alert"` for screen readers.

---

## Part 2 — Global Components

### 2.1 Customer Header (Public + Customer pages)

**Desktop layout (≥ 744px):**
```
[Vyapari logo]          [Search bar — pill shape]          [Wishlist ♡] [Cart 🛒] [Account ▼]
```
If logged out, right side shows: `[Login] [Sign Up]`

**Mobile layout (< 744px):**
```
[Vyapari logo]                                             [☰ Menu]
```
Below the logo row: a compact single-tap search pill (full-width).

**Logo:** `font: var(--text-display-md); color: var(--color-primary)`. Links to `/`.

**Search bar (desktop):**
- Pill shape (`border-radius: 9999px`), white fill, 1px hairline border, `var(--shadow-float)` at rest
- Placeholder: "Search products, brands and categories…"
- Right end: circular Rausch button (48×48px) with search icon
- On focus: border becomes 2px `var(--color-ink)`
- On submit: navigate to `/search?q=<value>`

**Search pill (mobile):**
- Single-tap pill showing "Search…" — clicking opens a full-screen search overlay
- Overlay has auto-focused text input, recent searches list, popular categories
- Closing overlay (swipe down or ✕) returns to previous page with no navigation

**Wishlist icon:** Heart outline. Shows badge count of wishlist items (max 99+). Logged-out: clicking opens Login Prompt Modal.

**Cart icon:** Shopping bag or cart icon. Shows badge count of cart items (max 99+). Logged-out: clicking opens Login Prompt Modal.

**Account dropdown (logged in):**
```
My Orders
My Wishlist
My Profile
Addresses
──────────
Logout
```
Dropdown: white card, `var(--shadow-float)`, `border-radius: 14px`, appears on click (not hover).

**Mobile menu sheet (< 744px):**
Sheet slides up from bottom. Contains: Explore / Categories / My Orders / Wishlist / Profile / Login or Logout.

**1px bottom border** separates header from page content.

**Sticky behavior:** Header sticks to top on all pages except the landing page hero (where it overlays transparently).

### 2.2 Seller Header

```
[Vyapari Seller]          [Search orders/products]          [🔔 N] [Store name ▼]
```
No customer nav (cart, wishlist). Always shows logged-in state. Notification bell with unread count badge.

**Store dropdown:**
```
View My Store (opens /products/:sellerId in customer view)
Settings
──────────
Logout
```

### 2.3 Admin Header

```
[Vyapari Admin]                                            [Admin name ▼]
```

### 2.4 Customer Footer (all public + customer pages)

3-column desktop, 1-column mobile (accordion). White surface, 48px top/80px sides padding.

```
Customer             Seller               Company
───────────          ──────────────       ──────────
Explore              Become a Seller      About
Categories           Seller Login         Contact
Orders               Seller Help          Terms
Wishlist                                  Privacy
Help
```

Legal band below: `© 2026 Vyapari · Terms · Privacy` — text at `--text-caption-sm`, `--color-muted`.

### 2.5 Toast Notifications

- Appear bottom-right desktop, bottom-center mobile
- Auto-dismiss after 4 seconds
- Manual dismiss (✕ button)
- Stack up to 3 visible; queue the rest
- Variants: `success` (green left border), `error` (red left border), `info` (blue left border), `warning` (orange left border)
- ARIA: `role="status"` for success/info, `role="alert"` for error/warning

### 2.6 Login Prompt Modal

Triggered when an unauthenticated user attempts a protected action (wishlist, cart, checkout).

```
┌────────────────────────────────────┐
│  ✕                                 │
│                                    │
│  Sign in to continue               │
│  You need an account to do this.  │
│                                    │
│  [  Continue with Email  ]         │
│                                    │
│  Don't have an account?            │
│  [ Create one ] — it's free        │
│                                    │
└────────────────────────────────────┘
```

Modal: white, `border-radius: 14px`, scrim backdrop, max-width 480px, centered. After login/signup: modal closes and the original action is automatically retried.

### 2.7 Confirmation Dialog

Used for destructive actions (delete address, remove from cart, archive product).

```
┌─────────────────────────────────┐
│  Remove from cart?              │
│  This item will be removed.     │
│                                 │
│  [Cancel]    [Remove]           │
└─────────────────────────────────┘
```

"Remove" is primary (`--color-error` fill for destructive), "Cancel" is secondary.

### 2.8 Skeleton Screens

Used while data is loading. Never show spinners for content that will populate a grid or list.

- Product cards: gray rounded rectangle (1:1 ratio) + 3 lines below
- Text lines: gray rounded rectangles of varying width (80%, 60%, 40%)
- Animation: subtle left-to-right shimmer using CSS animation
- Show after 200ms delay (prevents flash for fast loads)

### 2.9 Empty State Pattern

```
[Illustration — simple SVG, not stock photo]
Heading (what's missing)
Subtext (why and what to do)
[Primary CTA]
```
Examples:
- Cart: "Your cart is empty" + [Continue Shopping]
- Wishlist: "Nothing saved yet" + [Explore Products]
- Orders: "No orders yet" + [Start Shopping]
- Search results: "No results for 'X'" + [Clear Filters] or [Explore]

---

## Part 3 — Landing Page (`/`)

### 3.1 Purpose

Communicate what Vyapari is. Give two obvious paths: shop or sell.

### 3.2 Header (landing variant)

Transparent overlay on hero. Scrolling makes it white with `var(--shadow-float)`.

```
Vyapari                 Explore    Become a Seller             Login   Sign Up
```
Mobile: `Vyapari` + `☰`. Menu sheet has all links.

### 3.3 Hero Section

```
Your marketplace,
intelligently personalized.

Discover products curated just for you.
AI-powered recommendations that get smarter with every visit.

[  Explore Products  ]
```

- Headline: `--text-display-xl` (28px / 700)
- Subline: `--text-body-md` (16px / 400), `--color-muted`
- CTA button: primary, links to `/explore`
- Background: white canvas with a subtle grid of blurred product images as decorative background (opacity 8%, not distracting)
- Mobile: same layout, centered, full-width CTA button

### 3.4 Discovery Preview

```
Explore what people are buying

[ Electronics ] [ Fashion ] [ Home & Living ] [ Beauty ] [ Sports ] ...
```
Category pills: `border-radius: 32px`, `--color-surface-soft` fill, `--color-ink` text. Clicking navigates to `/categories/:slug`.

Below: 4-card grid of trending products. On mobile: horizontal scroll strip.

- Data source: `GET /api/recommendations/popular?limit=4`
- Loading: 4 skeleton cards
- Error: hide section silently (don't show error on landing page)

### 3.5 Seller CTA Band

```
Grow your business with Vyapari

Sell smarter with AI-powered listing creation,
inventory insights, and automated customer support.

[ Start Selling ] [ Learn More ]
```
- Background: `--color-surface-soft`
- Primary CTA → `/register` (pre-selects seller role)
- Secondary text link → `/about` (or `/seller/register` if that's the onboarding route)

### 3.6 Footer

Standard 3-column footer as defined in §2.4.

### 3.7 Acceptance Criteria

- [ ] Page loads without authentication
- [ ] Popular products load within 2s on a standard connection
- [ ] CTA navigates to `/explore`
- [ ] Seller CTA navigates to registration with seller role pre-selected
- [ ] Header goes from transparent to white on scroll
- [ ] Mobile layout: all CTAs full-width, no horizontal scroll on body

---

## Part 4 — Authentication

### 4.1 Login Page (`/login`)

**Layout:** Centered card, max-width 480px, white surface, `border-radius: 14px`, `var(--shadow-float)`.

```
Vyapari

Welcome back

Email
[________________________________]

Password
[________________________________]  [👁 show/hide]

[ Log in ]

Forgot password? → /forgot-password

──────────────

Don't have an account?
[ Create account ]

Want to sell?
[ Become a seller ]
```

**Field validation (inline, not on submit):**
| Field | Rule | Error message |
|-------|------|---------------|
| Email | Required, valid email format | "Enter a valid email address" |
| Password | Required, min 1 char | "Enter your password" |

**Submit behavior:**
```
[Log in] clicked
  ├── Client validation fails → show inline errors, do not call API
  └── Validation passes → POST /api/auth/login
        ├── 200 → store access token in memory, refresh token in httpOnly cookie
        │         → redirect based on role:
        │             customer → /explore
        │             seller   → /seller/dashboard
        │             admin    → /admin
        ├── 401 → "Incorrect email or password" — shown below password field
        ├── 403 → "Your account has been suspended. Contact support."
        └── network error → "Something went wrong. Please try again." + retry button
```

**Accessibility:**
- `<label>` associated with each input via `for`/`id`
- Password field `type="password"`, toggle changes to `type="text"`
- `Enter` key submits form
- Error messages `role="alert"`

**Redirect:** If already logged in, redirect immediately to role-appropriate home. Never show login page to logged-in users.

**Mobile:** Full-width card on white canvas, same layout.

### 4.2 Register Page — Role Chooser (`/register`)

```
Create your Vyapari account

I want to:

┌──────────────────────┐  ┌──────────────────────┐
│  🛍                  │  │  🏪                  │
│  Shop on Vyapari     │  │  Sell on Vyapari     │
│  Browse and purchase │  │  List products and   │
│  products            │  │  grow your business  │
└──────────────────────┘  └──────────────────────┘

Already have an account? Log in
```

- Both cards are `<button>` elements
- Customer card → `/register/customer`
- Seller card → `/register/seller`
- If landing via the "Start Selling" CTA, the seller card is pre-highlighted

### 4.3 Customer Registration (`/register/customer`)

```
Create customer account

Full name *
[________________________________]

Email *
[________________________________]

Phone
[________________________________]

Password *
[________________________________]  [👁]

Confirm password *
[________________________________]  [👁]

☐ I agree to the Terms of Service and Privacy Policy *

[ Create Account ]

Already have an account? Log in
```

**Validation (inline on blur, summary on submit):**
| Field | Rules | Error |
|-------|-------|-------|
| Full name | Required, 2–120 chars, letters + spaces | "Enter your full name" |
| Email | Required, valid format | "Enter a valid email" / "This email is already registered" (on API 409) |
| Phone | Optional, 10-digit Indian format if provided | "Enter a valid phone number" |
| Password | Required, min 8 chars, at least 1 digit | "Password must be at least 8 characters with a number" |
| Confirm password | Must match password | "Passwords do not match" |
| Terms | Must be checked | "You must agree to the terms" |

**Submit:**
```
POST /api/auth/register {name, email, phone, password, role: 'customer'}
  ├── 201 → auto-login → /explore → success toast "Welcome to Vyapari!"
  ├── 409 → inline: "An account with this email already exists. Log in?"
  └── network error → "Something went wrong. Please try again."
```

### 4.4 Seller Registration — 4-Step Onboarding (`/register/seller`)

Step indicator at top: `① Account → ② Store → ③ Done`

**Step 1 — Account:**
Same fields as customer registration but with `role: 'seller'`. On step submit, call `POST /api/auth/register`. Success → store token, move to Step 2.

**Step 2 — Store Setup:**
```
Set up your store

Store name *
[________________________________]
Hint: This is what customers will see

Store description
[________________________________]
                                                (280 chars max)

Primary category *
[ Select category ▼ ]

[ Continue ] [ Back ]
```
Data source for categories: `GET /api/categories` (loads on page mount).
On continue: `PUT /api/seller/profile {store_name, description, primary_category}`. On success → Step 3.

**Step 3 — Done:**
```
✓ Your store is ready!

[Store name]

Your store is now live on Vyapari.
You can start listing products right away.

[ Go to Dashboard ]
```
Clicking "Go to Dashboard" → `/seller/dashboard`.

**Back navigation:** Each step has a Back button that does NOT lose already-entered data (keep in local state or URL params). Browser back button triggers a browser confirm if form has unsaved changes.

### 4.5 Forgot Password (`/forgot-password`)

```
Forgot your password?

Enter your email and we'll send a reset link.

Email *
[________________________________]

[ Send Reset Link ]

← Back to login
```

**Submit:**
```
POST /api/auth/forgot-password {email}
  ├── 200 (always, even if email not found — don't confirm existence)
  │     → "If that email is registered, you'll receive a reset link."
  └── network error → retry prompt
```

### 4.6 Reset Password (`/reset-password?token=<JWT>`)

On mount: validate token. If invalid/expired → "This link has expired. Request a new one." + link back to forgot-password.

```
Set new password

New password *
[________________]  [👁]

Confirm new password *
[________________]  [👁]

[ Set Password ]
```

**Submit:**
```
POST /api/auth/reset-password {token, newPassword}
  ├── 200 → "Password updated. You can now log in." + redirect to /login after 2s
  ├── 400 → "This link is invalid or expired."
  └── network error → retry prompt
```

---

## Part 5 — Customer: Explore (`/explore`)

### 5.1 Layout

Header (customer variant) + main content + footer.

Max content width 1280px, centered. Vertical section padding 64px.

### 5.2 Category Navigation Bar

Sticky below header. Horizontal scroll on mobile.

```
All | Electronics | Fashion | Home & Living | Beauty | Books | Sports | Groceries | ...
```

- Pill-shaped tabs, `border-radius: 32px`
- Active tab: `--color-ink` fill, white text, no transition (instant)
- Inactive tab: `--color-surface-soft` fill, `--color-ink` text
- Clicking a tab sets `?category=electronics` in URL and filters all sections below
- Data source: `GET /api/categories` (cached after first load)

### 5.3 Content Sections — State-Dependent

**Logged out / New customer (< 5 interactions):**
1. Popular right now (GET /api/recommendations/popular?limit=8)
2. Top categories grid
3. New arrivals (GET /api/products?sort=newest&limit=8)
4. Trending products (GET /api/recommendations/trending?limit=8)

**Returning customer (≥ 5 interactions):**
1. Recommended for you (GET /api/recommendations/home/:userId)
2. Because you viewed [Product name] (GET /api/recommendations/similar/:lastViewedId?limit=6)
3. Trending in [Top category] (GET /api/recommendations/trending?category=X&limit=8)
4. Popular near you (GET /api/recommendations/geo?pincode=:userPincode&limit=8 — if pincode known)

Each section:
- `--text-display-md` heading (21px / 700)
- Reason label under heading in `--text-body-sm --color-muted` (e.g., "Based on your recent activity")
- [View all →] link right-aligned, navigates to `/search?reason=trending&category=X`
- Product card grid: 4-up desktop, 2-up tablet, 2-up mobile (with horizontal scroll)

**Section loading:** Each section loads independently. Show skeleton while loading. If a section fails, hide it silently — don't show error for recommendation failures.

### 5.4 Product Card Component

```
┌───────────────────────────┐
│ [SALE]              [♡]   │  ← both positioned absolute
│                           │
│       Product image       │  ← aspect-ratio: 1/1, object-fit: cover
│      (rounded 14px)       │
│                           │
└───────────────────────────┘
Product title (2 lines max, truncate)   [--text-title-md]
Seller name                              [--text-body-sm, --color-muted]
★★★★☆ 4.6 (124)                        [--text-body-sm]
₹1,299                                   [--text-title-md]
Free delivery                            [--text-body-sm, --color-muted]
```

**Badge rules (top-left of image, absolute):**
- `SALE`: red pill badge — show if `discount > 0`
- `NEW`: grey pill badge — show if product created within last 14 days
- `LOW STOCK`: amber pill badge — show if `stock_qty ≤ 5 AND stock_qty > 0`
- Only one badge shown at a time. Priority: SALE > LOW STOCK > NEW

**Heart icon (top-right of image, absolute):**
- Default: outline heart, `--color-canvas` with slight shadow
- Saved: filled heart, `--color-primary`
- Clicking while logged out → Login Prompt Modal (§2.6)
- Clicking while logged in → toggle wishlist, optimistic UI update, API call in background
- On API failure → revert optimistic update, show error toast

**Card interactions:**
- Entire meta block below image: `<a href="/products/:id">` — keyboard focusable
- Image area: `<a href="/products/:id">`
- Heart: `<button>` — independent of card navigation
- Do NOT wrap the entire card in a single `<a>` (prevents independent heart interaction)

**Card hover state (desktop only):**
- `box-shadow: var(--shadow-float)` transitions in over 150ms ease-out
- Slight scale: `transform: scale(1.01)` on the image (not the whole card)

**Accessibility:**
- `aria-label="Add [Product Name] to wishlist"` on heart button
- `alt="[Product Name]"` on image

### 5.5 Acceptance Criteria

- [ ] Page loads without authentication
- [ ] Logged-out users see popular/trending (not personalized)
- [ ] Returning users see personalized sections
- [ ] Category bar filters all sections simultaneously
- [ ] Heart toggle works without page navigation
- [ ] Heart while logged out shows Login Prompt, not redirect
- [ ] Section failures don't break the page
- [ ] Mobile: category bar scrolls horizontally, cards show 2-up

---

## Part 6 — Customer: Search (`/search`)

### 6.1 URL Structure

`/search?q=wireless+headphones&category=electronics&minPrice=500&maxPrice=5000&rating=4&inStock=true&sort=relevance&page=1`

All filter state lives in the URL. Sharing the URL reproduces the exact search state.

### 6.2 Layout

Desktop: left sidebar (filters, 280px fixed) + main area (results).
Mobile: no sidebar — filter/sort buttons open sheets.

### 6.3 Search Header

```
Search results for "wireless headphones"       54 results

Sort: [ Relevance ▼ ]
```

Sort options: Relevance / Price: Low → High / Price: High → Low / Rating / Newest / Popular

**User-chosen sort overrides recommendation ranking completely.**

### 6.4 Filter Panel (Desktop Sidebar)

```
Filters                         [Clear all]

Category
□ Electronics (42)
□ Audio (12)
□ Accessories (8)

Price Range
₹ [Min] ─────────────── [Max]
₹500          ₹5,000

Rating
○ 4★ & above
○ 3★ & above
○ All ratings

Availability
□ In stock only

Seller
□ Verified sellers only
```

- Checking any filter updates URL and re-fetches results immediately (no "Apply" button on desktop)
- Each checkbox shows result count in muted text
- Price range: two number inputs + range slider. Inputs update slider; slider updates inputs.
- Applying a filter logs a `click` interaction if a product card is then clicked (not for filter application itself)

**Filter sheet (Mobile):**
Full-screen bottom sheet. Has "Apply Filters" button at bottom. Changes don't apply until "Apply" is clicked. Shows active filter count on the trigger button: `Filters (3)`.

**Sort sheet (Mobile):**
Small bottom sheet with sort options as radio buttons. Applies immediately on selection.

### 6.5 Search Results Grid

- Desktop: 4 columns
- Tablet: 2–3 columns
- Mobile: 2 columns

Product cards (§5.4). Pagination: infinite scroll ("Load more" button at bottom, not auto-scroll-load).

### 6.6 Search Logic

API call: `GET /api/recommendations/search?q=wireless+headphones` combines:
1. Semantic embedding search over `product_embeddings`
2. Text search over `products.title` (PostgreSQL ILIKE)

Results merged, deduped, ranked by score. Then filtered by URL params server-side.

### 6.7 States

**Loading:** Show 8 skeleton cards in grid.

**No results:**
```
No results for "wireless heaphones"

Did you mean: "wireless headphones"?

Try:
· Removing some filters
· Checking your spelling
· Using more general terms

[ Clear Filters ]  [ Explore Popular Products ]
```

**Error:**
```
Search isn't available right now.
[ Try Again ]
```

### 6.8 Acceptance Criteria

- [ ] URL is shareable and reproduces search state
- [ ] Sort choice is respected and overrides AI ranking
- [ ] Filter changes update URL and results without full page reload
- [ ] Empty state gives actionable guidance
- [ ] Mobile: filters/sort open sheets

---

## Part 7 — Customer: Product Detail (`/products/:id`)

### 7.1 Layout

Max content width 1080px, centered.

Desktop: 2-column.
- Left (60%): gallery → description → attributes → seller card → reviews → similar products
- Right (40%, sticky top: 80px header height + 16px): purchase panel

Mobile: single column, top to bottom. Purchase panel becomes a sticky bottom bar.

### 7.2 Product Gallery

```
┌─────────────────────────────┐
│                             │
│       Main image            │  ← aspect 4:3, object-fit: cover, border-radius: 14px
│                             │
└─────────────────────────────┘
[thumb1] [thumb2] [thumb3] [thumb4]   ← thumbnails, 64×64px, border-radius: 8px
```

**Interactions:**
- Click thumbnail → swap main image (no animation, immediate)
- Click main image → open fullscreen lightbox (scrim backdrop, close with ✕ or Escape)
- Lightbox: keyboard arrows navigate between images
- `< >` prev/next buttons on main image (desktop)
- Swipe left/right on main image (touch devices)
- Images loaded lazily (`loading="lazy"` on all but first)

### 7.3 Product Information Panel

```
Electronics > Audio > Headphones      ← breadcrumb, --text-body-sm, --color-muted
                                        clicking any crumb navigates to category

Wireless Noise-Cancelling Headphones  ← --text-display-lg (22px / 500)

★★★★☆  4.6  (124 reviews)           ← clicking "(124 reviews)" scrolls to reviews section
Sold by XYZ Store

₹1,299        ~~₹1,999~~  35% off    ← price --text-display-md, strikethrough for original

Stock status:
  • In stock               (stock > 5)
  • Only 3 left!           (1 ≤ stock ≤ 5) [--color-error text]
  • Out of stock           (stock = 0 or status = out_of_stock)

Quantity:  [–]  1  [+]

[ Add to Cart ]     [ ♡ Save ]

[ Buy Now ]
```

**Quantity selector rules:**
- Min: 1
- Max: `Math.min(10, stock_qty)` — never allow quantity > available stock
- `–` disabled at 1, `+` disabled at max
- `+` at max: shows tooltip "Maximum quantity reached"
- Manual input: accepted if within 1–max range, rounds otherwise

**Add to Cart states:**
```
Logged out
  → Login Prompt Modal (§2.6)
  → After login → retry Add to Cart automatically

Logged in, in stock, quantity valid
  → Button shows spinner (disable button during request)
  → POST /api/cart/items {productId, quantity}
    ├── 200 → success toast "Added to cart", cart badge count increments, button returns to normal
    ├── 409 INSUFFICIENT_STOCK → show "Only N left" inline, update quantity selector max, do not add
    └── network error → "Couldn't add to cart. Try again." toast, button returns to normal

Logged in, out of stock
  → Button replaced with "Notify Me" (stores interest, not in MVP — show as disabled with tooltip)

Already at maximum quantity in cart
  → Button shows "In cart (max)" — disabled
```

**Buy Now:**
```
Logged out → Login Prompt Modal
Logged in  → add to cart → navigate to /checkout directly
```

**Wishlist (♡ Save):**
- Same behavior as product card heart (§5.4)
- Heart shows filled state if product is already in wishlist (check on page load)
- API: POST/DELETE /api/wishlist/items

### 7.4 Delivery Information Panel

```
Delivery

Pincode
[ 208001 ] [ Check ]

📦 Estimated delivery by Thu, 25 Sep
↩ 7-day return policy
```

- Pincode input: 6 digits, numeric only
- "Check" button: client-side lookup (use address pincode if logged in and address exists)
- Delivery estimate: static calculation (order date + 5–7 business days) — not real logistics API
- Return policy: links to seller's return policy if set; else platform default

### 7.5 Seller Card

```
Sold by

[Store logo/avatar]  XYZ Store           [ View Store → ]
                     ★★★★☆  4.7
                     Verified Seller · 156 products
```

- Clicking "View Store" → `/search?seller=:sellerId` (filter search to that seller)
- "Verified Seller" badge shows if `seller_profiles.is_verified = true`

### 7.6 Product Description

Expandable long text. First 3 lines visible. "Read more" expands (no page jump). "Read less" collapses.

### 7.7 Product Specifications

Table format:
```
Brand         Sony
Connectivity  Bluetooth 5.0
Battery       30 hours
Weight        250g
```
Data from `products.attributes` JSONB. If empty: section hidden.

### 7.8 Reviews Section

```
Customer Reviews

4.6 ★  out of 5
124 reviews

Rating distribution:
5★  ████████████████ 72%
4★  ████████         15%
3★  ████             8%
2★  ██               3%
1★  █                2%

Sort: [ Most Helpful ▼ ]     [ Write a Review ]

───────────────────────────────────────────

[Avatar]  Rahul K.           ★★★★★
          Verified Purchase   18 Sep
          "Excellent sound quality, very comfortable..."
          [ Show more ]

[Avatar]  Ananya M.          ★★★★☆
          18 Sep
          "Great value for money..."

[ Load more reviews ]
```

**"Write a Review" button:**
- Logged out → Login Prompt Modal
- Logged in, no delivered order → disabled button with tooltip "Purchase this product to write a review"
- Logged in, has delivered order, no existing review → opens review form modal
- Logged in, already reviewed → shows "You reviewed this product" — no second review

**Review form modal:**
```
Rate this product

☆ ☆ ☆ ☆ ☆    ← interactive stars, hoverable

Share your experience (optional)
[____________________________________]
[____________________________________]
[____________________________________]

[ Cancel ]  [ Submit Review ]
```

**Submit:**
```
POST /api/products/:id/reviews {rating, comment, orderId}
  ├── 201 → modal closes, review appears inline, toast "Review submitted. Thank you!"
  ├── 403 → "You need to purchase this product before reviewing."
  ├── 409 → "You've already reviewed this product."
  └── network error → retry prompt within modal
```

**Pagination:** "Load more reviews" button. Loads next 5 reviews. Appends to list (not replace).

### 7.9 Similar Products

```
You may also like

[Product] [Product] [Product] [Product]
```
Data: `GET /api/recommendations/similar/:productId?limit=4`
Loading: 4 skeleton cards
Error: section hidden silently

### 7.10 Interaction Event Logging

On mount, after product data successfully renders:
```
POST /api/recommendations/interactions {productId, eventType: 'view'}
```
Fire and forget. On failure: no retry, no UI impact.

### 7.11 Mobile Behavior

- Single column: gallery (image only, no thumbnails visible — dot navigation instead) → info → purchase panel → seller → description → specs → reviews → similar
- Sticky bottom bar replaces the right-rail purchase panel:

```
₹1,299                      [ Add to Cart ]
```

Bar: white, `var(--shadow-float)`, 80px height. "Add to Cart" full behavior as desktop.

### 7.12 Status: Archived Product

If `product.status = 'archived'`: return 404 from API. Frontend shows 404 page.

### 7.13 Acceptance Criteria

- [ ] Page loads without authentication
- [ ] Gallery: all images navigable by keyboard and touch
- [ ] Quantity selector cannot exceed stock
- [ ] Add to Cart: correct behavior for all 5 states (logged out / success / stock conflict / out of stock / at max)
- [ ] "Write a Review" gated on purchase + delivery + no prior review
- [ ] Similar products section loads independently
- [ ] `view` interaction logged once on successful page render
- [ ] Mobile: sticky bottom bar shows for purchase actions
- [ ] Archived products → 404

---

## Part 8 — Customer: Wishlist (`/wishlist`)

### 8.1 Layout

Header + main (max 1280px) + footer.

```
My Wishlist                             12 saved items

[Product cards grid — 4-up desktop, 2-up mobile]
```

### 8.2 Product Card (Wishlist Variant)

Same as standard card (§5.4) plus:
- ♡ filled (always, since all items are wishlisted)
- `[Add to Cart]` button below meta
- `[Remove]` text link (tertiary style)

**If product is unavailable** (`status = out_of_stock` or `status = archived`):
```
[Product card — image grayed out, 50% opacity]
Currently unavailable
[ Remove ]
```

**Add to Cart from wishlist:** Same behavior as from product detail (§7.3). Does NOT remove from wishlist after adding to cart.

**Remove:**
```
DELETE /api/wishlist/items/:productId
  → Optimistic removal (item disappears immediately)
  → On failure: revert, show error toast
```

No confirmation dialog for remove — it's easily reversible by re-adding from the product page.

### 8.3 Empty State

```
[Heart icon illustration]
Nothing saved yet

Save products you love and find them here.

[ Explore Products ]
```

### 8.4 Data Source

`GET /api/wishlist` — returns wishlist items with full product data including current status.

On load: if any product is no longer available, show the "Currently unavailable" state.

### 8.5 Acceptance Criteria

- [ ] All wishlisted items display with current availability status
- [ ] Unavailable items shown visually distinct, cannot be added to cart
- [ ] Remove is optimistic with rollback on failure
- [ ] Empty state shown when list is empty

---

## Part 9 — Customer: Cart (`/cart`)

### 9.1 Layout

2-column desktop: cart items (left ~65%) + order summary sticky panel (right ~32%).
Single column mobile: items → summary.

### 9.2 Cart Items

```
My Cart                                 3 items

┌─────────────────────────────────────────────────────┐
│ [Image 80×80px]  Wireless Headphones                │
│  border-r: 14px  Sold by XYZ Store                  │
│                  ₹1,299                              │
│                  Qty: [–] 2 [+]   ₹2,598            │
│                                                     │
│                  [Remove]  [Save for later]         │
└─────────────────────────────────────────────────────┘
```

**Per-item enrichment flags** (from `GET /api/cart` enriched response):

| Flag | Display |
|------|---------|
| `productDeleted` | Red banner: "This product is no longer available." + [Remove] button. Quantity locked. |
| `stockReduced` (new max < current qty) | Amber banner: "Only N left. Quantity updated to N." Auto-updates quantity. |
| `status = out_of_stock` | Amber banner: "Currently out of stock." Quantity locked, cannot proceed with this item. |
| `priceChanged` | Info banner: "Price updated from ₹X to ₹Y." |

**Quantity change:**
```
PUT /api/cart/items/:id {quantity: N}
  ├── 200 → update displayed totals
  └── 409 INSUFFICIENT_STOCK → show enrichment flag, revert to max available
```

**Remove:**
```
Confirmation dialog: "Remove from cart? This item will be removed."
[Cancel]  [Remove]

DELETE /api/cart/items/:id
  → Optimistic removal
  → On failure: revert, error toast
```

**Save for later:** Moves item to wishlist. `POST /api/wishlist/items {productId}` + `DELETE /api/cart/items/:id`. If user not logged in — not applicable (cart requires auth). Shows in wishlist page.

### 9.3 Order Summary Panel

```
Order Summary

Subtotal (3 items)              ₹3,897
Delivery                        Free
Discount                       –₹500
──────────────────────────────────────
Total                          ₹3,397

[ Proceed to Checkout ]

🔒 Secure checkout
```

- Panel is sticky on desktop (sticks as user scrolls items)
- Totals recalculate instantly on any quantity change
- "Proceed to Checkout" disabled if any item has `productDeleted: true` or `status: out_of_stock`
  - If disabled: tooltip "Remove unavailable items to continue"

### 9.4 Empty State

```
[Cart illustration]
Your cart is empty

Add products to your cart to see them here.

[ Continue Shopping → /explore ]
```

### 9.5 Acceptance Criteria

- [ ] All enrichment flags display correctly
- [ ] Quantity changes update totals immediately
- [ ] Cannot proceed to checkout with unavailable items
- [ ] Remove triggers confirmation dialog
- [ ] Sticky summary panel on desktop
- [ ] Mobile: single column layout

---

## Part 10 — Customer: Checkout (`/checkout`)

### 10.1 Step Indicator

```
① Address  →  ② Review  →  ③ Payment
```

Step indicator at top. Completed steps: filled circle. Current: filled + underline. Future: empty circle.

### 10.2 Step 1 — Address

```
Delivery address

Saved addresses:

◉ Home
  Rahul Kumar
  12, Gandhi Nagar, Kanpur 208001, UP
  [Edit]

○ Work
  Rahul Kumar
  45, Civil Lines, Lucknow 226001, UP
  [Edit]

[ + Add New Address ]

                              [ Continue ]
```

**Add New Address form (inline accordion, not modal):**
```
Full name *
Phone *
Address line *
City *         State *
Pincode *

[ Save & Use This Address ]  [ Cancel ]
```

Validation: all required fields, pincode 6 digits. On save: `POST /api/addresses` → adds to list + auto-selects.

"Continue" disabled until an address is selected. Clicking Continue → moves to Step 2.

### 10.3 Step 2 — Order Review

```
Review your order

Delivering to:
Rahul Kumar
12, Gandhi Nagar, Kanpur 208001, UP
[Change →]   ← returns to Step 1

Items (3):

[Image]  Wireless Headphones × 2      ₹2,598
[Image]  Phone Case × 1                ₹299

Subtotal                               ₹2,897
Delivery                               Free
Discount                              –₹500
──────────────────────────────────────────────
Total                                  ₹2,397

                  [ Back ]  [ Continue to Payment ]
```

Clicking "Change →" returns to Step 1 without losing state. All items are read-only here.

### 10.4 Step 3 — Payment

```
Payment

Order total: ₹2,397

[ Pay ₹2,397 ]

🔒 Secured by [Gateway name]
```

No custom payment form. Use the gateway's hosted checkout or SDK (Razorpay or Stripe).

**Pay button states:**
```
[Pay ₹2,397] clicked
  → POST /api/payments/create {orderId}
    ├── success → open gateway checkout SDK/redirect
    └── error → "Couldn't initiate payment. Please try again."

Gateway payment flow:
  ├── User completes payment
  │     → Gateway webhook fires → backend updates order status
  │     → Frontend redirected to /orders/:id with ?payment=success
  │
  ├── User cancels payment
  │     → Return to /checkout at Step 3 → toast "Payment cancelled. You can try again."
  │
  ├── Payment fails (card declined etc.)
  │     → Return to /checkout at Step 3 → toast "Payment failed: [gateway reason]. Try again."
  │
  └── User closes browser (webhook fires later)
        → /orders/:id shows status 'pending' with "Verifying payment..." state
        → Single status check on page load (§C3)
```

### 10.5 After Successful Payment (`/orders/:id?payment=success`)

```
✓ Order placed successfully!

Order #VY-20260918-12345
Estimated delivery: Thu 24 Sep – Sat 27 Sep

[ Track Order ]       [ Continue Shopping ]
```

Toast: "Your order has been placed!" (auto-dismisses after 5s).

The `?payment=success` query param triggers the success banner. Subsequent visits to the same URL without the param show the normal order detail.

### 10.6 Acceptance Criteria

- [ ] Cannot skip steps (step 2 is inaccessible without address selection)
- [ ] Address form validates all required fields
- [ ] Order review shows correct totals matching cart
- [ ] Payment initiation shows loading state and disables button
- [ ] All 4 payment outcomes handled with correct UI feedback
- [ ] After success: order confirmation shown with order number

---

## Part 11 — Customer: Orders (`/orders`)

### 11.1 Layout

```
My Orders

[ All | Processing | Shipped | Delivered | Cancelled ]

Order #VY-12345                         18 Sep 2026
2 items · ₹2,397                        Status: Shipped

[Product thumb] Wireless Headphones
[Product thumb] Phone Case

                                        [ View Order ]

────────────────────────────────────────────────────────

Order #VY-12200                         10 Sep 2026
1 item · ₹899                           Status: Delivered

                                        [ View Order ]
                                        [ Write Review ]   ← only when delivered
```

- Tabs filter by order status
- "Write Review" shortcut for delivered orders (navigates to `/products/:id` with review modal auto-open)
- Data source: `GET /api/orders?status=<tab>` paginated, limit 10
- Loading: skeleton order cards
- Empty state per tab: "No [status] orders" with appropriate CTA

### 11.2 Order Detail (`/orders/:id`)

```
← My Orders                                         Order #VY-12345

Placed on: 18 Sep 2026                      Status: Shipped

Timeline:
● Order placed             18 Sep, 8:12 PM
● Payment confirmed        18 Sep, 8:13 PM
● Processing               19 Sep, 10:00 AM
● Shipped                  20 Sep, 2:15 PM
○ Out for delivery
○ Delivered

Estimated delivery: Thu 25 Sep – Sat 27 Sep

──────────────────────────────────────────────

Items:

[Image]  Wireless Headphones × 2    ₹2,598  [View Product]
[Image]  Phone Case × 1              ₹299   [View Product]

──────────────────────────────────────────────

Delivery address:
Rahul Kumar
12, Gandhi Nagar, Kanpur 208001, UP

──────────────────────────────────────────────

Payment:
Paid via [Gateway]                   ₹2,397
Transaction ID: pay_XXXX

──────────────────────────────────────────────

Actions:
[Cancel Order]   ← only if status is 'pending' or 'paid'
```

**Cancel Order:**
- Confirmation dialog: "Cancel this order? This action cannot be undone."
- `POST /api/orders/:id/cancel`
- Success: status updates to 'cancelled', Cancel button disappears, toast "Order cancelled."
- Only visible if `status === 'pending' || status === 'paid'`

**Timeline:** Powered by `order_status_history` rows. Only completed statuses show filled dots. Current status dot is filled + pulsing animation. Future statuses: empty dot, muted text.

**Loading:** Full-page skeleton (timeline as gray lines, items as gray rectangles).

**Not found / wrong user:** 404 page.

---

## Part 12 — Customer: Account (`/account`)

### 12.1 Navigation

Sidebar (desktop) / top tabs (mobile):
```
Profile
Addresses
Security
Notifications
```

### 12.2 Profile (`/account`)

```
[Avatar — initials-based, no upload in MVP]

Rahul Kumar
rahul@example.com
+91 98765 43210

[ Edit Profile ]
```

Edit mode (inline, not modal):
```
Full name    [____________]
Phone        [____________]

[ Save ]  [ Cancel ]
```

`PUT /api/users/:id {name, phone}` — email cannot be changed.

### 12.3 Addresses (`/account/addresses`)

```
Saved Addresses                   [ + Add Address ]

┌─────────────────────────────────────┐
│ 🏠 Home                  [Edit] [Delete] │
│ Rahul Kumar, +91 98765 43210          │
│ 12 Gandhi Nagar, Kanpur 208001, UP    │
│ ★ Default address                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🏢 Work                  [Edit] [Delete] │
│ 45 Civil Lines, Lucknow 226001, UP   │
│ [ Set as default ]                   │
└─────────────────────────────────────┘
```

- Edit opens inline form (accordion), not modal
- Delete: Confirmation dialog. Cannot delete the default address if it's the only address.
- "Set as default": `PUT /api/addresses/:id {is_default: true}` (backend clears previous default)

### 12.4 Security (`/account/security`)

```
Change Password

Current password    [__________]
New password        [__________]  [👁]
Confirm password    [__________]  [👁]

[ Update Password ]
```

`PUT /api/users/:id/password {currentPassword, newPassword}` — 400 if current password wrong.

### 12.5 Notifications (`/account/notifications`)

```
Notification Preferences

Order updates                 [Toggle ON]
Promotions and offers         [Toggle OFF]
```

MVP: these are display preferences stored locally (no backend notification preferences table needed). The actual notifications are always sent server-side for order events.

---

## Part 13 — Seller: Onboarding

Covered in §4.4 (seller registration flow). After completing onboarding, seller lands at `/seller/dashboard` with a first-time experience:

```
Welcome to your store, [Store Name]! 🎉

Your store is set up. Here's what to do next:

① Add your first product        [Add Product]
② Set up return/shipping policy [Set up Policies]
③ Explore your AI Assistant     [Open AI Assistant]
```

This banner is shown only once (dismissed state stored in `localStorage`).

---

## Part 14 — Seller: Dashboard (`/seller/dashboard`)

### 14.1 Layout

Left sidebar (240px fixed, desktop) + main content area.

**Sidebar:**
```
[Store logo/initials]
[Store name]

Dashboard
Products
Orders
Inventory
Analytics
Messages
AI Assistant
Approvals  [3]   ← badge for pending items
Settings
```

### 14.2 Dashboard Home

**Stats row:**
```
Orders today    Revenue today    Active products    Low stock
    24              ₹18,450              86               7
```

Each stat card: white, `border-radius: 14px`, `var(--shadow-float)`. Clicking navigates to relevant section.

**Sales chart:**
7-day or 30-day revenue line chart. Toggle buttons: `7D | 30D`. Simple SVG chart (no external charting library needed — use Recharts or a simple custom SVG).

**Recent orders table (last 5):**
```
Order #    Customer       Items   Amount   Status      Action
VY-12345   Rahul K.       2       ₹2,397   Shipped     [View]
```

**Low stock alerts:**
```
Product                   Stock   Trend
Wireless Headphones       5       ↑ Rising    [View]
Phone Case                2       → Stable    [View]
```

**Pending AI approvals (if any):**
```
AI Assistant needs your attention

3 items are waiting for your review.

[Review Now]  → /seller/approvals
```

### 14.3 Mobile Sidebar

Collapses to hamburger icon. Opens as full-screen overlay panel.

---

## Part 15 — Seller: Products (`/seller/products`)

### 15.1 Header

```
Products                       [ + Add Product ]  [ Create with AI ]
```

### 15.2 Filter Tabs

```
All (86) | Active (72) | Draft (6) | Out of Stock (5) | Archived (3)
```

### 15.3 Product Table

```
[□] Product               Stock    Price    Status       Updated       Actions
[□] [img] Wireless HD     12       ₹1,299   Active       2h ago        [Edit] [⋮]
[□] [img] Phone Case      0        ₹299     Out of Stock Yesterday     [Edit] [⋮]
[□] [img] New Listing     –        ₹499     Draft        Just now      [Edit] [⋮]
```

**Overflow menu (⋮):**
```
Edit
Duplicate         ← creates a copy in Draft status
Archive           ← confirmation dialog
View on Vyapari   ← opens /products/:id in new tab
```

**Bulk actions (when items checked):**
```
3 selected    [Archive]  [Delete]  [✕ Clear selection]
```

**Search within products:**
```
[ Search your products... ]
```
Client-side search over loaded products (no API call for search within seller's own product list if < 200 products; else paginated API search).

### 15.4 Loading and Empty States

- Loading: skeleton table rows (8 rows with gray rectangles)
- Empty (All tab): "No products yet. [Add Product] or [Create with AI]"
- Empty (filtered tab): "No [Draft] products. [Clear filter]"

---

## Part 16 — Seller: Create/Edit Product — Manual (`/seller/products/new`, `/seller/products/:id/edit`)

### 16.1 Layout

```
← Products    Create Product

[ Save Draft ]                    [ Publish ]
```

Two-column desktop: form (left, ~65%) + live preview panel (right, ~32%, shows how card will look).

### 16.2 Form

**Images:**
```
Product Images *

[ Drop images here or click to upload ]

[img1 ✕] [img2 ✕] [img3 ✕] [+ Add more]

First image is the cover. Drag to reorder.
```
- Max 8 images
- Accepted: JPG, PNG, WebP
- Max 5MB per image
- On upload: `POST /api/uploads` → returns URL → stored in `images[]`

**Basic Information:**
```
Title *
[________________________________________________]
                                        (200 chars max)

Category *
[ Select category ▼ ]   → shows full category tree

Price *         Original Price (optional — for discount display)
[₹ ________]   [₹ ________]

Stock quantity *
[________]
```

**Description:**
```
Description *
[Textarea — 2000 chars max]
```

**Attributes (optional):**
```
Specifications

Brand       [________________]
Colour      [________________]
[ + Add more specifications ]
```
Dynamic key-value pairs stored in `products.attributes` JSONB.

### 16.3 Validation

| Field | Rule | Error |
|-------|------|-------|
| Images | At least 1 required | "Add at least one product image" |
| Title | Required, 3–200 chars | "Enter a product title" |
| Category | Required | "Select a category" |
| Price | Required, > 0, ≤ 999999 | "Enter a valid price" |
| Stock | Required, ≥ 0, integer | "Enter stock quantity" |

**Save Draft:** saves with `status='draft'`, no validation required (allows incomplete drafts).
**Publish:** full validation required. Sets `status='active'`.

### 16.4 Edit Mode

Pre-populated with existing product data. "Publish" becomes "Save Changes". If product was `active`, saving keeps it `active`. Current status badge shown next to heading.

**Unsaved changes:** Browser `beforeunload` warning + in-app banner "You have unsaved changes. [Save Draft] [Discard]" if navigating away.

---

## Part 17 — Seller: AI Listing Generator (`/seller/ai/listing`)

### 17.1 Input Form

```
Create Listing with AI

Product Images
[ Drop images here — show the product clearly ]
Up to 5 images, JPG/PNG/WebP, 5MB max each

Your notes (tell the AI about the product)
[_______________________________________________]
[_______________________________________________]
[_______________________________________________]
e.g., "Sony wireless headphones, 30hr battery, noise cancelling, comes with case"

Category hint (optional)
[ Select category ▼ ]

[ Generate Listing ]
```

### 17.2 Generation States

**Generating (shows after clicking "Generate Listing"):**
```
[Progress animation — subtle shimmer]

Analyzing product images...
Generating title and description...
Finding the right category...
Finalizing draft...
```

- Timeout: if no response after 30 seconds → "The AI is taking longer than expected. [Try again] [Generate without images]"
- Network failure → "Couldn't connect to the AI. Check your connection and try again."

### 17.3 Draft Result

```
AI-Generated Draft

Confidence: 87%   ← color-coded: >80% green, 60–80% amber, <60% red

Title
[ Wireless Noise-Cancelling Headphones – 30hr Battery, Premium Sound ]
(editable text input)

Category
[ Electronics > Audio > Headphones ▼ ]
(editable select)

Description
[ Textarea — full draft, editable ]

Tags
[ bluetooth ] [ headphones ] [ wireless ] [ sony ] [+ add tag] [✕ remove]

Source images used: [thumbnail1] [thumbnail2]
```

**Editing the draft:**
- All fields are live-editable inline
- Changes to the AI draft are flagged with a subtle "Edited" badge on the field

**Actions:**
```
[ ✕ Discard ]   [ ← Edit Inputs ]   [ Send for Review → ]
```

- Discard: confirmation dialog "Discard this draft? The AI will need to regenerate it."
- Edit inputs: returns to form with previous inputs preserved
- Send for Review: creates `agent_approval_queue` entry, navigates to `/seller/approvals?highlight=:newId`

### 17.4 After Sending for Review

Toast: "Draft sent for your review. Approve it to publish."

---

## Part 18 — Seller: Approval Queue (`/seller/approvals`)

### 18.1 Layout

```
AI Approvals

[ Pending (3) | Approved | Rejected ]
```

### 18.2 Approval Card — Listing Draft

```
┌──────────────────────────────────────────────────────┐
│  📝 Listing Draft             15 min ago             │
│  Confidence: 87%  ✓                                  │
│                                                      │
│  Title:                                              │
│  Wireless Noise-Cancelling Headphones – 30hr Battery │
│                                                      │
│  Category: Electronics > Audio > Headphones          │
│  Tags: bluetooth, headphones, wireless               │
│                                                      │
│  [ View full draft ]   ↓ collapsed by default        │
│                                                      │
│  [ ✕ Reject ]   [ ✏ Edit & Approve ]   [ ✓ Approve & Publish ]   │
└──────────────────────────────────────────────────────┘
```

**"View full draft"** expands to show description, all fields.

**"Edit & Approve":** Opens the same form as §17.3 but pre-populated. Seller edits, then clicks "Approve & Publish".

**"Approve & Publish":**
```
POST /api/agent/listing/drafts/:id/publish
  ├── 200 → product now live in products table
  │         card moves to "Approved" tab
  │         toast "Product published successfully!"
  │         [View Product] link in toast → /products/:id
  └── error → "Couldn't publish. Try again." — card stays in Pending
```

**"Reject":**
```
Confirmation: "Reject this draft? It will be discarded."
POST /api/agent/approval-queue/:id/reject
→ card moves to "Rejected" tab
→ toast "Draft rejected."
```

### 18.3 Approval Card — Support Reply

```
┌──────────────────────────────────────────────────────┐
│  💬 Customer Reply              ⚠ HIGH RISK          │
│  Order #VY-12345 · Return request                    │
│                                                      │
│  Customer said:                                      │
│  "I want to return this item, it's defective."       │
│                                                      │
│  AI Draft:                                           │
│  "We're very sorry to hear this. Per our return      │
│   policy, you can return within 7 days. Please       │
│   initiate a return from your orders page..."        │
│                                                      │
│  Intent: return_refund  ·  Risk: HIGH                │
│  Why HIGH: Reply involves refund/return action.      │
│                                                      │
│  [ ✕ Reject ]   [ ✏ Edit ]   [ ✓ Approve & Send ]  │
└──────────────────────────────────────────────────────┘
```

Risk badge: `LOW` = green, `MEDIUM` = amber, `HIGH` = red.

**"Edit":** Opens a simple modal with just the response textarea. Seller edits and clicks "Save & Send".

**"Approve & Send":**
```
POST /api/agent/approval-queue/:id/approve
  → reply sent to customer
  → card moves to "Approved" tab
  → toast "Reply sent to customer."
```

### 18.4 Empty State

```
[Checkmark illustration]
All caught up!

No approvals waiting for your review.
```

### 18.5 Notification Trigger

When a new item enters the approval queue, a `notifications` row is created for the seller. The bell badge in the seller header increments. Clicking the bell → dropdown shows "AI action needs review" → clicking navigates to `/seller/approvals`.

---

## Part 19 — Seller: Orders (`/seller/orders`)

### 19.1 Layout

```
Orders

[ All | New (5) | Processing | Shipped | Delivered | Cancelled ]

Search orders: [__________________]
```

### 19.2 Order Table

```
Order #     Customer       Items   Amount   Status    Date     Actions
VY-12345    Rahul K.       2       ₹2,397   New       18 Sep   [View] [Update Status]
```

Seller only sees orders containing their products. `order_items.seller_id = :sellerId`.

### 19.3 Order Detail (`/seller/orders/:id`)

```
Order #VY-12345                     Customer: Rahul Kumar

Items (seller's products only):
[Image] Wireless Headphones × 2     ₹2,598

Delivery to:
12 Gandhi Nagar, Kanpur 208001, UP

Current status: Processing

Update status:
[ Mark as Shipped ] ← only the next logical status is available

Tracking reference (optional):
[_________________________]
[ Save ]
```

**Status transitions:**
- `paid` → can mark as `processing`
- `processing` → can mark as `shipped`
- `shipped` → can mark as `out_for_delivery`
- `out_for_delivery` → can mark as `delivered`
- `delivered` → no further transitions
- `cancelled` → no transitions

Only one status transition button shown at a time (next step). Seller cannot skip steps. Seller cannot reverse statuses.

`PUT /api/orders/:id/status {status, note}` → appends row to `order_status_history`.

---

## Part 20 — Seller: Inventory (`/seller/inventory`)

### 20.1 Layout

```
Inventory

[ Refresh Advisories ]   Last updated: 10 min ago

⚠ 7 products need attention

[Table]
```

### 20.2 Inventory Table

```
Product             Stock   30d Sales   7d Trend    Days Left   Status      Actions
Wireless HD         12      42          ↑ Rising    8.5         ⚠ Restock   [View Advisory]
Phone Case          45      15          → Stable    90+         ✓ Good      –
USB Cable           2       8           → Stable    7.5         ⚠ Restock   [View Advisory]
Bluetooth Speaker   0       –           –           –           ✗ No stock  [Update Stock]
```

Status icons: ✓ Good (green) / ⚠ Restock soon (amber) / ✗ No stock (red).

**"View Advisory"** expands an inline drawer below the row:
```
Why this needs attention

Sales increased 28% over the last 7 days, while available
stock has fallen to an estimated 8.5 days of supply at
current demand rates.

Recommendation:
Consider restocking soon to avoid stockout.
```

**"Refresh Advisories":**
```
POST /api/agent/inventory/refresh
→ loading spinner on button
→ on complete: table updates, "Last updated: just now"
→ on failure: toast "Couldn't refresh. Try again."
```

**"Update Stock":** Links to product edit form with stock field highlighted.

---

## Part 21 — Seller: AI Assistant (`/seller/ai`)

### 21.1 Chat Interface

```
Vyapari AI Assistant

─────────────────────────────────────────────────────

       How can I help with your store today?

       Examples:
       · "Write a listing for my new product"
       · "Which products need restocking?"
       · "Draft a reply to this customer complaint"

─────────────────────────────────────────────────────

[Type a message or upload an image...] [📎] [Send ↑]
```

**Message display:**
```
Seller:  Write me a listing for my wireless headphones.

AI:      I'll create a draft listing for you. Please upload
         a photo of the product or describe it in detail.

         [ Upload Image ]

─────────────────────────────────────────────

Seller:  [image attachment shown as thumbnail]

AI:      ✓ Got it! Analyzing your product...
         [progress animation]

AI:      I've created a draft listing. Here's a preview:

         Title: Wireless Noise-Cancelling Headphones
         Category: Electronics > Audio

         The full draft is ready for your review.

         [ Review Draft → /seller/approvals ]
```

**Message bubbles:**
- Seller messages: right-aligned, `--color-primary` pill, white text
- AI messages: left-aligned, `--color-surface-soft` pill, `--color-ink` text

**Image attachment:** Clicking 📎 opens file picker. Attached image shown as thumbnail in input area. Can be removed with ✕.

**Send behavior:**
```
POST /api/agent/chat {message, images?}
  → Immediate "AI is thinking..." placeholder message (animated dots)
  → When response arrives: replace placeholder with actual response
  → On timeout (30s): "The AI is taking longer than expected."
  → On network error: "Couldn't send message. Retry?"
```

**Chat history:** `GET /api/agent/chat/history` loads previous messages. Infinite scroll upward (load older messages on scroll up).

### 21.2 Agent Activity Panel

Collapsible right panel (desktop) or separate tab (mobile):

```
Recent Activity

Listing generation   ✓ Done    2 min ago    [View]
Inventory analysis   ✓ Done    10 min ago   [View]
Support draft        ⏳ Pending  15 min ago  [Review]
```

Clicking "View" expands to show:
```
What the AI did:

Action:        Generated product listing
Input:         3 images + seller notes
Tools used:    Product image analysis, category lookup
Decision:      Draft created (87% confidence)
Result:        Draft ready for your review

[ View Draft ]
```

No internal chain-of-thought. No raw LLM output. Only the structured summary.

---

## Part 22 — Seller: Analytics (`/seller/analytics`)

### 22.1 Layout

```
Analytics

Period: [ 7 days ▼ ]   (options: 7d / 30d / 90d / this month / last month)

Revenue                Orders              Units sold          Avg order value
₹1,24,500             342                 891                 ₹364
▲ 12% vs prev period  ▲ 8%               ▲ 15%               ▼ 4%
```

**Charts:**
- Revenue over time: line chart
- Orders over time: bar chart

Both charts use the same time period selection.

**Top 5 products table:**
```
Product              Units sold   Revenue   Rating
Wireless HD          128          ₹1,66,272  ★4.6
Phone Case           89           ₹26,611    ★4.2
```

**Low performing products:**
```
Product              Units sold   Views   Conversion
USB Cable            3            450     0.7%
```

No BI tool. Simple aggregation queries. Charts via Recharts (lightweight, works with React).

---

## Part 23 — Seller: Messages (`/seller/messages`)

### 23.1 Layout

2-column: conversation list (left) + active conversation (right).
Mobile: list → tap conversation → full-screen conversation (back button).

```
Messages

[Rahul K.    Return request    2 min ago    ● ]
[Ananya M.   Product question  Yesterday      ]

                    |
                    |    Rahul Kumar
                    |    Order #VY-12345 · Return request
                    |    ─────────────────────────────
                    |    Rahul: I want to return this item.
                    |           It's defective.
                    |
                    |    [AI drafted a reply — Review it]
                    |
                    |    [__________________________] [Send]
                    |    [ Ask AI to draft reply ]
```

**"Ask AI to draft reply":** Triggers Support Agent, creates `support_draft_replies` row. If `risk_level='low'` → offer to send directly. If `risk_level='high'` → "This reply needs your approval. [Go to Approvals]".

MVP: Messages are order-related queries stored in `support_draft_replies.source_type='message'`. No real-time chat (no WebSocket). Page refreshes or manual refresh shows new messages.

---

## Part 24 — Seller: Settings (`/seller/settings`)

### 24.1 Store Settings (`/seller/settings/store`)

```
Store Profile

Store name *     [________________________]
Description      [________________________]
                 [________________________]
Logo             [ Upload image ]
Contact email    [________________________]
Contact phone    [________________________]

[ Save Changes ]
```

`PUT /api/seller/profile {store_name, description, logo_url, ...}`

### 24.2 Policy Settings (`/seller/settings/policies`)

```
Store Policies

Your policies are used by the AI Support Agent to answer customer questions accurately.

Return Policy
[________________________]  [Edit] [Delete]

Shipping Policy
[ + Add Policy ]

Cancellation Policy
[ + Add Policy ]
```

**Add/Edit Policy modal:**
```
Policy type *   [ Return Policy ▼ ]
Content *       [ Textarea ]

[ Cancel ]  [ Save Policy ]
```

On save: `POST /api/agent/policy {title, content}` → server chunks and embeds automatically. Loading spinner while chunking happens.

**Delete:** Confirmation dialog. `DELETE /api/agent/policy/:id`.

---

## Part 25 — Admin: Platform Console

### 25.1 Dashboard (`/admin`)

```
Platform Overview

Users        Sellers      Products     Orders today
12,450        380          8,920        1,240

Flagged items needing review:
3 products flagged
12 reviews flagged

Agent tasks (last 24h):
Completed: 84 / Failed: 2 / Pending: 5
```

### 25.2 User Management (`/admin/users`)

Table: Name / Email / Role / Status / Created / Actions.
Actions: View / Disable / Enable.

`PUT /api/admin/users/:id/status {is_active: false}` — disables login.

Search + filter by role. Pagination.

### 25.3 Seller Management (`/admin/sellers`)

Table: Store Name / Owner / Products / Orders / Status / Actions.
Actions: View / Suspend / Activate / Verify.

`PUT /api/admin/sellers/:id/status` — suspends the seller's store (products hidden from public).

### 25.4 Product Moderation (`/admin/products`)

Tabs: Active / Draft / Archived / Flagged.
Actions: View / Archive / Restore / Flag / Unflag.

### 25.5 Category Management (`/admin/categories`)

Tree view. Drag to reorder (optional, keyboard-accessible fallback: move up/down buttons).

```
Electronics [Edit] [+] [Delete]
 ├── Audio [Edit] [+] [Delete]
 │    └── Headphones [Edit] [+] [Delete]
 └── Phones [Edit] [+] [Delete]
Fashion [Edit] [+] [Delete]
```

Cannot delete a category that has products. Deleting moves children up one level (or blocks deletion if children exist).

### 25.6 Agent Activity (`/admin/agents`)

Table of all agent tasks across all sellers:
```
Task ID  Seller        Type                  Status    Created    Duration
t-abc    XYZ Store     listing_generation    done      18 Sep     4.2s
t-def    ABC Mart      support_reply         failed    18 Sep     30.1s (timeout)
```

Clicking a task shows:
```
Task detail:
  Input payload
  Output payload
  Action log steps (step number, tool used, result)
```

No LLM reasoning shown to admin either. Just structured tool-use log.

### 25.7 System (`/admin/system`)

```
Service Health

backend-core      ✓ Running   (last check: 10s ago)
recommendation    ✓ Running
agentic-service   ✓ Running
PostgreSQL        ✓ Connected
Redis             ✓ Connected

Environment
NODE_ENV: production
DB_POOL_SIZE: 10
EMBEDDING_MODEL: all-MiniLM-L6-v2
```

Simple health check — `GET /api/health` from each service. No external monitoring tool.

---

## Part 26 — Notification System

### 26.1 Notification Bell (all logged-in headers)

- Badge shows unread count (capped at 99+)
- Clicking opens a dropdown (desktop) or bottom sheet (mobile)
- Dropdown shows last 5 notifications
- "View all" link → separate notifications page (or `/account/notifications` for customers)

### 26.2 Notification Dropdown

```
Notifications

● Your order has been shipped            2 min ago
  Order #VY-12345

● New order received                     10 min ago
  Order from Rahul K. · ₹2,397

  AI action needs your review            1 hr ago
  1 listing draft awaiting approval

[ Mark all as read ]  [ View all ]
```

- Unread: bold text, `--color-primary` left border
- Read: normal weight, no border
- Clicking notification: marks as read + navigates to `notification.link`

### 26.3 Backend Trigger Points

When these events occur in `backend-core` or the sub-services, insert a row into `notifications` AND increment the user's unread count (Redis counter keyed by `user_id`):

| Event | Service | Recipient |
|-------|---------|-----------|
| Order confirmed | backend-core, payment webhook | Customer |
| Order status updated (shipped, delivered) | backend-core | Customer |
| New order received | backend-core | Seller |
| Stock below threshold (qty ≤ 5) | backend-core, on stock decrement | Seller |
| AI draft in approval queue | agentic-service | Seller |
| New review on product | backend-core | Seller |

Frontend polls `GET /api/notifications?unread=true&limit=5` every 60 seconds while the page is active (tab is visible). `document.visibilitychange` pauses polling when tab is hidden. No WebSocket.

---

## Part 27 — Error and Edge Case Handling

### 27.1 Global Network Error

Triggered when the browser is offline or the API is unreachable:

```
[Banner at top of page, amber]
⚠ You appear to be offline. Some features may not work.
```

`window.addEventListener('offline', ...)` / `window.addEventListener('online', ...)` — banner auto-dismisses when connectivity is restored.

Ongoing API calls while offline: return cached data if available (React Query stale cache), else show "This content isn't available offline."

### 27.2 Session Expiry

```
Access token expires (15min)
  → Axios interceptor catches 401
  → POST /api/auth/refresh (httpOnly cookie sent automatically)
    ├── 200 → new access token in memory → retry original request transparently
    └── 401/403 → clear auth state → navigate to /login → toast "Session expired. Please log in again."
```

User never sees a blank page or a raw 401 error.

### 27.3 403 Forbidden

Customer navigates to `/seller/*` or `/admin/*` directly:
```
403 — Access Denied

You don't have permission to view this page.

[ Go to Explore → /explore ]
```

### 27.4 404 Not Found

Any unrecognized route or deleted resource:
```
404 — Page Not Found

[Simple illustration]

The page you're looking for doesn't exist or has been moved.

[ Go to Home ]  [ Browse Products ]
```

### 27.5 500 Server Error

API returns 500 or unexpected error shape:
```
500 — Something went wrong

We're working on fixing this. Try refreshing.

[ Refresh ]  [ Go to Home ]
```

### 27.6 Form Submission Failures

Every form that submits to an API must handle:
- 400 Validation error → map server error fields to inline field errors
- 409 Conflict → specific inline message (e.g., "Email already registered")
- 500 → error banner above form: "Something went wrong. Please try again."
- Network offline → "You're offline. Please check your connection."

Submit button must be disabled during request (prevent double-submission). Re-enabled after response.

---

## Part 28 — Recommendation Events Reference

Complete list of events, when they fire, and where they go:

| Event | Trigger condition | API call |
|-------|------------------|---------|
| `view` | Product detail page renders with data loaded | `POST /api/recommendations/interactions {productId, eventType: 'view'}` |
| `click` | Recommendation card link is followed | `POST /api/recommendations/interactions {productId, eventType: 'click'}` — fire before navigation |
| `add_to_cart` | `POST /api/cart/items` returns 200 | `POST /api/recommendations/interactions {productId, eventType: 'add_to_cart'}` |
| `purchase` | Payment webhook confirms, order.status set to 'paid' — fired in backend-core | Internal call to recommendation service |
| `wishlist` | `POST /api/wishlist/items` returns 201 | `POST /api/recommendations/interactions {productId, eventType: 'wishlist'}` |

All recommendation event calls are fire-and-forget. Never block UI on them. Never show errors from them to the user.

---

## Part 29 — Full Acceptance Criteria Reference

### Customer Flows

| Flow | Acceptance Criteria |
|------|-------------------|
| Registration | Email uniqueness enforced; password strength validated; auto-login on success |
| Login | Role-based redirect; failed login shows inline error; no account status leaked |
| Explore | Correct section set for user state; category filter works; card interactions independent |
| Search | URL is shareable; sort overrides ranking; filters apply without page reload |
| Product detail | Gallery navigable by keyboard; quantity respects stock; all Add to Cart states handled |
| Wishlist | Available/unavailable states shown; remove is optimistic |
| Cart | All 4 enrichment flags display; cannot checkout with unavailable items |
| Checkout | Cannot skip steps; all payment outcomes handled |
| Orders | Timeline powered by DB data; cancel only when status allows |

### Seller Flows

| Flow | Acceptance Criteria |
|------|-------------------|
| Onboarding | 4 steps complete; back/forward navigation preserves state |
| Manual product | Publish validates required fields; draft saves without validation |
| AI listing | All generation states handled; draft fields editable; approval queue updated |
| Approval queue | Cannot publish without seller action; edit preserved before approve |
| Inventory | Advisory formula matches DB data; refresh updates table |
| Orders | Seller sees only own products in orders; status transitions are sequential only |

### Agent Constraints

| Agent | Constraint |
|-------|-----------|
| Listing Agent | Never writes to `products` table directly |
| Inventory Agent | Never writes to `products`, `orders`, or `order_items` |
| Support Agent | Auto-sends only `risk_level='low'` AND `intent IN ('order_status', 'product_question')` |
| Any Agent | All runs logged to `agent_tasks` and `agent_action_logs` |

---

## Part 30 — Pre-Implementation Checklist

Before writing any application code:

```
□ docker-compose up: DB starts, pgvector extension enabled, all services reachable
□ db-schema.sql applied without errors (all tables, indexes, ivfflat indexes)
□ .env.example complete and validated
□ all-MiniLM-L6-v2 model loads in recommendation service
□ LLM API key tested (one successful completion call)
□ Payment gateway sandbox account created and webhook endpoint tested
□ frontend/src/design/tokens.css committed with all tokens
□ ProtectedRoute component working for all 3 role groups
□ Axios client: token attach + 401 refresh interceptor working
□ httpOnly cookie set on login and cleared on logout
```

This checklist is the exit condition for Phase 0 before Phase 1 work begins.
