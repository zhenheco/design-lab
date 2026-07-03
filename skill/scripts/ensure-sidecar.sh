#!/usr/bin/env bash
# Usage: ensure-sidecar.sh
# Ensure design-lab sidecar is running on 127.0.0.1:5174.
set -euo pipefail

STATE_DIR="${HOME}/.claude/state/design-lab"
PID_FILE="${STATE_DIR}/sidecar.pid"
TOKEN_FILE="${STATE_DIR}/api-token"
LOCK_DIR="${STATE_DIR}/spawn.lock"
PORT="${DESIGN_LAB_SIDECAR_PORT:-5174}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
VAULT="${DESIGN_LAB_VAULT_PATH:-${HOME}/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${TMPDIR:-/tmp}/design-lab-sidecar.log"

source "$SKILL_DIR/scripts/sentry-env.sh"

mkdir -p "$STATE_DIR"

if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    exit 0
fi

wait_for_concurrent_spawn() {
    for _ in $(seq 1 30); do
        if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
            exit 0
        fi
        sleep 0.5
    done
}

acquire_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$" > "$LOCK_DIR/holder"
        return 0
    fi

    HOLDER_PID="$(cat "$LOCK_DIR/holder" 2>/dev/null || echo "")"
    if [ -z "$HOLDER_PID" ]; then
        wait_for_concurrent_spawn
        echo "ensure-sidecar: timeout waiting for concurrent spawn" >&2
        return 1
    fi

    if kill -0 "$HOLDER_PID" 2>/dev/null; then
        wait_for_concurrent_spawn
        echo "ensure-sidecar: timeout waiting for concurrent spawn" >&2
        return 1
    fi

    echo "ensure-sidecar: removing stale spawn lock held by dead PID $HOLDER_PID" >&2
    rm -rf "$LOCK_DIR"
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$" > "$LOCK_DIR/holder"
        return 0
    fi

    echo "ensure-sidecar: lock recovery failed; manual rm needed: $LOCK_DIR" >&2
    return 1
}

if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null \
        && curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        exit 0
    fi
    rm -f "$PID_FILE"
fi

if ! acquire_lock; then
    exit 1
fi

trap 'rm -f "$LOCK_DIR/holder" 2>/dev/null || true; rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

DASHBOARD_DIST="$SKILL_DIR/dashboard/dist/server/entry.mjs"
if [ ! -f "$DASHBOARD_DIST" ]; then
    echo "dashboard dist missing — running npm install + build..." >&2
    (cd "$SKILL_DIR/dashboard" && npm install --silent && npm run build) || \
        echo "dashboard build failed; sidecar will start API-only" >&2
fi

TOKEN="$(openssl rand -hex 32)"
umask 077
echo "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
load_sentry_dsn

DESIGN_LAB_VAULT_PATH="$VAULT" DESIGN_LAB_API_TOKEN="$TOKEN" \
nohup node --import tsx --input-type=module -e "
import { startServer } from '$SKILL_DIR/sidecar/server.ts';
startServer(Number(process.env.DESIGN_LAB_SIDECAR_PORT || 5174), '127.0.0.1').catch(err => { console.error(err); process.exit(1); });
" > "$LOG_FILE" 2>&1 &
SIDECAR_PID=$!
echo "$SIDECAR_PID" > "$PID_FILE"

for _ in $(seq 1 20); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        exit 0
    fi

    if ! kill -0 "$SIDECAR_PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "ensure-sidecar: sidecar process exited before health check; see $LOG_FILE" >&2
        exit 1
    fi

    sleep 0.5
done

echo "ensure-sidecar: spawn timeout (10s); see $LOG_FILE" >&2
exit 1
