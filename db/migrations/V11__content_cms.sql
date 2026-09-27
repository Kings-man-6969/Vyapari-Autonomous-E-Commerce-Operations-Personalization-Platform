-- =============================================================================
-- V11 — content: CMS-lite homepage copy, and a banner storage_provider that
--       names a provider this platform actually has
--
-- Section G. The `banners` table already exists (V8) and has never had a
-- single row written by any code. `cms_content` is new: it is what makes the
-- homepage's headline, subcopy, trust bar and section titles editable without
-- a code change and a deploy.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. cms_content
--
-- Key/value rather than columns-per-section, so adding a section is an insert
-- and not a migration. The key is the contract between the API and the
-- storefront; a section the frontend does not know about is inert, and a
-- section the frontend expects that is missing here falls back to the copy
-- that is compiled in, so a half-applied deploy shows the old page rather than
-- a blank one.
--
-- `value` is JSONB and deliberately untyped. Validating the shape of a hero
-- block in the database would mean a migration every time a field is added,
-- which is the opposite of the point.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_content (
    key         VARCHAR(60) PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Who last changed it. A CMS edit with no author is an edit nobody can be
    -- asked about when the homepage looks wrong.
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Revision trail
--
-- A CMS without history cannot recover from a bad edit, and "someone changed
-- the headline and now the homepage is wrong" is otherwise unanswerable. One
-- row per save, previous value included, capped by nothing here: this table
-- grows with admin actions, not with traffic.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_content_revisions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(60) NOT NULL,
    previous    JSONB,
    next        JSONB NOT NULL,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_revisions_key ON cms_content_revisions (key, changed_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Seed the homepage from the copy that is currently hardcoded in
--    HomePage.jsx.
--
-- Every value below is transcribed from the JSX it replaces, verbatim. The
-- point is that landing this migration changes nothing a visitor can see: the
-- page renders the same words, and only then does an admin gain the ability to
-- change them. A migration that also rewrites the marketing copy is a migration
-- nobody can review.
--
-- `home.categories` and `home.trust_bar` are arrays because their sections are
-- repeated lists of the same shape. `home.hero` and `home.trending` are objects
-- because their sections are not. A section that is not in this table does not
-- exist as editable content, so nothing here is "extra" -- an unused key would
-- be a claim that a part of the page is editable when it is not.
-- ----------------------------------------------------------------------------
INSERT INTO cms_content (key, value) VALUES
('home.hero', '{
    "eyebrow": "Mega Savings • Limited Time Deals",
    "headline": "Great Deals on Everything You Love",
    "subcopy": "Discover top-rated products from verified independent merchants. Enjoy free delivery on eligible orders, secure checkout, and easy 7-day returns.",
    "primary_cta":   {"label": "Shop All Deals",     "to": "/explore"},
    "secondary_cta": {"label": "Top Rated Products", "to": "/explore?sort=rating"}
}'::jsonb),
('home.trust_bar', '[
    {"icon": "truck",      "title": "Free Fast Delivery",     "body": "On orders over ₹499"},
    {"icon": "rotate-ccw", "title": "7-Day Easy Returns",     "body": "Hassle-free replacement or refund"},
    {"icon": "shield",     "title": "100% Genuine Products",  "body": "From verified sellers"},
    {"icon": "card",       "title": "Secure Payments",        "body": "Cards, UPI & Net Banking"}
]'::jsonb),
('home.categories', '{
    "headline": "Explore Popular Categories",
    "cards": [
        {"icon": "tv",       "to": "/explore?category=1", "title": "Electronics & Audio",
         "body": "Headphones, speakers, smart watches and premium gadgets.",
         "cta_label": "Shop Electronics"},
        {"icon": "shirt",    "to": "/explore?category=2", "title": "Fashion & Apparel",
         "body": "Designer apparel, handcrafted streetwear and accessories.",
         "cta_label": "Shop Fashion"},
        {"icon": "home",     "to": "/explore?category=3", "title": "Home & Living",
         "body": "Minimalist ceramics, cookware and modern decor.",
         "cta_label": "Shop Home"},
        {"icon": "sparkles", "to": "/explore?sort=rating", "title": "Best Sellers",
         "body": "Highest-rated customer favorites and verified bestsellers.",
         "cta_label": "Explore Best Sellers"}
    ]
}'::jsonb),
('home.trending', '{
    "headline": "Trending Deals of the Day",
    "subcopy":  "Handpicked top offers with special price reductions",
    "cta":      {"label": "See all deals", "to": "/explore"}
}'::jsonb),
('home.seller_cta', '{
    "eyebrow": "Merchant Marketplace",
    "headline": "Sell on Vyapari & Grow Your Business",
    "subcopy": "Reach customers nationwide. List products with AI assistance, manage your orders seamlessly, and receive fast, guaranteed payouts.",
    "cta": {"label": "Become a Seller", "to": "/seller/onboarding"}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. banners.storage_provider defaulted to a provider that does not exist
--
-- V8 shipped this column with DEFAULT 'appwrite'. Section D evaluated the
-- storage providers and rejected Appwrite; the two that are actually
-- implemented are `local` and `s3` (see app/storage/). So a banner created
-- without naming a provider was labelled with a provider the platform has no
-- code for -- it would render from `url` and quietly carry a meaningless label
-- in every admin list, and nothing would complain.
--
-- Existing rows are corrected rather than left alone, and the DEFAULT is
-- constrained so the next one cannot repeat it.
-- ----------------------------------------------------------------------------
UPDATE banners SET storage_provider = 'local' WHERE storage_provider = 'appwrite';

ALTER TABLE banners ALTER COLUMN storage_provider SET DEFAULT 'local';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_banner_storage_provider'
    ) THEN
        ALTER TABLE banners
            ADD CONSTRAINT chk_banner_storage_provider
            CHECK (storage_provider IN ('local', 's3'));
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. A banner that has no url cannot render, and one with a video needs a
--    poster or the slot shows a black rectangle while the file loads.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_banners_placement_window
    ON banners (placement, sort_order, start_at DESC)
    WHERE is_active;
