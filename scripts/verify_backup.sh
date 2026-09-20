#!/usr/bin/env bash
# ==============================================================================
# Vyapari PostgreSQL Backup Verification & DR Drill Script
# ==============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
TEST_DB_URL="${TEST_DATABASE_URL:-postgresql://vyapari_admin:vyapari_secure_password@localhost:5432/vyapari_dr_test}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' does not exist."
  exit 1
fi

echo "=== Starting DR Restoration Drill ==="
echo "Target Backup: ${BACKUP_FILE}"
echo "Test Database: ${TEST_DB_URL}"

# 1. Reset temporary test database
echo "1. Recreating clean test database..."
psql "${TEST_DB_URL%/*}/postgres" -c "DROP DATABASE IF EXISTS vyapari_dr_test;"
psql "${TEST_DB_URL%/*}/postgres" -c "CREATE DATABASE vyapari_dr_test;"

# 2. Execute pg_restore
echo "2. Restoring custom dump via pg_restore..."
pg_restore \
  --dbname="${TEST_DB_URL}" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "${BACKUP_FILE}"

echo "3. Verifying database integrity..."
# Check foreign key validation status
UNVALIDATED_CONSTRAINTS=$(psql "${TEST_DB_URL}" -t -A -c "SELECT count(*) FROM pg_constraint WHERE NOT convalidated;")
if [ "${UNVALIDATED_CONSTRAINTS}" -ne 0 ]; then
  echo "FAILED: Found ${UNVALIDATED_CONSTRAINTS} invalid foreign key constraints!"
  exit 1
fi

# Check critical table row counts
echo "Table record counts:"
psql "${TEST_DB_URL}" -c "
  SELECT 
    (SELECT count(*) FROM users) as users_count,
    (SELECT count(*) FROM products) as products_count,
    (SELECT count(*) FROM orders) as orders_count,
    (SELECT count(*) FROM categories) as categories_count;
"

# Check sample order join
echo "Verifying relational integrity (orders <-> order_items <-> products)..."
JOIN_INTEGRITY=$(psql "${TEST_DB_URL}" -t -A -c "
  SELECT count(*) 
  FROM orders o 
  JOIN order_items oi ON o.id = oi.order_id 
  LEFT JOIN products p ON oi.product_id = p.id 
  WHERE p.id IS NULL;
")

if [ "${JOIN_INTEGRITY}" -ne 0 ]; then
  echo "FAILED: Found ${JOIN_INTEGRITY} orphaned order items with missing products!"
  exit 1
fi

echo "=== DR Restoration Drill PASSED Successfully ==="
