#!/usr/bin/env bash
# Usage: sidecar-start.sh
# 啟動 design-lab sidecar daemon (port 5174) + dashboard mount。
# PID file: ~/.claude/state/design-lab/sidecar.pid
set -euo pipefail

VAULT="${DESIGN_LAB_VAULT_PATH:-$HOME/Documents/CC Cli/design-library}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="${HOME}/.claude/state/design-lab"
PID_FILE="${PID_DIR}/sidecar.pid"
LOG_FILE="${TMPDIR:-/tmp}/design-lab-sidecar.log"
SIDECAR_URL="http://127.0.0.1:5174"

[ -d "$VAULT" ] || {
    echo "vault not found: $VAULT" >&2
    echo "Run: bash $SKILL_DIR/scripts/init-library.sh \"$VAULT\"" >&2
    exit 1
}

mkdir -p "$PID_DIR"

if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "sidecar already running (PID $OLD_PID)"
        echo "Open: $SIDECAR_URL"
        exit 0
    else
        echo "stale PID file detected (PID $OLD_PID dead) — recovering..."
        rm -f "$PID_FILE"
    fi
fi

DASHBOARD_DIST="$SKILL_DIR/dashboard/dist/server/entry.mjs"
if [ ! -f "$DASHBOARD_DIST" ]; then
    echo "dashboard dist missing — running npm install + build..."
    (cd "$SKILL_DIR/dashboard" && npm install --silent && npm run build) || {
        echo "dashboard build failed; sidecar will start API-only" >&2
    }
fi

echo "Starting sidecar..."
DESIGN_LAB_VAULT_PATH="$VAULT" nohup node --import tsx --input-type=module -e "
import { startServer } from '$SKILL_DIR/sidecar/server.ts';
startServer(5174, '127.0.0.1').catch(err => { console.error(err); process.exit(1); });
" > "$LOG_FILE" 2>&1 &
SIDECAR_PID=$!
echo "$SIDECAR_PID" > "$PID_FILE"

for i in $(seq 1 20); do
    if curl -sf -o /dev/null "$SIDECAR_URL/api/clients" 2>/dev/null; then
        echo "sidecar ready (PID $SIDECAR_PID)"
        echo "Open: $SIDECAR_URL"
        echo "Logs: $LOG_FILE"
        exit 0
    fi
    sleep 0.5
done

echo "sidecar started but didn't respond within 10s; check $LOG_FILE" >&2
exit 1
