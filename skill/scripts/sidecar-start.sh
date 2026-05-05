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

bash "${SKILL_DIR}/scripts/ensure-sidecar.sh" || exit $?

SIDECAR_PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
if [ -n "$SIDECAR_PID" ]; then
    echo "sidecar ready (PID $SIDECAR_PID)"
else
    echo "sidecar ready"
fi
echo "Open: $SIDECAR_URL"
echo "Logs: $LOG_FILE"
