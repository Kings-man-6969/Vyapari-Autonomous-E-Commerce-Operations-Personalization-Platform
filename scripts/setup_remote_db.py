#!/usr/bin/env python3
"""
Vyapari Platform — Remote Database Provisioning & Seeding Utility

Provisions a remote PostgreSQL (Aiven, Neon, RDS, DigitalOcean, ...) to the
current schema:

    1. bootstrap extensions from db/init.sql
    2. apply db/migrations/V1..Vn in order via scripts/migrate.py
    3. optionally seed the 10k demo catalog from db/seed.sql

Exits non-zero on any failure, so it is safe to use as a Render pre-deploy
command or a CI step.

Usage:
    python scripts/setup_remote_db.py --db-url "postgres://user:PASS@host:5432/db?sslmode=require"
    python scripts/setup_remote_db.py --no-seed          # schema only, no 41MB seed
    python scripts/setup_remote_db.py --migrate-only     # apply pending migrations
    python scripts/setup_remote_db.py                    # read DATABASE_URL from .env
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

# Ensure utf-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import asyncpg
except ImportError:
    print("[!] asyncpg is not installed. Please run: pip install asyncpg")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from migrate import discover_migrations, redact  # noqa: E402

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env_database_url() -> str | None:
    env_file = ROOT_DIR / ".env"
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL=") and not line.startswith("#"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


async def apply_migrations(db_url: str) -> str:
    """Run scripts/migrate.py in-process and return the resulting schema version."""
    conn = await asyncpg.connect(db_url, command_timeout=300)
    try:
        from migrate import (  # noqa: PLC0415
            ADVISORY_LOCK_KEY, apply_migration, ensure_bootstrap, fetch_applied,
        )

        await ensure_bootstrap(conn)
        await conn.execute("SELECT pg_advisory_lock($1)", ADVISORY_LOCK_KEY)
        try:
            applied = await fetch_applied(conn)
            migrations = discover_migrations()
            pending = [m for m in migrations if m["version"] not in applied]

            if not pending:
                print(f"    Schema already current at {migrations[-1]['version']}.")
                return migrations[-1]["version"]

            print(f"    Applying {len(pending)} migration(s):")
            for m in pending:
                duration = await apply_migration(conn, m)
                print(f"      ok  {m['version']:<6} {m['name']:<34} {duration:>6}ms")
            return pending[-1]["version"]
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", ADVISORY_LOCK_KEY)
    finally:
        await conn.close()


async def run_setup(db_url: str, do_seed: bool, migrate_only: bool):
    print("[*] Connecting to remote PostgreSQL...")
    print(f"    Target: {redact(db_url).split('@')[-1]}")

    init_sql_path = ROOT_DIR / "db" / "init.sql"
    seed_sql_path = ROOT_DIR / "db" / "seed.sql"

    if not init_sql_path.exists():
        raise FileNotFoundError(f"Could not find schema file at {init_sql_path}")

    try:
        conn = await asyncpg.connect(db_url, command_timeout=600)
    except Exception as exc:
        print(f"\n[ERROR] Connection failed: {exc}")
        print("\nPlease verify:")
        print("  1. Did you reveal and replace the placeholder password in the Service URI?")
        print("  2. Is the remote database status currently 'Running'?")
        print("  3. Does the TLS mode in the DSN match the provider?")
        raise SystemExit(1) from exc

    print("[OK] Connected.")

    try:
        step = 0
        # bootstrap + migrate (+ seed). migrate_only skips straight to migrate.
        total_steps = 1 if migrate_only else (3 if do_seed else 2)

        if not migrate_only:
            step += 1
            print(f"\n[*] Step {step}/{total_steps}: Bootstrapping extensions...")
            await conn.execute(init_sql_path.read_text(encoding="utf-8"))
            print("[OK] pgvector + uuid-ossp available.")

        step += 1
        print(f"\n[*] Step {step}/{total_steps}: Applying db/migrations/...")
        schema_version = await apply_migrations(db_url)
        print(f"[OK] Schema at {schema_version}.")

        if do_seed and not migrate_only:
            if not seed_sql_path.exists():
                print("[!] seed.sql not found, skipping seed step.")
            else:
                print(f"\n[*] Seeding demo catalog ({seed_sql_path.stat().st_size / 1e6:.1f} MB)...")
                print("    This truncates commerce tables. Never run against live data.")
                await conn.execute(seed_sql_path.read_text(encoding="utf-8"))
                print("[OK] Seed applied.")

        # ── Verification: assert, don't just print ──────────────────────────
        products = await conn.fetchval("SELECT COUNT(*) FROM products")
        users = await conn.fetchval("SELECT COUNT(*) FROM users")
        sellers = await conn.fetchval("SELECT COUNT(*) FROM seller_profiles")
        applied = await conn.fetchval("SELECT COUNT(*) FROM schema_migrations")
        page_tables = await conn.fetchval(
            "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' "
            "AND tablename LIKE 'seller_pages'"
        )

        print("\n" + "=" * 60)
        print("REMOTE DATABASE SETUP COMPLETE")
        print("=" * 60)
        print(f"  Schema version:    {schema_version} ({applied} migration(s) applied)")
        print(f"  Registered users: {users}")
        print(f"  Sellers:          {sellers}")
        print(f"  Catalog products: {products}")
        print(f"  Seller pages:     {'ready' if page_tables else 'MISSING'}")
        print("=" * 60)

        problems = []
        if not page_tables:
            problems.append("seller_pages table missing - migrations did not complete")
        if applied == 0:
            problems.append("no migrations recorded")
        if not migrate_only and not do_seed and products == 0:
            print("\n[!] No products present. Run without --no-seed to load the demo catalog.")
        if problems:
            for p in problems:
                print(f"[ERROR] {p}")
            raise SystemExit(1)

    except SystemExit:
        raise
    except Exception as exc:
        print(f"\n[ERROR] Setup failed: {type(exc).__name__}: {exc}")
        raise SystemExit(1) from exc
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Initialize, migrate and seed a remote Vyapari PostgreSQL database.",
    )
    parser.add_argument("--db-url", type=str, help="Full PostgreSQL Service URI")
    parser.add_argument("--no-seed", action="store_true", help="Apply schema only, skip the 41MB demo seed")
    parser.add_argument("--migrate-only", action="store_true", help="Only apply pending migrations")
    args = parser.parse_args()

    db_url = args.db_url or os.getenv("DATABASE_URL") or load_env_database_url()

    if not db_url or "CLICK_TO:REVEAL_PASSWORD" in db_url or "<PASSWORD>" in db_url:
        print("[!] Missing or placeholder database URL.")
        print("\nUsage:")
        print('  python scripts/setup_remote_db.py --db-url "postgres://user:PASSWORD@host:5432/db?sslmode=require"')
        print("\nOr set DATABASE_URL in your .env file and run:")
        print("  python scripts/setup_remote_db.py")
        sys.exit(1)

    asyncio.run(run_setup(db_url, do_seed=not args.no_seed, migrate_only=args.migrate_only))


if __name__ == "__main__":
    main()
