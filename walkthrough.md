# Vyapari — Implementation Walkthroughs

Engineering records of the three largest builds on this platform, in the order they landed.

| # | Build | Commits |
|---|---|---|
| 1 | [Multi-brand catalog ingestion & admin scaling](#1-multi-brand-catalog-ingestion--admin-scaling) | `ad0e28e` |
| 2 | [Migration runner & schema governance](#2-migration-runner--schema-governance) | `679a278` |
| 3 | [Premium seller showcase pages](#3-premium-seller-showcase-pages) | `d6b920b` |

> **Verification honesty.** Builds 2 and 3 were verified with real-database integration tests and server-render assertions. **Neither has been exercised in a browser.** Claims about visual layout, image loading, lightbox interaction and scroll behaviour are unverified and need a human pass. Build 1's test count below was reported from a `pytest` run that predates the current suite; the current figure is 83.

---

# 1. Multi-Brand Catalog Ingestion & Admin Scaling

We built and executed an end-to-end **Automated Multi-Brand Scraping and Ingestion Engine** (`scripts/scraper_bot.py`), populated the database with 10,000 products across official brand stores, and resolved the catalog moderation bottleneck in the Admin Console.

---

## 1.1 Architecture of the Scraper & Ingestion Bot

The bot is at [`scripts/scraper_bot.py`](./scripts/scraper_bot.py). It combines:

1. **Live Public API Scraping** — harvests real product data, images, prices and descriptions from public e-commerce APIs (**DummyJSON**, **FakeStore**, **Platzi API**).
2. **Brand Seller Resolution** — detects the product brand and maps it to that brand's seller profile (Nike items → *Nike Official Store*, Apple → *Apple Official Store*).
3. **Category Taxonomy Classification** — maps products to subcategories with parent relations.
4. **Deterministic Multi-Brand Generator** — fills the remaining volume up to 10,000 products, distributed across global and Indian brands in 8 industries.
5. **pgvector Embedding Generator** — writes 384-dimensional vectors for every product.
6. **Dual Ingestion Paths** — a batched multi-row SQL exporter in 500-row chunks (`db/seed.sql`), or direct `asyncpg` streaming via `--db-url`.

> ⚠️ **The embeddings are not real.** Step 5 generates **deterministic hash vectors**, not `all-MiniLM-L6-v2` output (`scraper_bot.py:416`). They satisfy the `vector(384)` type and cosine-compute without error, but carry **no semantic meaning** — every pairwise similarity is effectively arbitrary. Any semantic-search claim about this catalog is currently unfounded. The fix is a one-time re-embed of the ~10k catalog through a hosted embedding API, then pgvector in-process for serving.

---

## 1.2 Brand Registry

Every product is listed under its company/brand name as a verified platform seller (`seller_profiles`).

Seeded stores follow a strict pattern: user `<Brand> Operations`, email `store.<brand-slug>@vyapari.com`, store name `<Brand> Official Store`. **There are 47 stores** — earlier revisions of this document claimed 58.

| Industry / Sector | Brands |
|---|---|
| **Sportswear & Footwear** | Nike, Adidas, Puma, Reebok, Under Armour, Asics, New Balance, Skechers, Converse, Vans |
| **Mobiles & Consumer Tech** | Apple, Samsung, Google, OnePlus, Xiaomi, Realme |
| **Audio & Sound** | Sony, boAt, JBL, Bose, Sennheiser, Marshall, Skullcandy |
| **Laptops & Computing** | Dell, HP, Lenovo, ASUS, Acer, Logitech, Razer |
| **Fashion & Apparel** | Levi's, Zara, H&M, Tommy Hilfiger, Calvin Klein, Allen Solly, Peter England, Jack & Jones, FabIndia |
| **Watches & Accessories** | Fossil, Casio, Titan, Fastrack, Ray-Ban |
| **Home, Kitchen & Appliances** | Philips, Dyson, Prestige, Bosch, IKEA, Urban Ladder |
| **Beauty & Personal Care** | L'Oréal Paris, Nivea, Maybelline, The Body Shop, Bombay Shaving Co |
| **Sports & Luggage** | Decathlon, Yonex, Cosco |

---

## 1.3 Taxonomy

10 parent categories and 44 subcategories:

- **Footwear & Shoes**: Men's Running Shoes, Men's Sneakers & Streetwear, Women's Running Shoes, Women's Casuals & Flats, Sports & Turf Cleats
- **Mobiles & Electronics**: Flagship Smartphones, Budget & Mid-Range Phones, Tablets & iPads, Smartwatches & Fitness Bands, Cameras & Drones
- **Audio & Sound**: Over-Ear Wireless Headphones, True Wireless (TWS) Earbuds, Portable Bluetooth Speakers, Soundbars & Home Theatres
- **Laptops & Computers**: Thin & Light Ultrabooks, High-Performance Gaming Laptops, Monitors & High-Refresh Displays, Mechanical Keyboards & Gaming Mice
- **Clothing & Apparel**: Men's T-Shirts & Polos, Men's Jeans & Denim, Men's Jackets & Hoodies, Women's Westernwear & Tops, Activewear & Gym Tights
- **Watches & Accessories**: Men's Chronograph Watches, Women's Designer Watches, Sunglasses & Eyewear, Leather Wallets & Belts
- **Home & Kitchen**: Air Fryers & Smart Cookers, Cookware & Non-Stick Sets, Vacuums & Air Purifiers, Home Decor & Ambient Lighting, Ergonomic Chairs & Desks
- **Beauty & Personal Care**: Face Serums & Moisturizers, Shampoos & Hair Treatments, Luxury Perfumes & Fragrances, Men's Beard & Grooming Kits, Eye & Lip Cosmetics
- **Sports & Fitness**: Dumbbells & Strength Gear, Badminton & Tennis Racquets, Football, Basketball & Gear, Yoga Mats & Recovery Rollers
- **Luggage & Travel Bags**: Laptop & Work Backpacks, Hard-Shell Trolley Suitcases, Sports & Gym Duffle Bags

---

## 1.4 Execution Results

```bash
python scripts/scraper_bot.py --target 10000 --output-sql db/seed.sql --scrape-live
```

```text
=============================================================================
 VYAPARI PLATFORM - MULTI-BRAND PRODUCT INGESTION BOT
 Target Volume: 10000 products | Output SQL: db/seed.sql | Live Scrape: True
=============================================================================
[*] Scraping live products from DummyJSON API...     -> Harvested 194 items
[*] Scraping live products from FakeStore API...     -> Harvested 20 items
[*] Scraping live products from Platzi API...        -> Harvested 60 items
[OK] Total live scraped items harvested: 274
[OK] Successfully ingested 274 live scraped products
[*] Generating 9726 products across 47 official brand stores
[OK] Catalog ready: 54 categories, 47 brand stores, 10000 products, 10000 embeddings
[OK] Successfully wrote complete catalog to db/seed.sql (41.57 MB)
```

`db/seed.sql` is 41.57 MB / 20,341 lines and holds **10,057 products** against 10,000 embeddings. It contains **no orders, reviews, or payments** — a fresh database looks empty until you place an order yourself.

---

## 1.5 Catalog Moderation Scalability

### The bottleneck
- `GET /api/admin/products` had a hardcoded `LIMIT 150` with no server-side pagination or search.
- The React console filtered those 150 rows client-side.
- With 10,000 products, **98.5% of the catalog was invisible**, searching returned nothing, and no pagination controls existed.

### Backend (`backend-core-py/app/routers/admin.py`)
- **Server-side pagination** — `page` (default 1) and `limit` (25/50/100) with `OFFSET` and total page counts.
- **Cross-field search** — SQL `ILIKE` across title, slug, store name and category.
- **Faceted filters** — `status`, `seller` (brand), `category` executed in PostgreSQL.
- **Live status badges** — counts for All, Active, Archived, Draft, Out of Stock.
- **Bulk moderation** — `POST /api/admin/products/bulk-moderate` for batch status updates.

### Frontend (`frontend/src/pages/AdminProductsPage.jsx`)
- Debounced server search (350 ms) with a clear button.
- Brand and category facet selectors.
- Bulk action toolbar — select individuals or the whole page.
- A moderation modal replacing a raw `window.prompt`, showing store context, current status and an optional reason.
- Full pagination bar (`<<`, `<`, `[1] [2] … [400]`, `>`, `>>`) with an items-per-page selector.

---

# 2. Migration Runner & Schema Governance

Before this, schema changes were applied by hand and Compose mounted `init.sql` directly. There was no record of what a given database had actually received.

## 2.1 What the runner does

`scripts/migrate.py` adds four commands — `status`, `plan`, `apply`, `baseline` — with four guarantees:

- **SHA-256 checksums.** An already-applied migration whose file has been edited is reported as **tampering**, not silently skipped or re-run. This is the property that makes a migration ledger trustworthy.
- **Per-migration transactions.** A failing migration rolls back on its own without poisoning the ones before it.
- **PostgreSQL advisory lock.** Two concurrent runners cannot interleave DDL.
- **Password redaction.** Connection strings are never printed to logs.

`baseline --upto V1` marks a legacy `db/init.sql` database as already at V1 so it can then be upgraded forward. This is the proven remediation for the production database, whose actual migration state is still unverified.

## 2.2 Compose and CI

- `db-migrate` is a **one-shot Compose service**. It applies migrations to completion and exits. Downstream services gate on its successful exit via a **TCP healthcheck**, not a sleep — a slow migration no longer causes a race.
- `scripts/setup_remote_db.py` was rewritten to **exit non-zero on failure**, so a failed remote bootstrap can no longer look like success.
- A V5-before-V6 ordering bug was found and fixed; ordering is now deterministic by construction.

## 2.3 CI job

A dedicated `test-migrations` job runs on every push, and it does four things:

1. Migrations apply in order on an **empty** database.
2. Migration filenames are correctly formed and none are duplicated.
3. A **legacy `init.sql` database upgrades cleanly**.
4. V7 seller-page objects exist and their constraints hold — including assertions on the trigger count and foreign-key count.

> The assertions in that job are written inline in the workflow. If migration numbering changes, the hard-coded trigger count `= "5"` and FK count `= "2"` need updating.

---

# 3. Premium Seller Showcase Pages

The monetization feature: an Instagram-style public landing page per seller at `/store/:handle`, gated behind a paid plan. Commit `d6b920b`.

## 3.1 Key decisions

| Decision | Choice | Why |
|---|---|---|
| Media hosting | **Appwrite Storage** | CDN + WebP transforms + video, and it unblocks the hollow image-upload path |
| Subscription billing | **Entitlement-only** | A gateway- or admin-granted `seller_subscriptions` row; Razorpay Subscriptions attach later |
| URL | **`/store/:handle`** | A display route, not a subdomain. Coexists with the existing `/stores/:sellerId` UUID storefront |
| Public API base | **`/api/public/stores`** | Avoids collision with the existing `/api/stores/{seller_id}` router |
| Plan changes | **Admin-only** | `grant_own_plan` restricted to admins — a seller self-upgrading is a privilege-escalation bug |
| Money | `NUMERIC(10,2)` INR | Matches the existing schema; Razorpay is INR-native, charges are ~2% UPI/card plus a fixed fee |

## 3.2 Schema (V7)

Seven tables, four design points worth calling out:

- **Circular FK resolved with `DO $$`.** `seller_pages.avatar_media_id` → `seller_media`, which itself FKs back to `seller_pages`. The target table does not exist at declaration time, so the constraint is added afterwards in an idempotent block.
- **Partial unique index, not a plain unique.** `uq_seller_live_subscription ON (seller_id) WHERE status IN ('trialing','active')` enforces one *live* subscription while permitting history. A unique on `seller_id` alone would forbid the row history billing needs.
- **Domain CHECKs** for things usually left to application code: `theme_accent` hex format, video posters required, positive media dimensions, exactly one target per highlight item (`num_nonnulls(media_id, product_id) = 1`), block scheduling windows, and `cta_href` restricted to `^/` or `^https://`.
- **`set_updated_at()` plus 5 triggers.** The rest of the schema declares `updated_at` columns and **never refreshed them** — there were zero triggers in the project before this. V7 tables are fixed; legacy tables remain untriggered.

## 3.3 Backend

`seller_page_service.py` holds the shared logic: handle validation (`^[a-z0-9][a-z0-9_-]{2,29}$`) with **distinct 400 codes per failure mode**, the `TIERS` capacity table, a 300 s cached entitlement lookup, `require_feature` / `require_capacity` returning 402s, store-name-derived handle generation, `validate_media_url` host allowlisting, and one shared `PAGE_SELECT` fragment so the avatar and cover can never silently fail to resolve.

Two routers, 26 routes total: 19 owner routes under `/api/seller-pages` and 7 unauthenticated routes under `/api/public/stores`.

## 3.4 Frontend

`SellerShowcasePage.jsx` (807 lines) renders an announcement strip, an owner draft banner, a profile header with optimistic follow + rollback, hero banner, highlights, tabbed gallery/listings, a 3-column lazy grid driven by `IntersectionObserver`, a keyboard-navigable lightbox, skeletons, and a 404 state.

It is split into a pure `StoreView` and a data-fetching shell specifically so it can be server-rendered for testing.

**All 6 block types now render.** Previously only 2 of 6 were read — `featured_collection`, `media_grid`, `reels` and `testimonials` were paid-for content that the page silently dropped.

Two security fixes came out of treating seller input as hostile:
- `safeHref` neutralizes `javascript:` and `data:` URLs in seller-written `cta_href`.
- `safeAccent` re-validates `theme_accent` against `/^#[0-9a-fA-F]{6}$/`.

Both are enforced in SQL *and* re-checked at render. The database constraint is not the security boundary — a value that reaches a DOM attribute must be validated where it is used.

## 3.5 Verification — and its limits

**37 real-database integration tests**, all passing. They use per-test `asyncSetUp` because Python 3.10's `IsolatedAsyncioTestCase` has no class-level async setup, and reset with `TRUNCATE users, categories` (both must be named explicitly).

Those tests earned their keep. Bugs they caught that mocks would have sailed past:

| Bug | Why mocks missed it |
|---|---|
| Avatar/cover URLs never resolving | No `seller_media` join in the query — a mock returns whatever you tell it |
| `get_my_page` response drift | The handler had a hand-rolled select that diverged from the shared fragment |
| `str` columns reaching asyncpg | Type enforcement only exists in the real driver |
| `fetchval` on `UPDATE … RETURNING 1` | Returns `1`, not a count — invisible without a real cursor |
| Duplicate `sort_order` from partial reorders | Broke keyset pagination; only reproducible with real ordering data |
| `block.config` returned as raw text | `jsonb` comes back unparsed because no codec is set on the pool |

**`frontend/.smoke/`** adds a hermetic render test: 33 assertions across two scenarios (a populated pro page and an empty free-tier draft), run via `npm run smoke` and wired into CI's `build-frontend` job. Artifacts are gitignored.

Two SSR constraints shaped it: `renderToString` inserts `<!-- -->` between adjacent text and expression children, so assertions strip those first; and `useEffect` never runs, so the test renders `StoreView` rather than the page shell.

> ### ⚠️ The gap in this verification
> **No browser was ever attached.** The page has been verified as *markup generated from known-good data* — nothing more. Layout, image loading, lightbox interaction, scroll behaviour and responsive behaviour are all unverified. **A human must open `/store/aura-living` before this ships.**

## 3.6 What is not done

- **The `/seller/page` editor does not exist.** `SellerShowcasePage` links to it from three places — the Edit Page button, the owner draft banner, and the owner preview — and all three 404. The 19 owner endpoints are implemented and tested, but no UI calls them. **This is the top outstanding item on the platform.**
- **The page has no visual pass** (above).
- **Appwrite Storage is not wired.** The schema is shaped for it (`storage_provider` defaults to `'appwrite'`), and the UI depends on it, but the upload path is still the fabricated S3 stub.
- **Razorpay Subscriptions are not attached.** Entitlement rows are granted by hand or by an admin.

## 3.7 One unrelated fix

`.spin` keyframes were added to `index.css`. `AdminProductsPage.jsx:283` referenced `.animate-spin`, which does nothing because there is **no Tailwind** in this project — `index.css` is hand-written plain CSS. Any `animate-*` or utility class in this codebase is dead unless it is defined in that file. This is an easy way to ship a silently broken animation.
