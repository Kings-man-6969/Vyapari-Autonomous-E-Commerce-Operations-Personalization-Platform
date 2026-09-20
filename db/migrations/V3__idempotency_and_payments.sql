-- ============================================================================
-- Migration V3: Idempotency Records & Payment Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key          TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'completed'
    response     JSONB,
    status_code  INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_records(expires_at);

CREATE TABLE IF NOT EXISTS payment_events (
    event_id     TEXT PRIMARY KEY,
    provider     TEXT NOT NULL DEFAULT 'razorpay',
    event_type   TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive column to orders table for authoritative provider reference
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(150);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(150);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_order ON orders(razorpay_order_id);
