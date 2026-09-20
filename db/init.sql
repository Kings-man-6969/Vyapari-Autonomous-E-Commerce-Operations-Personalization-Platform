-- ============================================================================
-- VYAPARI PLATFORM — Complete Relational & Vector Schema
-- Target: PostgreSQL 16 with pgvector extension
-- Embedded vector dimension: 384 (model: all-MiniLM-L6-v2)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 1. USERS, PROFILES & AUTHENTICATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'seller', 'admin')),
    phone         VARCHAR(20),
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name    VARCHAR(150) NOT NULL,
    description   TEXT,
    logo_url      TEXT,
    business_info JSONB DEFAULT '{}', -- { gstin: "", pan: "", business_type: "" }
    rating_avg    NUMERIC(3,2) DEFAULT 0.00,
    is_verified   BOOLEAN DEFAULT true, -- simplified demo onboarding
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name  VARCHAR(120) NOT NULL,
    phone      VARCHAR(20) NOT NULL,
    line1      VARCHAR(200) NOT NULL,
    city       VARCHAR(100) NOT NULL,
    state      VARCHAR(100) NOT NULL,
    pincode    VARCHAR(10) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. CATALOG & INVENTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(100) UNIQUE NOT NULL,
    slug      VARCHAR(120) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon_url  TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id      UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title            VARCHAR(200) NOT NULL,
    slug             VARCHAR(250) UNIQUE NOT NULL,
    description      TEXT NOT NULL,
    price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10,2) CHECK (compare_at_price >= price),
    stock_qty        INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    images           JSONB DEFAULT '[]', -- array of image URLs
    attributes       JSONB DEFAULT '{}', -- { color, size, specs, material, brand }
    status           VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'out_of_stock', 'archived')),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. CARTS & WISHLISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (wishlist_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 4. ORDERS, TIMELINE & PAYMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount     NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status           VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
    shipping_address JSONB NOT NULL, -- snapshot of full address at purchase time
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10,2) NOT NULL CHECK (price_at_purchase >= 0),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status     VARCHAR(30) NOT NULL,
    note       TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount           NUMERIC(10,2) NOT NULL,
    status           VARCHAR(30) NOT NULL CHECK (status IN ('created', 'success', 'failed', 'cancelled', 'pending_verification')),
    payment_gateway  VARCHAR(50) DEFAULT 'razorpay',
    provider_ref     VARCHAR(150), -- Razorpay payment ID / order ID
    provider_payload JSONB DEFAULT '{}',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. REVIEWS & NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id             UUID REFERENCES orders(id) ON DELETE SET NULL,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                VARCHAR(200),
    comment              TEXT NOT NULL,
    sentiment_score      NUMERIC(3,2), -- Team B NLP sentiment analysis
    is_verified_purchase BOOLEAN DEFAULT true,
    seller_reply         TEXT,
    seller_reply_at      TIMESTAMP WITH TIME ZONE,
    helpful_count        INTEGER DEFAULT 0,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL, -- order_confirmed, low_stock, ai_approval_required, etc.
    title      VARCHAR(200) NOT NULL,
    body       TEXT NOT NULL,
    link       TEXT,
    is_read    BOOLEAN DEFAULT false,
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. SHARED INTERACTION LOG (Team A + Team B)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_interactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('view', 'click', 'add_to_cart', 'purchase', 'wishlist')),
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. TEAM A — RECOMMENDATION EXTENSIONS (pgvector 384-dim)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_embeddings (
    product_id    UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    embedding     VECTOR(384) NOT NULL, -- all-MiniLM-L6-v2
    model_version VARCHAR(50) DEFAULT 'all-MiniLM-L6-v2',
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preference_embeddings (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    embedding     VECTOR(384) NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_stats_daily (
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stat_date     DATE NOT NULL,
    views         INTEGER DEFAULT 0,
    clicks        INTEGER DEFAULT 0,
    purchases     INTEGER DEFAULT 0,
    region        VARCHAR(100) NOT NULL DEFAULT 'global',
    revenue       NUMERIC(12,2) DEFAULT 0.00,
    PRIMARY KEY (product_id, stat_date, region)
);

CREATE TABLE IF NOT EXISTS recommendation_cache (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    score         NUMERIC(5,4) NOT NULL,
    reason        VARCHAR(50) NOT NULL, -- similar_item, trending, personalized, popular
    generated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 8. TEAM B — AGENTIC SELLER EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_tasks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type      VARCHAR(50) NOT NULL, -- listing_generation, inventory_advisory, support_reply, seo_enhancer
    status         VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    input_payload  JSONB NOT NULL DEFAULT '{}',
    output_payload JSONB DEFAULT '{}',
    error_message  TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at   TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_action_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    tool_used   VARCHAR(100),
    reasoning   TEXT,
    result      JSONB,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_drafts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    title             VARCHAR(200) NOT NULL,
    description       TEXT NOT NULL,
    tags              JSONB DEFAULT '[]',
    category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    confidence        NUMERIC(3,2) DEFAULT 0.85,
    source_images     JSONB DEFAULT '[]',
    seller_notes      TEXT,
    status            VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'published')),
    created_by_task   UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_advisories (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    days_of_stock_left NUMERIC(6,1) NOT NULL,
    demand_trend       VARCHAR(20) NOT NULL CHECK (demand_trend IN ('rising', 'falling', 'stable')),
    recommended_reorder_qty INTEGER DEFAULT 0,
    reasoning          TEXT NOT NULL,
    created_by_task    UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_draft_replies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL CHECK (source_type IN ('order_query', 'review', 'message')),
    source_id       UUID, -- order_id or review_id
    intent          VARCHAR(50) NOT NULL, -- order_status, return_refund, product_question, complaint, review_reply
    draft_response  TEXT NOT NULL,
    risk_level      VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    auto_sent       BOOLEAN DEFAULT false,
    created_by_task UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_approval_queue (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id      UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    item_type    VARCHAR(30) NOT NULL CHECK (item_type IN ('listing_draft', 'inventory_advisory', 'support_reply', 'review_reply')),
    reference_id UUID NOT NULL, -- references product_drafts.id or support_draft_replies.id
    risk_level   VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    payload      JSONB NOT NULL, -- snapshot shown to seller
    status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected')),
    seller_edit  JSONB,
    resolved_at  TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policy_documents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id  UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = platform-wide
    title      VARCHAR(200) NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policy_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
    chunk_text  TEXT NOT NULL,
    embedding   VECTOR(384) NOT NULL, -- all-MiniLM-L6-v2
    chunk_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender          VARCHAR(20) NOT NULL CHECK (sender IN ('seller', 'orchestrator', 'agent')),
    agent_name      VARCHAR(50),
    message         TEXT NOT NULL,
    related_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_interactions_product_time ON user_interactions(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_user_time ON user_interactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_seller ON agent_tasks(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_seller ON agent_approval_queue(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_policy_chunks_doc ON policy_chunks(document_id);

-- pgvector Cosine similarity index (HNSW gives robust search even without warm lists)
CREATE INDEX IF NOT EXISTS idx_product_embeddings_hnsw ON product_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_policy_chunks_hnsw ON policy_chunks USING hnsw (embedding vector_cosine_ops);
