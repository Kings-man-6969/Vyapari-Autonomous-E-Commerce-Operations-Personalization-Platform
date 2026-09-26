-- ============================================================================
-- Migration V8: Variants, Password Reset, Banners, Leads, Refunds
--
-- The five schema gaps that the client requirements checklist calls out and
-- that could not be closed without new tables. Grouped into one migration
-- because they are independent but all land together, and a single backfill
-- (variants) is far cheaper than backfilling the same 10k products twice.
--
-- Ordering note: the variant backfill is the only data movement in this file
-- and it runs after product_variants exists but before the sync trigger, so
-- inserting 10k default variants does not fire 10k product updates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. product_variants
--
-- Stock model. products.has_variants decides who is authoritative for stock:
--
--   has_variants = false  ->  products.stock_qty is authored directly.
--                             (The 10,057 seeded products, and every product
--                             created before this migration.)
--   has_variants = true   ->  products.stock_qty is maintained as the SUM of
--                             the product's active variants by the trigger in
--                             section 2. Sellers must not write it directly.
--
-- Keeping products.stock_qty correct in BOTH cases is the point: it means
-- every existing read path (catalogue listing, facet counts, admin list,
-- product_stats_daily, the recommendation service's stock filter) keeps
-- working untouched, and no existing query needs a has_variants branch. Only
-- new variant-aware code branches.
--
-- The backfill gives every product exactly one default variant mirroring its
-- own price and stock, so variant-aware UIs never have to handle a product
-- with zero variants. has_variants stays false on them, so behaviour is
-- byte-for-byte what it was before this migration.
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS product_variants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- NULL price means "inherit the product price". Kept nullable so adding a
    -- size run to a product does not require re-pricing every variant.
    price        NUMERIC(10,2) CHECK (price IS NULL OR price >= 0),
    compare_at_price NUMERIC(10,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    stock_qty    INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    sku          VARCHAR(64),
    -- { size: 'M', color: 'Indigo' } - the shape the frontend variant picker
    -- and the seller editor both read. Free-form so a category can add its own
    -- axes (Capacity, Pack Size, Shade) without a migration.
    attributes   JSONB NOT NULL DEFAULT '{}',
    -- Optional per-variant image, else the parent product's images are used.
    image_url    TEXT,
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_variant_compare_at CHECK (compare_at_price IS NULL OR price IS NULL OR compare_at_price >= price)
);

-- SKU is optional, so uniqueness must be partial: plain UNIQUE(sku) would let
-- every NULL-variant SKU collide under SQL's default NULLS DISTINCT-free
-- comparison and only permit one NULL row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_sku
    ON product_variants (product_id, sku) WHERE sku IS NOT NULL;

-- At most one default variant per product.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_default
    ON product_variants (product_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_product_variants_product
    ON product_variants (product_id, sort_order) WHERE is_active;

-- Backfill: one default variant per product, mirroring the parent. Idempotent
-- via NOT EXISTS so a re-run after a partial failure cannot duplicate rows.
INSERT INTO product_variants (product_id, price, compare_at_price, stock_qty, sku, attributes, is_default)
SELECT p.id, p.price, p.compare_at_price, p.stock_qty, NULL, '{}'::jsonb, TRUE
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

-- Variant-aware references. Nullable with ON DELETE SET NULL so archiving a
-- variant never cascades into deleting a historical order line.
ALTER TABLE cart_items   ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
-- Snapshot of the variant's own attributes at purchase time, so a later edit
-- to the variant does not rewrite what the customer actually bought.
ALTER TABLE order_items  ADD COLUMN IF NOT EXISTS variant_snapshot JSONB;
ALTER TABLE order_items  ADD COLUMN IF NOT EXISTS sku_at_purchase VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_cart_items_variant   ON cart_items (variant_id)   WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items (variant_id) WHERE variant_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Keep products.stock_qty in step with its variants
--
-- Only fires for products that actually have variants; the 10,057 seeded
-- products keep the plain "seller sets stock_qty" behaviour. Serialising on
-- the parent products row is intentional - it is what makes two concurrent
-- decrements of different variants of the same product sum correctly instead
-- of losing an update.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_product_stock_from_variants() RETURNS TRIGGER AS $$
DECLARE
    target_product UUID;
BEGIN
    target_product := COALESCE(NEW.product_id, OLD.product_id);

    UPDATE products p
       SET stock_qty = COALESCE((
               SELECT SUM(v.stock_qty)
                 FROM product_variants v
                WHERE v.product_id = target_product
                  AND v.is_active
           ), 0),
           updated_at = NOW()
     WHERE p.id = target_product
       AND p.has_variants = TRUE;

    RETURN NULL;  -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_variants_stock_sync ON product_variants;
CREATE TRIGGER trg_product_variants_stock_sync
    AFTER INSERT OR UPDATE OF stock_qty, is_active OR DELETE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION sync_product_stock_from_variants();

-- ----------------------------------------------------------------------------
-- 3. password_reset_tokens
--
-- token_hash is a SHA-256 of the emailed token, never the token itself, so a
-- database leak does not hand over live reset links. Mirrors the existing
-- refresh_token_sessions approach in V2.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    -- Recorded so a user disputing a reset can be told which request was theirs.
    request_ip   VARCHAR(64),
    user_agent   VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_password_reset_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user    ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_cleanup ON password_reset_tokens (expires_at);

-- ----------------------------------------------------------------------------
-- 4. banners — the CMS surface behind checklist section 8
--
-- placement is a CHECK rather than a free string so a typo cannot create a
-- slot nothing renders. Any new slot needs a migration, which is the point:
-- adding it should be a deliberate, reviewable act.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banners (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(160) NOT NULL,
    subtitle         VARCHAR(255),
    placement        VARCHAR(40) NOT NULL DEFAULT 'homepage_hero',
    media_type       VARCHAR(10) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    storage_provider VARCHAR(20) NOT NULL DEFAULT 'appwrite',
    storage_id       VARCHAR(128),
    -- Denormalised so the storefront never needs a storage SDK to render a slot.
    url              TEXT NOT NULL,
    thumbnail_url    TEXT,
    cta_label        VARCHAR(40),
    target_url       TEXT,
    start_at         TIMESTAMPTZ,
    end_at           TIMESTAMPTZ,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_banner_placement CHECK (placement IN
        ('homepage_hero', 'homepage_strip', 'category_top', 'pdp_promo', 'seller_page')),
    CONSTRAINT chk_banner_window CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at)
);

-- Partial index covering exactly the rows a storefront read touches: active,
-- in-window, ordered. Keeping it partial stops the index growing with the
-- archive of expired creatives.
CREATE INDEX IF NOT EXISTS idx_banners_active
    ON banners (placement, sort_order)
    WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_banners_window ON banners (start_at, end_at);

-- ----------------------------------------------------------------------------
-- 5. leads — checklist section 9 "leads / enquiries"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120),
    email       VARCHAR(150),
    phone       VARCHAR(20),
    message     TEXT,
    source      VARCHAR(30) NOT NULL DEFAULT 'contact_form'
                CHECK (source IN ('contact_form', 'product_enquiry', 'seller_page', 'checkout_abandon', 'manual')),
    product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
    seller_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost', 'spam')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A lead with no way to reply to it is not a lead.
    CONSTRAINT chk_lead_contactable CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads (seller_id, created_at DESC) WHERE seller_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. refunds — checklist section 5 "refund / cancellation handling"
--
-- Cancellations deliberately do NOT get their own table. orders.status already
-- carries 'cancelled' and order_status_history already records who changed what
-- and when, so a cancellation is a status-history row with the reason in the
-- note. That keeps one audit trail instead of two that can disagree.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason              VARCHAR(60) NOT NULL DEFAULT 'customer_request',
    status              VARCHAR(20) NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'approved', 'rejected', 'processing', 'processed', 'failed')),
    gateway             VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    gateway_refund_id   VARCHAR(150),
    failure_reason      TEXT,
    requested_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_payload    JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_order  ON refunds (order_id, created_at DESC);
-- Guards the gateway against a double-submitted refund reaching Razorpay twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_gateway_ref
    ON refunds (gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;

-- payments.status is CHECK-constrained in V1 and has no 'refunded' value, so a
-- completed refund could not be recorded against its payment at all. The
-- constraint is dropped and rebuilt rather than altered in place: Postgres
-- has no ALTER CONSTRAINT ... REPLACE.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('created', 'success', 'failed', 'cancelled', 'pending_verification', 'refunded', 'partially_refunded'));

-- Abandoned-order sweep (checklist 5.4). NULL means "no expiry", which is the
-- correct value for every order that has already been paid.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_expiring
    ON orders (expires_at) WHERE status = 'pending' AND expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. updated_at triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners;
CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_refunds_updated_at ON refunds;
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
