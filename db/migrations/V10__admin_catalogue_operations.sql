-- ============================================================================
-- Migration V10: Admin catalogue operations
--
-- Three things the admin panel cannot do without a schema change:
--
--   1. categories.description exists in the API but not in the database.
--      `POST /api/admin/categories` accepts a `description`, returns
--      "Category created successfully", and never stores it. Nothing read it
--      back, so it went unnoticed. Fixed here rather than by dropping the
--      field, because the field is what an admin actually types.
--
--   2. An audit trail for admin stock edits. `stock_qty` is a bare integer that
--      anybody with admin rights can overwrite in one request, and an
--      unexplained drop from 40 to 0 on a live listing is indistinguishable
--      from a bug. Every admin write to a product or variant stock now leaves a
--      row saying who did it, from what, to what, and why.
--
--   3. Indexes for the order list an admin will actually run: newest first,
--      filtered by status, and searched by id. The existing index is
--      (user_id, created_at DESC), which cannot serve either.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The category description that was being thrown away
-- ----------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;

-- ----------------------------------------------------------------------------
-- 2. Stock movements
--
-- variant_id is NULL for a plain product and set for a variant line, matching
-- the rule the API enforces: a product with variants never has its own stock
-- edited directly, because the V8 trigger owns that column.
--
-- UNIQUE (product_id, variant_id, created_at) is deliberately absent. Two
-- admins correcting the same listing in the same millisecond is not a
-- conflict, it is a race, and the losing write is still worth recording.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_stock_movements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    previous_qty INTEGER NOT NULL,
    new_qty      INTEGER NOT NULL,
    reason       TEXT,
    actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- A movement is a correction, never a negative: stock is a count of things
    -- that exist, and the CHECK on products.stock_qty already agrees.
    CONSTRAINT product_stock_movements_non_negative
        CHECK (previous_qty >= 0 AND new_qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
    ON product_stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_actor
    ON product_stock_movements(actor_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Admin order list indexes
--
-- The list is "newest first, optionally one status", which is
-- (status, created_at DESC) for the filtered case and (created_at DESC) for
-- the unfiltered one. Both, because the unfiltered sort is the default and
-- would otherwise fall back to a sequential scan over the whole table.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Searching an order by its short id. The id is a uuid, so a prefix match is
-- the useful operation and btree serves it as a range scan.
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;
