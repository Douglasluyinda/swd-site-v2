#!/usr/bin/env bash
# Applies the SWD Business OS database migrations (0004 … 0011) to an existing SWD database.
#
#   DATABASE_URL='postgres://…direct (non-pooled) Neon connection string…' ./scripts/apply-business-os-migrations.sh
#
# Safe by design:
#   * refuses to run twice (checks whether the first migration is already there)
#   * takes a full backup file first (set SKIP_DUMP=1 only if you made a Neon branch/snapshot instead)
#   * applies everything in ONE transaction — if any statement fails, nothing is changed
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the production connection string}"
cd "$(dirname "$0")/.."

already=$(psql "$DATABASE_URL" -Atc "select count(*) from information_schema.columns where table_schema='public' and table_name='admins' and column_name='staff_role'")
if [ "$already" != "0" ]; then echo "Business OS migrations are already applied here. Nothing to do."; exit 0; fi
psql "$DATABASE_URL" -Atc "select 1 from information_schema.tables where table_schema='public' and table_name='products'" | grep -q 1 \
  || { echo "This does not look like the SWD database (no products table). Stopping."; exit 1; }

if [ "${SKIP_DUMP:-0}" != "1" ]; then
  OUT="backup-before-business-os-$(date +%Y%m%d-%H%M%S).dump"
  pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" -f "$OUT"
  echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1)) — keep it somewhere safe."
else
  echo "SKIP_DUMP=1: relying on your own Neon branch/snapshot."
fi

FILES=$(ls drizzle/00{04,05,06,07,08,09,10,11}_*.sql)
echo "Applying:"; echo "$FILES" | sed 's/^/  /'
cat $FILES | psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -q

echo "Check:"
psql "$DATABASE_URL" -Atc "select 'owner accounts: '||count(*) from admins where staff_role='OWNER'" \
  -c "select 'append-only triggers: '||count(*) from pg_trigger where not tgisinternal" \
  -c "select 'stock ledger opening rows: '||count(*) from inventory_movements"
echo "DONE. Now deploy/redeploy the app and follow docs/BUSINESS_OS_READINESS.md section 4, step 5."
