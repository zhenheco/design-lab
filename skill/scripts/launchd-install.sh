#!/usr/bin/env bash
# Usage: launchd-install.sh
# Install and load the design-lab sidecar LaunchAgent.
set -euo pipefail

LABEL="co.zhenhe.designlab.sidecar"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${SKILL_DIR}/launchd/${LABEL}.plist.template"
SIDECAR_DAEMON="${SKILL_DIR}/scripts/sidecar-daemon.sh"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
LOG_DIR="${DESIGN_LAB_LOG_DIR:-${HOME}/Library/Logs}"
VAULT="${DESIGN_LAB_VAULT_PATH:-${HOME}/Documents/CC Cli/design-library}"
HEALTH_URL="http://127.0.0.1:5174/api/health"
USER_TARGET="gui/$(id -u)"

xml_escape() {
    sed \
        -e 's/&/\&amp;/g' \
        -e 's/</\&lt;/g' \
        -e 's/>/\&gt;/g'
}

sed_escape_replacement() {
    sed -e 's/[\/&]/\\&/g'
}

render_value() {
    printf '%s' "$1" | xml_escape | sed_escape_replacement
}

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
    echo "launchd-install: node not found on PATH" >&2
    exit 1
fi

NODE_DIR="$(dirname "$NODE_BIN")"
PATH_VALUE="${NODE_DIR}:/usr/bin:/bin"

if [ ! -f "$TEMPLATE" ]; then
    echo "launchd-install: template not found: $TEMPLATE" >&2
    exit 1
fi

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

sed \
    -e "s|__SIDECAR_DAEMON_SH__|$(render_value "$SIDECAR_DAEMON")|g" \
    -e "s|__LOG_DIR__|$(render_value "$LOG_DIR")|g" \
    -e "s|__PATH__|$(render_value "$PATH_VALUE")|g" \
    -e "s|__DESIGN_LAB_VAULT_PATH__|$(render_value "$VAULT")|g" \
    "$TEMPLATE" > "$PLIST_PATH"

if command -v plutil > /dev/null 2>&1; then
    plutil -lint "$PLIST_PATH" > /dev/null
fi

launchctl bootout "${USER_TARGET}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$USER_TARGET" "$PLIST_PATH"
launchctl enable "${USER_TARGET}/${LABEL}" 2>/dev/null || true

for _ in $(seq 1 30); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "launchd-install: sidecar healthy at $HEALTH_URL"
        echo "launchd-install: plist installed at $PLIST_PATH"
        echo "launchd-install: logs at $LOG_DIR/designlab-sidecar.{out,err}.log"
        exit 0
    fi
    sleep 0.5
done

echo "launchd-install: health check timed out for $HEALTH_URL" >&2
echo "launchd-install: check logs at $LOG_DIR/designlab-sidecar.{out,err}.log" >&2
exit 1
