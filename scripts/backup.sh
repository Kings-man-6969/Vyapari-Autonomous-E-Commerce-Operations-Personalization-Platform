#!/usr/bin/env bash
# ==============================================================================
# Vyapari PostgreSQL Logical Backup Script (Custom Format)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/vyapari_backups}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="vyapari-backup-${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
BACKUP_BUCKET="${BACKUP_BUCKET:-vyapari-backups}"

mkdir -p "${BACKUP_DIR}"

echo "Starting logical PostgreSQL custom backup: ${BACKUP_PATH}..."

# --format=custom is internally compressed and supports selective pg_restore
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_PATH}"

echo "Backup generated successfully (${BACKUP_PATH}, $(du -h "${BACKUP_PATH}" | cut -f1))."

# If AWS CLI is configured and BACKUP_BUCKET is provided, ship to S3 with KMS encryption
if command -v aws >/dev/null 2>&1 && [ -n "${BACKUP_BUCKET:-}" ]; then
  S3_DEST="s3://${BACKUP_BUCKET}/backups/${BACKUP_FILE}"
  echo "Uploading backup to AWS S3 (${S3_DEST})..."
  
  KMS_OPTS=()
  if [ -n "${BACKUP_KMS_KEY_ID:-}" ]; then
    KMS_OPTS=(--sse aws:kms --sse-kms-key-id "${BACKUP_KMS_KEY_ID}")
  fi

  aws s3 cp "${BACKUP_PATH}" "${S3_DEST}" \
    "${KMS_OPTS[@]}" \
    --storage-class STANDARD_IA
    
  echo "S3 upload complete."
fi

echo "PostgreSQL backup completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")."
