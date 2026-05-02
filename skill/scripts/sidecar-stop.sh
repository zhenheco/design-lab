#!/usr/bin/env bash
# Usage: sidecar-stop.sh
# 停止 design-lab sidecar daemon，清 PID file。
set -euo pipefail

PID_DIR="${HOME}/.claude/state/design-lab"
PID_FILE="${PID_DIR}/sidecar.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "no PID file at $PID_FILE — sidecar likely not running"
    exit 0
fi

PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
if [ -z "$PID" ]; then
    echo "PID file empty — cleaning up"
    rm -f "$PID_FILE"
    exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
    echo "PID $PID not alive — cleaning stale PID file"
    rm -f "$PID_FILE"
    exit 0
fi

echo "Stopping sidecar (PID $PID)..."
kill "$PID"

for i in $(seq 1 10); do
    if ! kill -0 "$PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "sidecar stopped"
        exit 0
    fi
    sleep 0.5
done

echo "process didn't exit, force kill..."
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "sidecar force-killed"
