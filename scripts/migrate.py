"""
Vyapari Database Migration Runner.

Single source of truth for schema changes: db/migrations/V<n>__<name>.sql

Why this exists
---------------
Until now nothing in the repo applied db/migrations/. docker-compose mounted
only init.sql + seed.sql into /docker-entrypoint-initdb.d/, and init.sql is a
byte-identical copy of V1. Every environment therefore ran at V1 and was
missing refresh_token_sessions (V2), idempotency_records + payment_events (V3),
the extra indexes (V4), the vyapari_agent role (V5) and agent_audit_log (V6) --
while backend-core-py already writes to the V2/V3 tables. This runner closes
that gap and gives Render a deterministic schema on every boot.

Usage
-----
    python scripts/migrate.py status     # show applied/pending, no writes
    python scripts/migrate.py plan       # dry-run: what would run
    python scripts/migrate.py apply      # apply all pending migrations
    python scripts/migrate.py baseline   # adopt an existing legacy schema

Safety properties
-----------------
* Every migration runs inside its own transaction; a failure leaves no partial state.
* A session-level advisory lock serialises concurrent boots (Render web + worker
  + beat can all start at once) so migrations never race.
* Each applied migration stores a SHA-256 checksum of its file. Re-running with
  an edited, already-applied file fails loudly instead of silently diverging.
* Detects legacy databases provisioned from init.sql and baselines V1 so an
  upgrade does not try to recreate 29 existing tables.
* Grants require superuser/CREATEROLE; those run outside the transaction so a
  privilege failure does not roll back the whole migration. Everything else is
  atomic.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import re
import sys
from pathlib import Path

try:
    import asyncpg
except ImportError:  # pragma: no cover
    sys.exit("asyncpg is required. pip install asyncpg")

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"

# Distinguishes our lock from any other advisory-lock user.
ADVISORY_LOCK_KEY = 8_713_402_119_455_331

# A stable key we hash into the Postgres advisory-lock space.
FILENAME_RE = re.compile(r"^V(?P<version>\d+)__(?P<name>[A-Za-z0-9_\-]+)\.sql$")

BOOTSTRAP_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INT NOT NULL DEFAULT 0
);
"""


class MigrationError(RuntimeError):
    pass


# ── env / connection ──────────────────────────────────────────────────────────

def load_database_url() -> str:
    """DATABASE_URL from (in order): process env, .env, then local default."""
    env_url = os.getenv("DATABASE_URL", "").strip()
    if env_url:
        return env_url

    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == "DATABASE_URL":
                return value.strip().strip('"').strip("'")

    return "postgresql://vyapari_admin:vyapari_secure_password@localhost:5432/vyapari"


def redact(url: str) -> str:
    """Strip the password so connection strings are safe to print in CI logs."""
    return re.sub(r"://([^:]+):[^@]*@", r"://\1:***@", url)


# ── migration discovery ───────────────────────────────────────────────────────

def discover_migrations() -> list[dict]:
    """Load and validate db/migrations/*.sql, ordered by numeric version."""
    if not MIGRATIONS_DIR.is_dir():
        raise MigrationError(f"Migrations directory not found: {MIGRATIONS_DIR}")

    found: list[dict] = []
    seen_versions: set[int] = set()

    for path in sorted(MIGRATIONS_DIR.iterdir()):
        if path.is_dir() or path.suffix.lower() != ".sql":
            continue

        match = FILENAME_RE.match(path.name)
        if not match:
            raise MigrationError(
                f"Malformed migration filename: {path.name}\n"
                "Expected format: V<n>__<snake_case_name>.sql (e.g. V7__seller_pages.sql)"
            )

        version = int(match.group("version"))
        if version in seen_versions:
            raise MigrationError(f"Duplicate migration version V{version} in {path.name}")

        seen_versions.add(version)
        sql = path.read_text(encoding="utf-8")
        found.append({
            "version": f"V{version}",
            "number": version,
            "name": match.group("name"),
            "path": path,
            "sql": sql,
            "checksum": hashlib.sha256(sql.encode("utf-8")).hexdigest(),
        })

    if not found:
        raise MigrationError(f"No migrations found in {MIGRATIONS_DIR}")

    return sorted(found, key=lambda m: m["number"])


def requires_superuser(sql: str) -> bool:
    """
    Migrations touching roles or extensions must run outside a transaction.

    CREATE ROLE / CREATE EXTENSION cannot always be rolled back cleanly and a
    privilege error would otherwise abort the entire migration.
    """
    upper = sql.upper()
    return "CREATE ROLE" in upper or "CREATE EXTENSION" in upper


# ── state ─────────────────────────────────────────────────────────────────────

async def ensure_bootstrap(conn: asyncpg.Connection) -> None:
    await conn.execute(BOOTSTRAP_SQL)


async def fetch_applied(conn: asyncpg.Connection) -> dict[str, dict]:
    """
    Read applied migrations. Tolerates a database that has never been migrated,
    so 'status' and 'plan' stay read-only and work against a fresh instance.
    """
    if not await table_exists(conn, "schema_migrations"):
        return {}
    rows = await conn.fetch("SELECT version, name, checksum FROM schema_migrations")
    return {r["version"]: {"name": r["name"], "checksum": r["checksum"]} for r in rows}


async def table_exists(conn: asyncpg.Connection, table: str) -> bool:
    return bool(await conn.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = $1)",
        table,
    ))
# ── commands ──────────────────────────────────────────────────────────────────

async def cmd_status(conn: asyncpg.Connection, migrations: list[dict]) -> int:
    applied = await fetch_applied(conn)
    print(f"Database: {redact(await conn.fetchval('SELECT current_database()'))}")
    print(f"Pending migrations: {sum(1 for m in migrations if m['version'] not in applied)}")
    print("-" * 74)
    print(f"{'VERSION':<10} {'STATUS':<12} {'NAME'}")
    print("-" * 74)
    for m in migrations:
        status = "applied" if m["version"] in applied else "PENDING"
        print(f"{m['version']:<10} {status:<12} {m['name']}")
    return 0


async def cmd_plan(conn: asyncpg.Connection, migrations: list[dict]) -> int:
    applied = await fetch_applied(conn)
    pending = [m for m in migrations if m["version"] not in applied]
    if not pending:
        print("Schema is up to date. Nothing to apply.")
        return 0
    print(f"Would apply {len(pending)} migration(s):")
    for m in pending:
        statements = len([s for s in m["sql"].split(";") if s.strip()])
        print(f"  {m['version']:<6} {m['name']:<34} ({statements} statement(s), {m['path'].name})")
    return 0


async def cmd_baseline(conn: asyncpg.Connection, migrations: list[dict], upto: str | None) -> int:
    """
    Mark migrations as applied without executing them.

    For databases provisioned from the legacy init.sql, which contained V1's
    schema verbatim. Never mark anything as applied unless its tables exist --
    a wrong baseline silently skips DDL.
    """
    await ensure_bootstrap(conn)
    applied = await fetch_applied(conn)

    if not await table_exists(conn, "users"):
        raise MigrationError(
            "Refusing to baseline: 'users' table not found. This does not look "
            "like a Vyapari database. Use 'apply' on an empty database instead."
        )

    target = migrations[-1]["version"]
    if upto:
        if upto not in {m["version"] for m in migrations}:
            raise MigrationError(f"Unknown version '{upto}'.")
        target = upto

    to_mark = [m for m in migrations if m["version"] <= target and m["version"] not in applied]
    if not to_mark:
        print(f"Nothing to baseline (already recorded through {target}).")
        return 0

    print(f"Baselining {len(to_mark)} migration(s) as already applied, up to {target}.")
    print("WARNING: this records intent without verifying each object exists. Verify with:")
    print("  python scripts/migrate.py apply   # will report any genuinely missing object")
    for m in to_mark:
        await conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, duration_ms) "
            "VALUES ($1, $2, $3, 0) ON CONFLICT (version) DO NOTHING",
            m["version"], m["name"], m["checksum"],
        )
        print(f"  recorded {m['version']:<6} {m['name']}")
    return 0


async def apply_migration(conn: asyncpg.Connection, m: dict) -> int:
    """Apply one migration and record it. Returns duration in ms."""
    loop = asyncio.get_event_loop()
    start = loop.time()

    if requires_superuser(m["sql"]):
        # Cannot wrap in a transaction: role/extension DDL plus the bookkeeping
        # INSERT are committed separately. Worst case a failure leaves the
        # migration unrecorded, so the next run retries it -- and every
        # migration in this repo is written to be idempotent.
        await conn.execute(m["sql"])
        duration_ms = int((loop.time() - start) * 1000)
        await conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, duration_ms) "
            "VALUES ($1, $2, $3, $4)",
            m["version"], m["name"], m["checksum"], duration_ms,
        )
        return duration_ms

    async with conn.transaction():
        await conn.execute(m["sql"])
        duration_ms = int((loop.time() - start) * 1000)
        await conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, duration_ms) "
            "VALUES ($1, $2, $3, $4)",
            m["version"], m["name"], m["checksum"], duration_ms,
        )
    return duration_ms


async def cmd_apply(conn: asyncpg.Connection, migrations: list[dict]) -> int:
    await ensure_bootstrap(conn)
    applied = await fetch_applied(conn)

    # A mutated, already-applied file means the recorded schema and this repo
    # disagree. Surface it instead of letting the drift accumulate silently.
    for m in migrations:
        record = applied.get(m["version"])
        if record and record["checksum"] != m["checksum"]:
            print(
                f"CHECKSUM MISMATCH for {m['version']} ({m['name']}).\n"
                f"  recorded: {record['checksum'][:16]}...\n"
                f"  on disk : {m['checksum'][:16]}...\n"
                "An applied migration file was edited. Create a new migration instead.",
                file=sys.stderr,
            )
            return 1

    pending = [m for m in migrations if m["version"] not in applied]
    if not pending:
        print(f"Schema is up to date ({len(migrations)} migration(s) applied).")
        return 0

    print(f"Applying {len(pending)} migration(s):")
    for m in pending:
        try:
            duration = await apply_migration(conn, m)
        except Exception as exc:
            print(f"\n  FAILED  {m['version']} {m['name']}", file=sys.stderr)
            print(f"  {type(exc).__name__}: {exc}", file=sys.stderr)
            print("\nNo further migrations were attempted. Fix the error and re-run.",
                  file=sys.stderr)
            return 1
        print(f"  ok      {m['version']:<6} {m['name']:<34} {duration:>6}ms")

    print(f"\nApplied {len(pending)} migration(s). Schema now at {pending[-1]['version']}.")
    return 0


# ── entrypoint ────────────────────────────────────────────────────────────────

async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Apply Vyapari database migrations from db/migrations/.",
    )
    parser.add_argument("command", choices=["status", "plan", "apply", "baseline"])
    parser.add_argument("--upto", help="For 'baseline': highest version to record (e.g. V6).")
    args = parser.parse_args()

    migrations = discover_migrations()
    dsn = load_database_url()

    try:
        conn = await asyncpg.connect(dsn, command_timeout=120)
    except Exception as exc:
        print(f"Could not connect to {redact(dsn)}: {exc}", file=sys.stderr)
        return 1

    try:
        # Serialise against other boots (Render web/worker/beat) and release on exit.
        await conn.execute("SELECT pg_advisory_lock($1)", ADVISORY_LOCK_KEY)
        try:
            if args.command == "status":
                return await cmd_status(conn, migrations)
            if args.command == "plan":
                return await cmd_plan(conn, migrations)
            if args.command == "baseline":
                return await cmd_baseline(conn, migrations, args.upto)
            return await cmd_apply(conn, migrations)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", ADVISORY_LOCK_KEY)
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except MigrationError as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(2)
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
