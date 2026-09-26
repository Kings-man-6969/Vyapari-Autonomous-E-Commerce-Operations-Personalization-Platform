-- ============================================================================
-- Migration V7: Seller Showcase Pages
--
-- Premium-tier, Instagram-style public pages for sellers. Reachable at
-- /store/{handle}. Every seller gets a page on the free tier; pro/elite unlock
-- video, highlights, custom themes, reels and analytics (see seller_subscriptions).
--
-- Media is stored in Appwrite Storage; URLs are denormalised onto the row so the
-- FastAPI gateway stays stateless and the frontend needs no vendor SDK.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. seller_pages — the page itself (1:1 with the seller account)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_pages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handle            VARCHAR(50) UNIQUE NOT NULL,
    tagline           VARCHAR(140),
    bio               TEXT,
    -- Set via ALTER below: seller_media must exist before the FK can be declared.
    avatar_media_id   UUID,
    cover_media_id    UUID,
    theme_accent      VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    is_published      BOOLEAN NOT NULL DEFAULT FALSE,
    seo_title         VARCHAR(160),
    seo_description   VARCHAR(320),
    view_count        BIGINT NOT NULL DEFAULT 0,
    launched_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seller_page_accent CHECK (theme_accent ~ '^#[0-9a-fA-F]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_seller_pages_published
    ON seller_pages (is_published, launched_at DESC);

-- ----------------------------------------------------------------------------
-- 2. seller_media — the photo/video grid. product_id enables shoppable posts.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_media (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_page_id    UUID NOT NULL REFERENCES seller_pages(id) ON DELETE CASCADE,
    media_type        VARCHAR(10) NOT NULL DEFAULT 'image',
    storage_provider  VARCHAR(20) NOT NULL DEFAULT 'appwrite',
    storage_id        VARCHAR(128) NOT NULL,
    url               TEXT NOT NULL,
    thumbnail_url     TEXT,
    poster_url        TEXT,
    width             INTEGER,
    height            INTEGER,
    duration_ms       INTEGER,
    caption           TEXT,
    alt_text          VARCHAR(200),
    product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
    view_count        INTEGER NOT NULL DEFAULT 0,
    is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seller_media_type CHECK (media_type IN ('image', 'video')),
    -- Videos must carry a poster so grids never render a black box.
    CONSTRAINT chk_seller_media_video_poster
        CHECK (media_type <> 'video' OR poster_url IS NOT NULL),
    CONSTRAINT chk_seller_media_dims
        CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0)),
    CONSTRAINT chk_seller_media_duration
        CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_seller_media_grid
    ON seller_media (seller_page_id, sort_order) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_seller_media_product ON seller_media (product_id);
CREATE INDEX IF NOT EXISTS idx_seller_media_pinned
    ON seller_media (seller_page_id) WHERE is_pinned AND is_active;

-- ----------------------------------------------------------------------------
-- 3. seller_highlights — circular covers (Instagram-style story highlights)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_highlights (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_page_id    UUID NOT NULL REFERENCES seller_pages(id) ON DELETE CASCADE,
    title             VARCHAR(60) NOT NULL,
    cover_media_id    UUID REFERENCES seller_media(id) ON DELETE SET NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_highlights_page
    ON seller_highlights (seller_page_id, sort_order) WHERE is_active;

-- Exactly one target per item: a media post or a product.
CREATE TABLE IF NOT EXISTS seller_highlight_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    highlight_id      UUID NOT NULL REFERENCES seller_highlights(id) ON DELETE CASCADE,
    media_id          UUID REFERENCES seller_media(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES products(id) ON DELETE CASCADE,
    caption           VARCHAR(200),
    sort_order        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_highlight_item_single_target CHECK (num_nonnulls(media_id, product_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_seller_highlight_items_order
    ON seller_highlight_items (highlight_id, sort_order);

-- ----------------------------------------------------------------------------
-- 4. seller_page_blocks — drag-to-reorder page composition
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_page_blocks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_page_id    UUID NOT NULL REFERENCES seller_pages(id) ON DELETE CASCADE,
    block_type        VARCHAR(30) NOT NULL,
    title             VARCHAR(140),
    subtitle          VARCHAR(280),
    config            JSONB NOT NULL DEFAULT '{}'::jsonb,
    cta_label         VARCHAR(60),
    cta_href          VARCHAR(300),
    -- Scheduled promos: a block only renders inside its window.
    starts_at         TIMESTAMPTZ,
    ends_at           TIMESTAMPTZ,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seller_block_type CHECK (block_type IN (
        'hero_banner', 'announcement', 'featured_collection',
        'media_grid', 'reels', 'testimonials'
    )),
    CONSTRAINT chk_seller_block_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    -- cta_href must stay same-origin or absolute https: no javascript:/data: URLs.
    CONSTRAINT chk_seller_block_cta_safe CHECK (
        cta_href IS NULL
        OR cta_href ~ '^/'
        OR cta_href ~ '^https://'
    )
);

CREATE INDEX IF NOT EXISTS idx_seller_blocks_page
    ON seller_page_blocks (seller_page_id, sort_order) WHERE is_active;

-- ----------------------------------------------------------------------------
-- 5. seller_subscriptions — premium entitlement
--
-- Billing is deliberately NOT wired here: the gateway grants plans (or an admin
-- does) and Razorpay Subscriptions is attached to an existing entitlement row
-- later. One live subscription per seller, enforced by a partial unique index.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan              VARCHAR(20) NOT NULL DEFAULT 'free',
    status            VARCHAR(20) NOT NULL DEFAULT 'active',
    starts_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at           TIMESTAMPTZ,
    auto_renew        BOOLEAN NOT NULL DEFAULT FALSE,
    price_inr         NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_provider  VARCHAR(30),
    payment_ref       VARCHAR(150),
    granted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_seller_plan CHECK (plan IN ('free', 'pro', 'elite')),
    CONSTRAINT chk_seller_sub_status CHECK (status IN (
        'trialing', 'active', 'past_due', 'cancelled', 'expired'
    )),
    CONSTRAINT chk_seller_sub_price CHECK (price_inr >= 0),
    CONSTRAINT chk_seller_sub_window CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_live_subscription
    ON seller_subscriptions (seller_id)
    WHERE status IN ('trialing', 'active');
CREATE INDEX IF NOT EXISTS idx_seller_subs_status
    ON seller_subscriptions (status, ends_at);

-- ----------------------------------------------------------------------------
-- 6. seller_page_follows — followers (drives the follow button and the
--    user_interactions stream that is currently never written)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_page_follows (
    seller_page_id    UUID NOT NULL REFERENCES seller_pages(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (seller_page_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_follows_user
    ON seller_page_follows (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Circular FK: seller_pages -> seller_media (now that seller_media exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_page_avatar'
    ) THEN
        ALTER TABLE seller_pages
            ADD CONSTRAINT fk_seller_page_avatar
            FOREIGN KEY (avatar_media_id) REFERENCES seller_media(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_seller_page_cover'
    ) THEN
        ALTER TABLE seller_pages
            ADD CONSTRAINT fk_seller_page_cover
            FOREIGN KEY (cover_media_id) REFERENCES seller_media(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 8. updated_at maintenance
--
-- The rest of the schema declares updated_at columns but never refreshes them
-- (there were zero triggers in the project). This shared function fixes that
-- for the V7 tables without touching the legacy ones.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_pages_updated_at ON seller_pages;
CREATE TRIGGER trg_seller_pages_updated_at
    BEFORE UPDATE ON seller_pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_seller_media_updated_at ON seller_media;
CREATE TRIGGER trg_seller_media_updated_at
    BEFORE UPDATE ON seller_media
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_seller_highlights_updated_at ON seller_highlights;
CREATE TRIGGER trg_seller_highlights_updated_at
    BEFORE UPDATE ON seller_highlights
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_seller_blocks_updated_at ON seller_page_blocks;
CREATE TRIGGER trg_seller_blocks_updated_at
    BEFORE UPDATE ON seller_page_blocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_seller_subs_updated_at ON seller_subscriptions;
CREATE TRIGGER trg_seller_subs_updated_at
    BEFORE UPDATE ON seller_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
