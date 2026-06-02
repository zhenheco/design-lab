#!/usr/bin/env bash
# Usage: launchd-uninstall.sh
# Unload and remove the design-lab sidecar LaunchAgent.
set -euo pipefail

LABEL="co.zhenhe.designlab.sidecar"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_TARGET="gui/$(id -u)"

launchctl bootout "${USER_TARGET}/${LABEL}" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "launchd-uninstall: removed $LABEL"
echo "launchd-uninstall: plist removed from $PLIST_PATH"
