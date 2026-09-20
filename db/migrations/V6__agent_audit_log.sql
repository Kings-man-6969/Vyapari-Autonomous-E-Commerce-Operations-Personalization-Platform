-- ============================================================================
-- Migration V6: Agent Immutable Audit Log & Prompt Versioning
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_type     VARCHAR(50) NOT NULL, -- listing_agent, inventory_advisor, support_rag
    prompt_version VARCHAR(50) NOT NULL, -- e.g. listing_v1.0, inventory_v1.0, support_v1.0
    action_type    VARCHAR(50) NOT NULL, -- generate_listing, inventory_advisory, support_reply
    reference_id   UUID,                 -- references draft_id, advisory_id, or reply_id
    task_id        UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
    input_tokens   INTEGER DEFAULT 0,
    output_tokens  INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_seller ON agent_audit_log(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_prompt ON agent_audit_log(prompt_version);

-- Enforce vyapari_agent role privileges on agent_audit_log
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vyapari_agent') THEN
        GRANT SELECT, INSERT ON agent_audit_log TO vyapari_agent;
        REVOKE UPDATE, DELETE ON agent_audit_log FROM vyapari_agent;
    END IF;
END
$$;
