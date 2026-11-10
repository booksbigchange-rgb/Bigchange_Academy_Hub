#!/usr/bin/env bash
# One command for the database rule tests: starts a throwaway PostgreSQL, loads the Supabase stand-ins,
# applies every migration in order, runs tests/sql/run_rls_tests.sh, then deletes the database.
# Needs PostgreSQL 16 server binaries (initdb, pg_ctl) and psql. Touches no real project.
# Usage: tests/sql/run_local.sh        (as root it re-runs itself as the "postgres" user)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$DIR/../.." && pwd)"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb)")"
if [ "$(id -u)" = 0 ]; then
  COPY="$(mktemp -d)"; cp -r "$ROOT/supabase" "$ROOT/tests" "$COPY/"; chmod -R a+rX "$COPY"
  trap 'rm -rf "$COPY"' EXIT
  runuser -u postgres -- env PG_BIN="$BIN" bash "$COPY/tests/sql/run_local.sh"; exit $?
fi
WORK="$(mktemp -d)"; PORT="${PGTEST_PORT:-5544}"
trap '"$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
"$BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
ARGS="-h $WORK -p $PORT -U postgres"
psql $ARGS -q -v ON_ERROR_STOP=1 -f "$DIR/auth_stubs.sql" >/dev/null
for m in "$ROOT"/supabase/migrations/*.sql; do
  psql $ARGS -q -v ON_ERROR_STOP=1 -f "$m" >/dev/null 2>"$WORK/err" || { echo "Migration failed: $(basename "$m")"; cat "$WORK/err"; exit 1; }
done
echo "Layout: $(psql $ARGS -At -c "select count(*) from pg_tables where schemaname='public' and tablename like 'academy_%'") tables, $(psql $ARGS -At -c "select count(*) from pg_policies where schemaname='public'") policies"
bash "$DIR/run_rls_tests.sh" $ARGS
