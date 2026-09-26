# Vyapari — Build Checklist

Every item from the client requirements list, plus the gaps found in audit. Status is updated as work lands. Nothing ships until the verification column is satisfied.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done and verified

---

## A. Foundation

- [x] **A1. Migration foundation** — `scripts/migrate.py` with SHA-256 checksums, advisory lock, per-migration transactions, legacy baseline. `db-migrate` one-shot compose service. CI `test-migrations` job. — *commit 679a278*
- [x] **A2. V8 migration** — `V8__variants_password_reset_banners_leads_refunds.sql`. Five tables (`product_variants`, `password_reset_tokens`, `banners`, `leads`, `refunds`), `payments.status` extended with `refunded`/`partially_refunded`, `orders.expires_at` for the abandoned-order sweep, variant references on `cart_items`/`order_items` with a purchase-time attribute snapshot. Backfills one default variant per existing product. 29 tests + 10 CI schema assertions. — *commit `V8`*

## B. Security & correctness (no migration required)

- [x] **B1. Rate limiting** — `app/rate_limit.py`. Fixed-window counters over the existing cache layer, Lua-atomic `INCR`+`EXPIRE` on Redis with in-memory fallback. **Fails open** on cache error. Identity = user id when authenticated, else first hop of `X-Forwarded-For`. 15 routes: auth register/login/refresh, products list/suggest, cart add, order create, ai search/interactions, uploads presign, telemetry errors, review create. `X-RateLimit-Limit/Remaining/Reset` on every response, `Retry-After` on 429. 31 tests. — *this commit*
- [x] **B2. Fix `GET /api/products` 500** — `?category_id=1` / `?seller_id=1` reached asyncpg and returned `invalid UUID '1'` as a **500 with the driver message leaked**. Now a 400 `VALIDATION_ERROR` via `uuid_query_param()` in `app/utils.py`. Also fixed a second latent 500 on the same route: `?min_rating=4` produced `missing FROM-clause entry for table sp` because the count query omitted the `seller_profiles` join. — *this commit*
- [x] **B3. Forgot / reset password** — depends on A2. `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`, `app/email.py` with the token lifecycle and the password policy. **The answers are byte-identical for a known and an unknown address** — otherwise the endpoint is a free account-enumeration oracle on an unauthenticated route. The token is stored as a SHA-256 digest, never in the clear, and redemption is a single atomic `UPDATE … WHERE used_at IS NULL` so ten concurrent attempts admit exactly one winner. A reset **revokes every refresh session** and clears the cookie; without that a thief holding a pre-reset 7-day token keeps access forever and the button is decorative. A weak-password rejection does **not** consume the token. Requesting a new link retires the previous one, because two live links means the second silently breaks the first. 3/hour forgot, 10/hour reset. `dev_reset_link` is returned outside production only; no email provider is wired, so `send()` logs and says so. Registration previously accepted **any** string including an empty one and now enforces the policy (8+ chars, a letter, a number, not on the common list) → 400 `WEAK_PASSWORD`. Two pages plus a login entry point; the policy is mirrored in `src/lib/passwordPolicy.js` and a test executes the JavaScript to prove the two copies cannot disagree. 35 tests. — *this commit*

## C. Product variants

- [ ] **C1. `product_variants` table** — depends on A2. Per-variant price, stock, SKU, attributes. Backfill for 10,057 seeded products.
- [ ] **C2. Variant backend** — CRUD, stock-aware order placement, variant resolution in cart.
- [ ] **C3. Variant selector on PDP** — `/products/:id`, swatches/size pills, price + stock per variant, URL-persisted selection.
- [ ] **C4. Variant management for sellers** — `/seller/products/:id/edit` variant table.
- [ ] **C5. Variant management for admin** — part of E1.

## D. Media & images

- [ ] **D1. Real upload path** — replace the fabricated S3 presign at `uploads.py:61`. Appwrite Storage: CDN, WebP transforms, video.
- [ ] **D2. Image optimization** — `srcSet`/`sizes` on product and seller media, WebP via CDN transform, width/height attributes to prevent layout shift.
- [ ] **D3. Lazy loading everywhere** — currently 1 call site (seller page only). Catalog grids, PDP gallery, related rails.

## E. Payments & orders

- [ ] **E1. Razorpay test-mode, real flow** — write `razorpay_order_id` at order creation, `POST /api/payments/create`, webhook matches on `order_id`, remove `pay_rzp_mock_${Date.now()}` from `CheckoutPage.jsx:96`.
- [ ] **E2. Order cancellation** — customer cancels within window, stock restored.
- [ ] **E3. Refunds** — admin-initiated, refund records, `payments.status` extended.
- [ ] **E4. Abandoned-order sweep** — scheduled job expires stale `pending` orders and returns stock.
- [ ] **E5. Payment failure / interruption** — frontend recovery on gateway dismissal, pending_verification polling.

## F. Admin panel parity

- [ ] **F1. Admin product create / edit / delete** — currently admin can only change `status`. This is the first thing a client will click.
- [ ] **F2. Admin stock management** — no admin route exists.
- [ ] **F3. Admin categories edit / delete** — only `POST` exists.
- [ ] **F4. Admin order management** — no `/api/admin/orders` at all.
- [ ] **F5. Admin customer/order detail** — order detail with line items, payment history, addresses.

## G. Content management

- [ ] **G1. Banners table + admin CRUD** — image/video, placement, date range, activate/deactivate.
- [ ] **G2. Frontend banner slots** — homepage hero, category top strip, PDP promo rail. Replace hardcoded JSX.
- [ ] **G3. CMS-lite: editable homepage sections** — headline, subcopy, feature bullets without a code change.

## H. Leads & enquiries

- [ ] **H1. `leads` table + capture** — depends on A2. Contact form, product enquiry, seller page enquiry.
- [ ] **H2. Admin leads inbox** — list, filter, status, notes, export.

## I. Analytics

- [ ] **I1. `product_stats_daily` writers** — the table exists and is read but never written. Needs view/cart/purchase rollups.
- [ ] **I2. Best-selling products** — real ranking, not a fallback heuristic.
- [ ] **I3. Popular products** — real, not dependent on an undeployed service.
- [ ] **I4. Product performance view** — per-product views, conversion, revenue, trend.
- [ ] **I5. Sales analytics** — orders, revenue, AOV, refunds over time. Replaces the six integers at `admin.py:22`.
- [ ] **I6. Google Analytics 4** — requires relaxing CSP `script-src 'self'` **and** `connect-src` in the same change.
- [ ] **I7. Instrument `POST /api/ai/interactions`** — endpoint exists, zero frontend call sites. (`user_interactions` already has 4 real writers — see correction note.)

## J. Performance

- [ ] **J1. Code splitting** — 0 `React.lazy`/`Suspense`. Single ~657 kB chunk.
- [ ] **J2. Bundle analysis + budget** — CI assertion on chunk size.
- [ ] **J3. Query optimization** — index review against real query plans.

## K. Seller showcase pages (from the earlier brief)

- [ ] **K1. `/seller/page` editor** — 3 links currently 404. 19 owner endpoints built and tested; no UI calls them.
- [ ] **K2. Browser/visual pass on `/store/:handle`** — never opened in a browser. Layout, images, lightbox, scroll.

## L. Documentation

- [x] **L1. Fix the `user_interactions` error** — 3 files wrongly stated nothing writes it. Corrected: 4 real writers exist (`products.py` on view, `cart.py` on add-to-cart, `orders.py` on purchase, `wishlist.py` on wishlist add). It is `product_stats_daily` that has zero writers, and `POST /api/ai/interactions` that has zero frontend call sites. — *this commit*
- [ ] **L2. Tick the client checklist** — as items land.
- [ ] **L3. Remove the gaps register entries** that are closed, as they close.

---

## Verification gates

Every item must pass before it is marked `[x]`:

| Layer | Command |
|---|---|
| Migrations | `python scripts/migrate.py status` — all applied, checksums match |
| Backend | `python -m unittest discover -s tests -p "test_*.py"` — **114 passing** |
| Frontend | `npm run build` — clean compile |
| Frontend render | `npm run smoke` — assertions pass |
| CI | 4 jobs green |
