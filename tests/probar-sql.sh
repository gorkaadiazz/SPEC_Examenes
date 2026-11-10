#!/usr/bin/env bash
# Prueba las migraciones y el test de RLS en un Postgres temporal, sin Docker.
#   bash tests/probar-sql.sh
# Necesita los binarios de PostgreSQL (initdb, pg_ctl, psql).
# Con Supabase CLI es mejor:  supabase db reset && psql ... -f tests/rls.sql
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$BIN" ] && export PATH="$BIN:$PATH"
DIR=$(mktemp -d)
trap 'pg_ctl -D "$DIR/datos" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then chown -R postgres "$DIR"; COMO="runuser -u postgres --"; else COMO=""; fi
$COMO initdb -D "$DIR/datos" -U postgres -A trust >/dev/null
$COMO pg_ctl -D "$DIR/datos" -o "-k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL="$COMO psql -h $DIR -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null"
$PSQL -f tests/supabase-simulado.sql
for f in supabase/migrations/*.sql; do echo "· $f"; $PSQL -f "$f"; done
echo "· tests/rls.sql"
$PSQL -f tests/rls.sql
