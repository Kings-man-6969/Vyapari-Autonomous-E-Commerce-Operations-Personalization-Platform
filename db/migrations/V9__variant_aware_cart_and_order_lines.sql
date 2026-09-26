-- =============================================================================
-- V9: make the cart and order lines variant-aware
--
-- V8 created product_variants and hung cart_items.variant_id / order_items.variant_id
-- off the side of the existing tables. That was enough for the schema to be
-- coherent and not enough for the feature to work, for two reasons.
--
-- 1. cart_items was UNIQUE (cart_id, product_id).
--    With a variant_id column present but absent from the key, adding a Medium
--    and then a Large of the same shirt is a single upsert target: the second
--    add silently increments the first line's quantity and the customer ends up
--    with four Mediums and no option to change that. The key has to include the
--    variant.
--
--    NULLS NOT DISTINCT (PostgreSQL 15+) is required, not a nicety. Under the
--    default NULLS DISTINCT, every legacy row -- variant_id IS NULL, which is
--    all 10,057 seeded products' carts -- would compare as distinct from every
--    other legacy row, so the constraint would hold no constraint at all. A
--    plain unique index here silently fails open, which is worse than not
--    having one.
--
-- 2. Nothing stopped a cart line or an order line from pointing at a variant
--    belonging to a *different* product.
--    A client sends {"product_id": "...", "variant_id": "..."}; if those two
--    disagree, the order path can end up charging a product's price for
--    another product's variant, and the order line will not reconcile against
--    the catalogue later. Application code validating this is a race and a
--    future bug away; the database is the last place it can be enforced.
--
-- Deliberately NOT enforced: that variant_id IS NOT NULL whenever
-- products.has_variants is true. A seller flipping the flag on for a live
-- product would have that requirement fail on every cart line they already
-- have, which is a worse failure than the ambiguity it prevents. Instead
-- app/variants.py resolves a NULL variant_id on a variant-bearing product to
-- that product's default variant, and a default variant is guaranteed to
-- exist. See resolve_purchase_line().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Variant-aware cart identity
-- -----------------------------------------------------------------------------
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_key;
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_id_variant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_product_variant
    ON cart_items (cart_id, product_id, variant_id) NULLS NOT DISTINCT;

-- The ON CONFLICT target in the cart route has to name this index's columns.
--
-- Note for whoever edits the cart upsert: NULLS NOT DISTINCT is index-creation
-- syntax only. Writing it in the inference clause --
--   ON CONFLICT (cart_id, product_id, variant_id) NULLS NOT DISTINCT
-- -- is a syntax error at or near "NULLS". Inference matches the index on the
-- column list alone, so the clause reads simply:
--   ON CONFLICT (cart_id, product_id, variant_id) DO UPDATE ...
COMMENT ON INDEX uq_cart_items_product_variant IS
    'Upsert key for POST /api/cart/items. Includes variant_id, so two sizes of one product are two lines. NULLS NOT DISTINCT keeps a NULL variant_id a single line.';

-- -----------------------------------------------------------------------------
-- 2. A line's variant must belong to the line's product
-- -----------------------------------------------------------------------------
-- Enforced by trigger rather than CHECK because it spans two tables, which
-- SQL CHECK constraints cannot express. The ownership relation is immutable
-- once written (only this trigger may change a line's product_id/variant_id),
-- which is what makes a row-level BEFORE trigger sufficient: no transaction can
-- observe a violation after the fact.
--
-- Deferrable, because order placement inserts the order and its items in
-- sequence; the variant exists long before, but the check is on the pair and
-- there is no ordering requirement to impose.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assert_line_variant_ownership() RETURNS TRIGGER AS $$
DECLARE
    owner UUID;
BEGIN
    IF NEW.variant_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT product_id INTO owner
      FROM product_variants
     WHERE id = NEW.variant_id;

    IF owner IS NULL THEN
        RAISE EXCEPTION
            'variant % referenced by % does not exist', NEW.variant_id, TG_TABLE_NAME
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF owner <> NEW.product_id THEN
        RAISE EXCEPTION
            'variant % belongs to product %, not %', NEW.variant_id, owner, NEW.product_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cart_items_variant_ownership ON cart_items;
CREATE TRIGGER trg_cart_items_variant_ownership
    BEFORE INSERT OR UPDATE OF product_id, variant_id ON cart_items
    FOR EACH ROW EXECUTE FUNCTION assert_line_variant_ownership();

DROP TRIGGER IF EXISTS trg_order_items_variant_ownership ON order_items;
CREATE TRIGGER trg_order_items_variant_ownership
    BEFORE INSERT OR UPDATE OF product_id, variant_id ON order_items
    FOR EACH ROW EXECUTE FUNCTION assert_line_variant_ownership();

-- -----------------------------------------------------------------------------
-- 3. Indexes the new read paths need
-- -----------------------------------------------------------------------------
-- Attributes are free-form jsonb and the PDP has to ask "which sizes does this
-- product offer, in stock" without loading every variant row.
CREATE INDEX IF NOT EXISTS idx_product_variants_attributes
    ON product_variants USING GIN (attributes);

-- Two variants with the same attribute set are indistinguishable in a picker:
-- the customer sees two identical "Medium" swatches and cannot tell which is
-- which, and the second silently shadows the first. Rejecting the pair at the
-- storage layer means no API, no import script and no future service can
-- create one by accident.
--
-- jsonb's equality operator is semantic rather than textual, so this holds
-- regardless of key order or whitespace: {"size":"M","colour":"Red"} and
-- {"colour":"Red","size":"M"} are the same value and collide. That is the
-- behaviour wanted, and it is also why the index works on jsonb at all.
--
-- The default '{}' participates like any other value, so two attribute-less
-- variants of one product are rejected too. That is correct: an attribute-less
-- variant is the product wearing a hat, and app/variants.py requires at least
-- one axis on create.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_attributes
    ON product_variants (product_id, attributes);

-- The default-variant lookup is the NULL-variant_id fallback in
-- app/variants.py. It runs on every order line for a variant-bearing product,
-- and the existing partial unique index uq_product_variants_default is on
-- (product_id) WHERE is_default, which already serves it. Left alone
-- deliberately rather than adding a second index over the same rows.

-- Sellers list variants per product ordered for the editor.
CREATE INDEX IF NOT EXISTS idx_product_variants_editor
    ON product_variants (product_id, sort_order, created_at);

-- -----------------------------------------------------------------------------
-- 4. has_variants must mean "the trigger maintains my stock"
-- -----------------------------------------------------------------------------
-- A product with has_variants = TRUE and no active variants reports
-- stock_qty = 0 and is unsellable, which is a legitimate state (all sizes
-- retired) and is left alone. What must never happen is a product with
-- has_variants = TRUE whose stock_qty is hand-edited, because the next
-- variant write silently overwrites it and the edit appears to do nothing.
-- Flag the inconsistency instead of blocking the write: a seller bulk-importing
-- variants should not have the last insert fail and lose the transaction.
--
-- Raised as a warning rather than an exception on purpose. This is a
-- diagnostic, and the alternative -- a hard failure -- would turn a data-entry
-- mistake into an outage during a listing import.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION warn_on_variant_stock_edit() RETURNS TRIGGER AS $$
DECLARE
    authored BOOLEAN;
BEGIN
    IF OLD.has_variants OR NEW.has_variants THEN
        IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
            SELECT has_variants INTO authored FROM products WHERE id = NEW.id;
            IF authored THEN
                RAISE WARNING
                    'products.stock_qty written directly on product %, which has variants; the value is derived from product_variants and this edit will be overwritten',
                    NEW.id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_variant_stock_authored ON products;
CREATE TRIGGER trg_products_variant_stock_authored
    BEFORE UPDATE OF stock_qty ON products
    FOR EACH ROW EXECUTE FUNCTION warn_on_variant_stock_edit();
