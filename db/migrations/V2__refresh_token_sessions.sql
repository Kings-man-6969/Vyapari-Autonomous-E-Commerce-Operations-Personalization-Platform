-- ============================================================================
-- Migration V2: Refresh Token Sessions with Family Rotation
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_token_sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    family_id    UUID NOT NULL,
    rotated_from UUID REFERENCES refresh_token_sessions(session_id),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_token_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_token_sessions(user_id);
