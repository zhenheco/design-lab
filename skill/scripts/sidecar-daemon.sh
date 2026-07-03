#!/usr/bin/env bash
# Usage: sidecar-daemon.sh [--ensure-token-only]
# Foreground launcher for the design-lab sidecar under launchd.
set -euo pipefail

STATE_DIR="${HOME}/.claude/state/design-lab"
TOKEN_FILE="${STATE_DIR}/api-token"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="${DESIGN_LAB_VAULT_PATH:-${HOME}/Documents/CC Cli/design-library}"

ensure_token() {
    mkdir -p "$STATE_DIR"

    if [ -s "$TOKEN_FILE" ]; then
        chmod 600 "$TOKEN_FILE"
        return 0
    fi

    local token
    token="$(openssl rand -hex 32)"
    umask 077
    printf '%s\n' "$token" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
}

if [ "${1:-}" = "--ensure-token-only" ]; then
    ensure_token
    exit 0
fi

ensure_token
read -r DESIGN_LAB_API_TOKEN < "$TOKEN_FILE"
export DESIGN_LAB_API_TOKEN
export DESIGN_LAB_VAULT_PATH="$VAULT"

# launchd 啟動時 cwd=/，需切到 repo root 讓 `node --import tsx` 解析到 node_modules/tsx
cd "${SKILL_DIR}/.." || exit 1

exec node --import tsx -e "
import { startServer } from '$SKILL_DIR/sidecar/server.ts';
startServer(5174, '127.0.0.1').catch((error) => {
    console.error(error);
    process.exit(1);
});
"
