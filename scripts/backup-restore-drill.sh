#!/usr/bin/env bash
# Proves a backup can actually be restored — run this against a COPY, never production.
#   SOURCE_URL=postgres://… RESTORE_URL=postgres://…/empty_scratch_db ./scripts/backup-restore-drill.sh
# It dumps SOURCE, restores into RESTORE (must be an empty database you can lose), then
# compares row counts for every table and checks the append-only triggers survived.
set -euo pipefail
: "${SOURCE_URL:?set SOURCE_URL}"; : "${RESTORE_URL:?set RESTORE_URL}"
[ "$SOURCE_URL" != "$RESTORE_URL" ] || { echo "SOURCE and RESTORE must differ"; exit 1; }
DUMP="$(mktemp -t swd-drill-XXXXXX.dump)"; trap 'rm -f "$DUMP"' EXIT

pg_dump --format=custom --no-owner --no-privileges "$SOURCE_URL" -f "$DUMP"
echo "dump: $(du -h "$DUMP" | cut -f1)"
pg_restore --no-owner --no-privileges --exit-on-error -d "$RESTORE_URL" "$DUMP"

counts() { psql "$1" -Atc "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" |
  while read -r t; do echo "$t $(psql "$1" -Atc "select count(*) from \"$t\"")"; done; }
diff <(counts "$SOURCE_URL") <(counts "$RESTORE_URL") && echo "row counts: identical"

want=$(psql "$SOURCE_URL" -Atc "select count(*) from pg_trigger where not tgisinternal")
got=$(psql "$RESTORE_URL" -Atc "select count(*) from pg_trigger where not tgisinternal")
[ "$want" = "$got" ] && echo "triggers: $got restored" || { echo "TRIGGER MISMATCH $want vs $got"; exit 1; }
echo "DRILL PASSED"
