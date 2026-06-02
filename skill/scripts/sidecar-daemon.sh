#!/usr/bin/env bash
# Usage: sidecar-daemon.sh [--ensure-token-only]
# Foreground launcher for the design-lab sidecar under launchd.
set -euo pipefail

STATE_DIR="${HOME}/.claude/state/design-lab"
TOKEN_FILE="${STATE_DIR}/api-token"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

echo "sidecar-daemon: foreground launcher not implemented yet" >&2
exit 1
