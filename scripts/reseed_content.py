#!/usr/bin/env python3
"""
Re-apply the migration-seeded content that a full seed load destroys.

Why this exists
---------------
`db/seed.sql` starts with `TRUNCATE TABLE ... users ... CASCADE`. `CASCADE` does
not truncate the tables the statement names -- it truncates every table with a
foreign key pointing at them, transitively. `users` is referenced by:

    cms_content.updated_by          the homepage's headline, subcopy, trust bar...
    cms_content_revisions.changed_by
    banners.created_by
    leads.seller_id / assigned_to
    lead_notes.author_id
    seller_pages.seller_id
    ...

Those tables did not exist when the seed was written, so its explicit list does
not mention them and it silently empties them. The symptom is a storefront whose
homepage renders the copy compiled into the bundle instead of the copy in the
database, an admin Content screen with no keys, and a best-sellers list with
nothing in it -- none of which looks like "the seed wiped my content".

The database is not broken when this happens; the migration-seeded rows are just
gone. This script puts back exactly the rows the migrations would have written on
a fresh database, by re-running the migration files' own INSERT statements rather
than by keeping a second copy of the content in this repository. A copy would
drift the first time someone edited the homepage copy.

Usage
-----
    DATABASE_URL=postgresql://... python scripts/reseed_content.py

Idempotent: the migration seeds are `ON CONFLICT DO NOTHING`, so running it twice
changes nothing, and running it on a database that still has the rows changes
nothing. That is also why it is safe to wire into a dev bootstrap.
"""
import asyncio
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "db" / "migrations"

#: (migration file, start marker, end marker) for each idempotent content seed.
#: The markers are literal text from the migrations; if a migration is rewritten
#: so a marker no longer matches, the extractor raises rather than quietly
#: re-seeding nothing -- a silent no-op here is the bug this script fixes.
SEEDS = [
    (
        "V11__content_cms.sql",
        "INSERT INTO cms_content",
        "ON CONFLICT (key) DO NOTHING;",
        "homepage copy",
    ),
]


def extract(filename: str, start: str, end: str, label: str) -> str:
    text = (MIGRATIONS / filename).read_text(encoding="utf-8")
    try:
        begin = text.index(start)
        finish = text.index(end, begin) + len(end)
    except ValueError as exc:
        raise SystemExit(
            f"Could not find the {label} seed in {filename}. The migration has "
            f"probably been rewritten -- update SEEDS in this script."
        ) from exc
    return text[begin:finish]


async def main() -> int:
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 2

    try:
        import asyncpg
    except ImportError:
        print("asyncpg is not installed. Run this from backend-core-py's environment.", file=sys.stderr)
        return 2

    statements = [extract(*seed) for seed in SEEDS]

    conn = await asyncpg.connect(dsn=dsn)
    try:
        for seed, sql in zip(SEEDS, statements):
            # The statement count comes back as "INSERT 0 N"; N is the number of
            # rows the seed *added*, so a re-run reporting 0 is the correct and
            # expected answer rather than a failure.
            status = await conn.execute(sql)
            match = re.search(r"(\d+)\s*$", status)
            added = int(match.group(1)) if match else 0
            print(f"  {seed[3]}: {added} row(s) added")
    finally:
        await conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
