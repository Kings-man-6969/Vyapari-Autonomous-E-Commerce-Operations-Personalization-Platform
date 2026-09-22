#!/usr/bin/env python3
"""
Vyapari Platform — Remote Database Setup & Seeding Utility
Usage:
    python scripts/setup_remote_db.py --db-url "postgres://avnadmin:<PASSWORD>@pg-2eb215e0-k23-8eae.b.aivencloud.com:15797/defaultdb?sslmode=require"
Or simply set DATABASE_URL in your root .env and run:
    python scripts/setup_remote_db.py
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


def load_env_database_url() -> str | None:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return None
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


async def run_setup(db_url: str):
    print(f"[*] Connecting to remote PostgreSQL...")
    print(f"    URL: {db_url.split('@')[-1] if '@' in db_url else 'configured DSN'}")

    root_dir = Path(__file__).resolve().parent.parent
    init_sql_path = root_dir / "db" / "init.sql"
    seed_sql_path = root_dir / "db" / "seed.sql"

    if not init_sql_path.exists():
        print(f"[ERROR] Could not find schema file at {init_sql_path}")
        return

    try:
        conn = await asyncpg.connect(db_url)
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("\nPlease verify:")
        print("1. Did you reveal and replace the actual password in the Service URI?")
        print("2. Is the Aiven database status currently 'Running'?")
        return

    print("[OK] Connected to database successfully!")

    try:
        # Step 1: Initialize Schema
        print("\n[*] Step 1/2: Initializing Schema (tables, extensions, constraints)...")
        with open(init_sql_path, "r", encoding="utf-8") as f:
            init_sql = f.read()

        # Run init statements
        await conn.execute(init_sql)
        print("[OK] Tables and pgvector extension initialized successfully!")

        # Step 2: Seed Database
        if seed_sql_path.exists():
            print("\n[*] Step 2/2: Seeding initial data (catalog, brands, users)...")
            with open(seed_sql_path, "r", encoding="utf-8") as f:
                seed_sql = f.read()
            await conn.execute(seed_sql)
            print("[OK] Database seeded successfully!")
        else:
            print("[!] seed.sql not found, skipping seed step.")

        # Verification query
        product_count = await conn.fetchval("SELECT COUNT(*) FROM products")
        user_count = await conn.fetchval("SELECT COUNT(*) FROM users")
        seller_count = await conn.fetchval("SELECT COUNT(*) FROM seller_profiles")

        print("\n" + "=" * 60)
        print("🎉 REMOTE DATABASE SETUP COMPLETE!")
        print("=" * 60)
        print(f"  • Registered Users:    {user_count}")
        print(f"  • Verified Sellers:    {seller_count}")
        print(f"  • Catalog Products:    {product_count}")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] Error during database setup: {e}")
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="Initialize and seed remote Vyapari PostgreSQL database.")
    parser.add_argument("--db-url", type=str, help="Full PostgreSQL Service URI with password")
    args = parser.parse_args()

    db_url = args.db_url or os.getenv("DATABASE_URL") or load_env_database_url()

    if not db_url or "CLICK_TO:REVEAL_PASSWORD" in db_url or "<PASSWORD>" in db_url:
        print("[!] Missing valid database URL.")
        print("\nUsage:")
        print('  python scripts/setup_remote_db.py --db-url "postgres://avnadmin:<PASSWORD>@pg-2eb215e0-k23-8eae.b.aivencloud.com:15797/defaultdb?sslmode=require"')
        print("\nOr update DATABASE_URL in your .env file and run:")
        print("  python scripts/setup_remote_db.py")
        sys.exit(1)

    asyncio.run(run_setup(db_url))


if __name__ == "__main__":
    main()
