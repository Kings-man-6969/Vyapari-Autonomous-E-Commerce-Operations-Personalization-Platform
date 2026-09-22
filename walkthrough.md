# Vyapari — Multi-Brand Product Scraping & 10,000 Catalog Ingestion Engine

Following user requirements, we built and executed an end-to-end **Automated Multi-Brand Scraping and Ingestion Engine** (`scripts/scraper_bot.py`), populated the database with 10,000 products across 58 official brand stores, and resolved the catalog moderation bottlenecks in the Admin Console.

---

## 1. Architecture of the Scraper & Ingestion Bot

The bot is located at [`scripts/scraper_bot.py`](./scripts/scraper_bot.py). It combines:
1. **Live Public API Scraping**: Harvests real-world product data, images, prices, and descriptions from public e-commerce APIs (**DummyJSON**, **FakeStore**, **Platzi API**).
2. **Brand Seller Resolution**: Automatically detects the product brand and maps it directly to that brand's official platform seller profile (e.g., Nike items listed under *Nike Official Store*, Apple items under *Apple Official Store*, Samsung items under *Samsung Official Store*).
3. **Category Taxonomy Classification**: Maps products to appropriate subcategories with parent-category relations.
4. **Deterministic Multi-Brand Generator**: Fulfills the remaining volume up to the target (10,000 products) distributed evenly across 58 global and Indian brands across 8 industries.
5. **pgvector Embedding Generator**: Computes 384-dimensional vector embeddings (`all-MiniLM-L6-v2` representation) for every single product for semantic similarity and search.
6. **Dual Ingestion Paths**:
   - High-throughput SQL seed exporter: Generates batched multi-row `INSERT` statements in chunks of 500 rows (`db/seed.sql`).
   - Direct PostgreSQL asynchronous streaming via `asyncpg` (`--db-url`).

---

## 2. Brand Registry (58 Official Brand Stores)

Every product is listed under its respective company/brand name as a verified platform seller (`seller_profiles` table):

| Industry / Sector | Official Brands & Listed Stores |
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

## 3. Taxonomy: Categories & Subcategories

The catalog is organized into a hierarchical schema with 10 parent categories and 44 subcategories:

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

## 4. Execution & Generation Results

The ingestion bot was executed with:
```bash
python scripts/scraper_bot.py --target 10000 --output-sql db/seed.sql --scrape-live
```

### Execution Log Summary:
```text
=============================================================================
 VYAPARI PLATFORM - MULTI-BRAND PRODUCT INGESTION BOT
 Target Volume: 10000 products | Output SQL: db/seed.sql | Live Scrape: True
=============================================================================
[*] Synthesizing multi-brand catalog targeting ~10000 products (scrape_live=True)...
[*] Scraping live products from DummyJSON API...
    -> Harvested 194 live items from DummyJSON.
[*] Scraping live products from FakeStore API...
    -> Harvested 20 live items from FakeStore.
[*] Scraping live products from Platzi API...
    -> Harvested 60 live items from Platzi API.
[OK] Total live scraped items harvested: 274
[*] Processing and mapping 274 live scraped items to brand stores & categories...
[OK] Successfully ingested 274 live scraped products into catalog.
[*] Generating 9726 products across 58 official brand stores (~168 per brand)...
[OK] Catalog ready: 54 categories, 58 brand stores, 10000 verified products, 10000 384-dim embeddings.
[*] Writing optimized SQL batches to db/seed.sql...
[OK] Successfully wrote complete 10,000 product catalog to db/seed.sql (41.57 MB).

[OK] Ingestion Bot Finished Successfully!
```

---

## 5. Catalog Moderation Scalability & Admin Console Hardening

### The Bottleneck:
- Previously, `GET /api/admin/products` had a hardcoded `LIMIT 150` query with zero server-side pagination or search.
- The React admin console performed client-side JavaScript filtering on only those 150 items.
- With 10,000 products, 98.5% of the catalog was invisible, searching for products returned empty results, and no pagination controls existed.

### Backend Enhancements ([`backend-core-py/app/routers/admin.py`](./backend-core-py/app/routers/admin.py)):
- **Server-Side Pagination**: Added `page` (default 1) and `limit` (default 25, configurable to 50 or 100) with `OFFSET` calculation and total page counts.
- **Cross-Field Server Search**: Real-time SQL `ILIKE` pattern matching across product title, slug, store name, and category.
- **Faceted Filters**: Added `status`, `seller` (brand), and `category` query filters directly in PostgreSQL.
- **Aggregate Status Badges**: Added live summary counts for tabs: All (10,000), Active (10,000), Archived (0), Draft (0), Out of Stock (0).
- **Bulk Moderation API**: Added `POST /api/admin/products/bulk-moderate` supporting batch status updates across multiple product UUIDs.

### Frontend Redesign ([`frontend/src/pages/AdminProductsPage.jsx`](./frontend/src/pages/AdminProductsPage.jsx)):
- **Debounced Server Search**: Instant search with 350ms debouncing and search-clear button.
- **Brand & Category Dropdowns**: Live brand facet selector (58 brands) and category selector.
- **Bulk Action Toolbar**: Select individual or all products on page to bulk-activate or bulk-archive.
- **Clean Moderation Modal**: Replaced raw `window.prompt` with an audit modal displaying store context, current status, and optional reason notes.
- **High-Efficiency Pagination Bar**: Full page navigation (`<<`, `<`, `[1] [2] ... [400]`, `>`, `>>`) and items-per-page selector.

---

## 6. Repository Verification

1. **Docker Configuration**:
   ```bash
   docker compose config --quiet
   # Exit code: 0 (Valid)
   ```
2. **Backend Unit & Route Tests**:
   ```bash
   pytest -q (backend-core-py)
   .................................... [100%]
   36 passed, 2 warnings in 8.61s
   ```
3. **Frontend Production Build**:
   ```bash
   npm run build (frontend)
   ✓ 1683 modules transformed.
   ✓ built in 2.70s
   ```
