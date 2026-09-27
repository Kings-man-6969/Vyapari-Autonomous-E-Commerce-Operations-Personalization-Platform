-- =============================================================================
-- V12 — leads: an internal note log, and the index the inbox actually sorts on
--
-- Section H. `leads` exists from V8 and has never had a row written by any
-- code. Nothing here changes that table; this adds the one thing an inbox needs
-- that a single TEXT column cannot provide.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. lead_notes
--
-- `leads.notes` is a single TEXT column, and a column cannot hold a history. Two
-- admins working the same enquiry would overwrite each other, and the note that
-- said "customer asked us to call after 6pm" would be gone with no trace of who
-- removed it -- which is the same failure the CMS revision table exists to
-- prevent, in a place where it matters more because a lead is a person waiting
-- for a reply.
--
-- So notes append, each with its author and its timestamp.
--
--     lead_notes  the append-only log, shown on the enquiry
--     leads.notes the most recent entry, denormalised
--
-- The denormalised copy is deliberate: the inbox list shows the latest note on
-- every row, and reading it from the log would be a lateral join per row over a
-- table that only grows. It is written in the same statement as the log row, so
-- the two cannot drift.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    -- Who wrote it. A note with no author is a note nobody can be asked about.
    author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A blank note is a row that says nothing and still renders a timestamp.
    CONSTRAINT chk_lead_note_body CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes (lead_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. The inbox's default sort
--
-- V8 indexed `(status, created_at DESC)` and `(seller_id, created_at DESC)`.
-- The unfiltered first page of the inbox -- the view every admin opens -- orders
-- by `created_at DESC` alone and had no index for it, so it was a full sort of
-- the table on every load.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Search
--
-- The inbox searches name, email, phone and message. `ILIKE '%term%'` cannot use
-- a btree index, and a trigram index is the correct tool for it. pg_trgm is an
-- extension, so this is conditional: an environment whose role cannot CREATE
-- EXTENSION still gets a working inbox, just a slower search, rather than a
-- migration that fails and blocks the deploy.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_leads_search_trgm
            ON leads USING gin (
                (coalesce(name, '') || ' ' || coalesce(email, '') || ' ' ||
                 coalesce(phone, '') || ' ' || coalesce(message, '')) gin_trgm_ops
            );
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        -- The index is an optimisation. Failing the migration over it would be
        -- trading a working, slower inbox for no inbox at all.
        RAISE NOTICE 'pg_trgm not available; lead search falls back to a sequential scan';
END;
$$;
