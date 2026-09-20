-- ============================================================================
-- Migration V5: Database Role Privilege Separation (Agent Least Privilege)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vyapari_agent') THEN
        CREATE ROLE vyapari_agent WITH LOGIN PASSWORD 'vyapari_agent_pass_change_in_prod';
    END IF;
END
$$;

-- Grant read context
GRANT SELECT ON products, categories, orders, order_items, reviews TO vyapari_agent;

-- Grant draft, task, approval, audit creation
GRANT SELECT, INSERT ON product_drafts, agent_tasks, agent_approval_queue, agent_audit_log, policy_chunks TO vyapari_agent;

-- Explicitly revoke all mutations on core commerce tables
REVOKE UPDATE, DELETE, INSERT ON products, orders, order_items, payments, users, cart_items FROM vyapari_agent;
REVOKE UPDATE, DELETE ON agent_approval_queue, agent_audit_log FROM vyapari_agent;
