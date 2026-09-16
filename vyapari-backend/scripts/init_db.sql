-- Vyapari DB init script — runs once when the Postgres container is first created.
-- Enables the pgvector extension required for AI/ML embedding storage.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fast LIKE/ILIKE search
