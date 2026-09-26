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

-- Grant draft, task, approval creation.
-- NOTE: agent_audit_log is intentionally NOT granted here — it is created in V6.
-- Referencing it in this migration aborts a sequential V1->Vn run with
-- 'relation "agent_audit_log" does not exist'. V6 re-applies its own grants.
GRANT SELECT, INSERT ON product_drafts, agent_tasks, agent_approval_queue, policy_chunks TO vyapari_agent;
GRANT UPDATE ON agent_tasks TO vyapari_agent;

-- Tables the agent endpoints write to but which were previously ungranted,
-- causing InsufficientPrivilegeError with the least-privilege DSN.
GRANT SELECT, INSERT ON inventory_advisories, support_draft_replies TO vyapari_agent;

-- Explicitly revoke all mutations on core commerce tables
REVOKE UPDATE, DELETE, INSERT ON products, orders, order_items, payments, users, cart_items FROM vyapari_agent;
REVOKE UPDATE, DELETE ON agent_approval_queue FROM vyapari_agent;
