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

- [x] **C1. `product_variants` table** — depends on A2. Per-variant price, stock, SKU, attributes. Backfill for 10,057 seeded products. *(V8, committed in A2; V9 adds the cart/order-line wiring.)*
- [x] **C2. Variant backend** — CRUD, stock-aware order placement, variant resolution in cart. *(C1–C5 commit: 5 owner/admin routes, `app/variants.py` as the single price/stock authority, variant-aware bag and order placement, snapshotting. 60 new tests.)*
- [x] **C3. Variant selector on PDP** — `/products/:id`, swatches/size pills, price + stock per variant, URL-persisted selection. *(`VariantPicker.jsx`: multi-axis availability judged against the other axes as already chosen; `?variant=` in the URL so a link opens on that size; price/stock/quantity all read the chosen option. `LineOption.jsx` renders it on the bag, checkout, order and seller order lines. 17 new smoke checks.)*
- [x] **C4. Variant management for sellers** — `/seller/products/:id/edit` option table plus options at creation. *(`VariantEditor.jsx` calls all 5 routes: list, create, update, reorder, delete. Each row saves itself, so a mistyped description cannot take a live size run down. The create form takes an opening set. `src/lib/optionLines.js` is the one parser for the "axis: value" text both forms take. Three silent-data bugs closed — see the commit message. 6 new backend tests, 17 new smoke checks.)*
  - *Known limit, deliberate:* the database rejects an exactly-equal attribute set but accepts `{size:"XL"}` and `{size:"xl"}` as distinct rows, because jsonb equality is case-sensitive. Both forms check case-insensitively before posting, so every UI path is covered; a caller hitting the API directly could still create both. Folding it server-side needs a `lower(attributes::text)` unique index — a V10 migration — and is worth doing before any bulk import tool exists.
- [x] **C5. Variant management for admin** — part of E1. *(The same 5 routes accept an admin token; `test_an_admin_can_touch_any_product` locks it in. No separate admin UI — it shares the seller editor.)*

## D. Media & images

- [x] **D1. Real upload path** — the fabricated S3 presign is gone. `app/storage/` is a provider interface with two real implementations: **local** (writes to `MEDIA_ROOT`, serves `/media`, generates the rendition ladder, no credentials, so the whole path is exercisable today) and **s3** (presigned direct browser PUT, 503 `STORAGE_NOT_CONFIGURED` until real keys exist). Five routes: `config` / `presign` / `object` / `complete` / `DELETE object`. Every uploaded byte goes through `app/storage/images.py`, which **decodes and re-encodes** it. 59 tests.
  - *Appwrite was not used.* Nothing is provisioned, and a provider that cannot be exercised is a provider that is not tested. The interface is two methods wide, so swapping in Appwrite or Cloudinary later is a single file.
  - **D1 also needed a caller, and it did not have one.** The routes existed and were unreachable: both seller product forms asked for an image URL typed into a text box, so a seller was told to host the photograph somewhere else and paste a link. `frontend/src/components/ImageUploader.jsx` is now the first consumer of `/api/uploads/*` in the project's history — drag-and-drop or click, multiple files, per-file progress, reorder, remove. Removing an image deletes the bytes rather than just dropping the URL. It pre-checks type and size in the browser so a 40 MB TIFF never costs a round trip, and it reports the server's own message when the server refuses. Wired into `SellerProductCreatePage` and `SellerProductEditPage`. The URL field is kept, demoted behind a click, because it is how all 10,057 seeded products are populated and how a seller attaches a shot already hosted elsewhere.
  - On the local path the bytes go through the shared axios client rather than the ticket's absolute `upload_url`: in development the SPA and API are on different origins, so posting to that URL directly would need a cross-origin multipart request with credentials. For S3 the URL *is* absolute and signed, and is fetched raw with no auth header — adding one would invalidate the signature.
- [x] **D2. Image optimization** — `srcSet`/`sizes` across all **14** `<img>` sites, with `width`/`height` so a grid does not reflow as images arrive. All 14 pass an explicit `sizes`, which is the part that is usually skipped: a srcSet without it assumes the image fills the viewport, so a 200px thumbnail in a four-across grid still downloads the 1600w file. Uploads are stored as `{uuid}@{width}w.webp`, so a client builds a correct srcSet from one stored URL by rewriting that token — no manifest, no extra request, no per-image row. `src/lib/imageUrl.js` also emits width-parameterised URLs for `images.unsplash.com`, which was verified to honour `w` and `fm=webp` (400w WebP is 13.6 kB against 42 kB for the 800w JPEG). It deliberately emits **nothing** for `cdn.dummyjson.com`, which was measured returning byte-identical output for `?w=200` — a srcSet there would download the same 63 kB file five times. A rendition is only offered up to its own master width, because a 2000w request for a 1600w master is a 404.
- [x] **D3. Lazy loading everywhere** — every `<img>` declares `loading` and `decoding` via one helper. The one above-the-fold image per view (PDP hero, first grid card, seller page cover, cart and order line items) is `eager` + `fetchpriority="high"`; everything else is `lazy`. The one deliberate exception is the search-suggestion dropdown thumbnail, which is eager: it only exists after a keystroke, nothing scrolls, and lazy there adds a visible beat before the row the customer just asked for appears. The `IntersectionObserver` that used to gate image `src` attributes on the seller page is removed — `loading="lazy"` solves it better, since swapping a `src` after mount restarts the request instead of letting the browser pick from a srcSet it already has. The observer that remains on that page is for pagination, which is a different job.
- [x] **D4. The one real image bug, and it was in the seller form** — a new product was created with a hardcoded Unsplash photograph of **headphones** already in its `images` array, and the edit form re-seeded the same photo whenever a product had none. A seller listing a saree published a listing wearing headphones, and on the edit form the first save wrote the fake photo to the database permanently, where it looked like the seller's own work. Both forms now start empty and submit what is actually there; the storefront's fallback tile covers a product with no photo.

**Section D is complete.** 59 backend tests in `tests/test_media_pipeline.py`. The full backend suite is **431 passed, 0 failed** (with `TEST_DATABASE_URL` pointed at the Docker test database, which is how the 243 database-backed tests actually run rather than skip). Frontend: 185 smoke checks pass, `npm run build` clean.

### Six bugs found while doing D, five of them outside D

- **`/presign` had no security model because it was never called.** The key extension came from the client's declared `mime_type` and nothing ever looked at the bytes, so a seller could declare `image/jpeg`, upload an SVG carrying a `<script>` tag, and be handed a URL served from the app's own origin. Decoding plus re-encoding closes it: SVG and HTML are not images, so they never get a key. EXIF is dropped in the process, which takes the GPS coordinates out of phone photos.
- **The key allowlist rejected the keys the app itself writes.** Rendition names carry an `@<width>w` marker that was missing from the character class. Every *write* succeeded — the write path validated a widthless key — and every *read* raised `INVALID_OBJECT_KEY`. Uploads appeared to work and produced images nothing could display. Caught by asserting that every advertised width is really on disk at that width.
- **`stem_of` assumed a file extension.** A client hands back the bare stem it uploaded to, which has none, and `rpartition(".")` returns `("", "", "abc123")` for that — so the stem silently became the *seller directory*, and `finalize` reported another seller's directory as the uploaded object.
- **The S3 placeholder check would have refused every real AWS credential.** It listed `AKIA` and `ASIA` as fake-credential prefixes. Those are not placeholders, they are what AWS issues. A production deployment would have reported itself configured and never uploaded anything. Now matches the exact documentation key pair instead.
- **The create form invented a product photo.** A hardcoded Unsplash photograph of **headphones** was already in `images` on every new product, so a seller listing a saree published a listing wearing headphones. It survived because nothing looked at it: no test asserted that a product's image is an image the seller chose.
- **The edit form invented the same photo again, and wrote it to the database.** Separate defect, separate file, worse outcome: the create form only *displayed* the wrong photo, but the edit form re-seeded it whenever a product had none, so the seller's **first save** persisted it. From then on the fake photograph was in the database, attributed to the seller, and no later edit would remove it. Both forms now start empty and submit what is actually there.

## E. Payments & orders

- [x] **E1. Razorpay test-mode, real flow** — `app/payments/razorpay.py` (`RazorpayClient`: httpx against the v1 API, `Decimal`-exact paise conversion, HMAC verification, `is_configured` false while the `rzp_test_placeholder_*` defaults are in place). `POST /api/payments/create` mints the gateway order and writes it to `orders.razorpay_order_id` — outside the order transaction, so the round trip does not hold catalogue row locks. Webhook matches on that column, not `payments.provider_ref`, which other code also wrote with a fabricated `rzp_order_<ms>` that made it match nothing. `pay_rzp_mock_${Date.now()}` is gone. **CSP fixed**: the API's `script-src 'self'` and the missing `frame-src` would have blocked checkout.js and rendered the modal blank; the SPA now ships a build-injected CSP meta tag (`vite.config.js`) naming `checkout.razorpay.com`. *Deploy note: if the static host also sets a CSP header, the stricter of the two wins, so it needs the same origins.*
- [x] **E2. Order cancellation** — `PUT /api/orders/{id}/cancel`. Pending → stock back, payment closed out as `cancelled`. Paid/processing → cancelled with stock back and the payment flagged `pending_verification`; **it does not refund**, so money cannot leave by two routes. Shipped and beyond → 409 pointing at the refund route. Idempotent (the guarded `UPDATE ... WHERE status = 'pending'|'paid'` gates `restore_stock`).
- [x] **E3. Refunds** — `POST /api/payments/refunds` (admin only) and `GET /api/payments/refunds`. Amount checked against *what is left*, not the order total, so refund-over-refund is refused with the refundable figure. Full refund cancels the order and returns stock. With no keys configured the refund is kept as `requested` rather than lost. Fixed a real bug: the lookup joined `payments` on `status = 'success'`, so the first partial refund made the order **permanently unrefundable**; and the full-refund path never set the payment to `refunded`, leaving a refunded order showing `success`. Both now go through one `_settle_refund` shared with the `refund.processed` webhook.
- [x] **E4. Abandoned-order sweep** — `app/jobs.py`, `FOR UPDATE SKIP LOCKED` so N containers each get a disjoint batch, guarded `UPDATE ... WHERE status = 'pending'` re-checked between SELECT and UPDATE so a payment that lands mid-sweep is never refunded its stock. Wired into the lifespan, cancelled cleanly on shutdown, `RUN_ORDER_SWEEP` off in tests.
- [x] **E5. Payment failure / interruption** — `src/lib/razorpay.js` (memoised script load, `dismissed` vs `failed` distinguished, incomplete success refused) and `src/hooks/usePaymentStatus.js` (polls `/api/payments/status/:orderId`, 1.2s→5s backoff, `pending_verification` explicitly does *not* stop it). The page reuses the order on retry instead of creating a second, and 503 `GATEWAY_NOT_CONFIGURED` is reported as "payments are not switched on, your order is saved" — not "try again" against a server with no keys.

**Section E is complete.** 67 new backend tests in `tests/test_payment_flows.py`, 27 new smoke checks, 316 backend tests pass.

### Two bugs found while doing E, outside E

- **`main.py` error handler dropped every structured error payload.** 115 raise sites across 18 routers put `data` in `HTTPException(detail=...)`; the handler rebuilt the body from `code`/`message`/`details` only, so none of it reached a client. `POST /api/payments/refunds` answering "Only ₹50 is still refundable" with no `50` in it was the symptom. Now carried, and run through `jsonable_encoder` because the values come straight out of asyncpg rows and a datetime in `data` would turn a 409 into a 500.
- **`confirm-payment` returned HTTP 200 for a declined card.** It built a dict containing `"status_code": 402`, which FastAPI serialises as a 200 body. A declined payment that answers 200 is a declined payment a frontend's success path treats as a receipt. Now a real 402.

## F. Admin panel parity

- [x] **F1. Admin product create / edit / delete** — `app/routers/admin_catalogue.py`: `POST`/`PUT`/`DELETE /api/admin/products`. Edit is a partial update via `COALESCE($n, existing)`, so an omitted field is untouched; `null` means "not supplied" for every field, which is also why `compare_at_price` cannot be *cleared* through this route. **The edit route has no `stock_qty`** — two routes accepting the same field means one is a way around the variant rule in F2. `PUT /api/admin/products/{id}/stock` is the only way. — *this commit*
- [x] **F2. Admin stock management** — `PUT /api/admin/products/{id}/stock` and `PUT /api/admin/variants/{id}/stock`, audited in the new `product_stock_movements` table, read back at `GET /api/admin/products/{id}/stock-movements`. Rows are written `FOR UPDATE` so a concurrent order decrement cannot be read past, and a no-op write is still recorded — "an admin set it to what it already was" is worth knowing when a listing sits at zero. **Stock on a variant product is refused 409 `VARIANT_STOCK_REQUIRED`** and the option list is returned: V8's trigger owns `products.stock_qty` whenever `has_variants`, so a parent write would be accepted, displayed, and silently erased at the next option edit. The refusal names the options because "edit the one that is wrong" is not actionable without them. — *this commit*
- [x] **F3. Admin categories edit / delete** — `PUT`/`DELETE /api/admin/categories/{id}`, cycle-checked by walking descendants rather than trusting the caller. `POST` accepted a `description` and an `icon_url` and stored neither — **the column did not exist**; V10 adds it. **Delete refuses loudly**: `categories.parent_id` is `ON DELETE SET NULL`, so deleting a parent would silently re-root its whole subtree to the top level with nothing in the response to say so → 409 `CATEGORY_HAS_CHILDREN`; a category with products is 409 `CATEGORY_IN_USE`. — *this commit*
- [x] **F4. Admin order management** — `GET /api/admin/orders` (status filter, search, date range, pagination) and `PUT /api/admin/orders/{id}/status`. Transitions are a **whitelist** (`paid→processing→shipped→out_for_delivery`), not rank-ordered, so a delivered parcel cannot be put back into `shipped`. `cancelled` is refused 409 `USE_CANCEL_ROUTE` pointing at `/api/orders/{id}/cancel` — that is the path that returns stock, and setting the status here would leave the order holding inventory it no longer has. Re-setting the current status is idempotent, not an error: a double-click on "Mark shipped" is not a red banner. The history row and the status move are one transaction — a history row for a move that did not happen is a fabricated audit trail. — *this commit*
- [x] **F5. Admin customer/order detail** — `GET /api/admin/orders/{id}`: line items with the variant snapshot and what is still refundable, payment history, refund history, full status history with who moved it. **The address is `orders.shipping_address`** (the JSONB snapshot), not the buyer's current default from `addresses` — it is the address that went on the label. The list route returns only the town, to keep the response small. — *this commit*

**Section F is complete.** 55 new backend tests in `tests/test_admin_ops.py`, 431 backend tests pass.

`DELETE /api/admin/products/{id}` refuses 409 `PRODUCT_HAS_ORDER_HISTORY` with the line count and a pointer at archiving: `order_items.product_id` is `ON DELETE RESTRICT`, and the database would reject the delete anyway — the route makes the reason legible instead of surfacing a constraint name. The admin can still hide a product (`status`), which is what archiving means here.

No cache invalidation on the order routes. Orders are read live everywhere; there is no `order:detail:` or `orders:user:` key, so a status change cannot leave a stale read. Catalogue writes invalidate the real key set from `products.py` — `product:detail:` (singular, keyed by *both* slug and id), `search:`, `suggest:`, `products:facets`, `products:popular:`, `categories:tree`, `categories:slug:`. There is no `products:list:` and no `products:detail:`; inventing those would be invalidating keys nothing reads.

### Bugs found while doing F, all of them before F

- **A rejected input was a 500, not a 400, on every route with a custom validator.** `main.py`'s `RequestValidationError` handler passed `exc.errors()` straight to `JSONResponse`. When a `field_validator` raises, pydantic puts the exception *instance* in `ctx["error"]`, which is not serialisable — the `JSONResponse` raised, the generic handler caught it, and the correct rejection was reported as a server error. `variants.py` had two such validators, so this predates F. Pinned by a test on the pre-existing seller route rather than on a new one, so the fix is measured where the bug was. — *this commit*
- **The `error` payload drops every key a route puts next to `code` and `message`.** The handler reads `code`/`message`/`details`/`data` only. F's first draft returned `{"order_line_count": 3}`, `"variants": [...]`, `"child_count": 2}` as siblings and every one of them vanished on serialisation — a client would have been told "3 order lines" in the prose with nothing to compute with. All structured payloads now go under `data`. — *this commit*
- **jsonb arrives from asyncpg as text, and one `isinstance` guard hid it.** `orders.shipping_address` and `order_items.variant_snapshot` reached the client as escaped JSON *strings* — `"{\"city\": \"Pune\"}"`. The list route's `isinstance(addr, dict)` check made it worse: it failed *quietly*, producing an empty address block on every order with no error anywhere. Decoding is now explicit. — *this commit*
- **`create_admin_category` accepted a `description` and an `icon_url` and wrote neither.** It also raised an unhandled `ValueError` on a malformed `parent_id`, which is a 500, and let unique/FK violations out as 500s instead of 409/404. — *this commit*
- **`db.acquire()` on the injected `db`.** The `get_db` dependency yields a *connection*, not a pool. `async with db.acquire()` is an `AttributeError` → 500 on every stock write and every status transition. Transactions open on `db` directly, as `variants.py` already did; taking a second connection while holding the first is done elsewhere in this codebase and is a self-deadlock at `min_size=1`. — *this commit*

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
| Backend, no database | `python -m pytest -q` — **133 passed, 243 skipped** (the skips are the database suites, gated on `TEST_DATABASE_URL`) |
| Backend, full | `TEST_DATABASE_URL=... python -m pytest -q` — **431 passed, 0 failed**. Use the Docker test database: `postgresql://vyapari_admin:vyapari_secure_password@127.0.0.1:54329/sellerpages_test`. Without this variable the suite reports a pass that is missing 64% of itself. |
| Frontend | `npm run build` — clean compile |
| Frontend render | `npm run smoke` — **185 checks** |
| CI | 4 jobs green |
