#!/usr/bin/env bash
# Load optional Sentry runtime env for the local sidecar.

load_sentry_dsn() {
    if [ -n "${SENTRY_DSN:-}" ]; then
        return 0
    fi

    if ! command -v op > /dev/null 2>&1; then
        return 0
    fi

    local dsn
    dsn="$(op read 'op://Dev/Sentry DSN design-lab-sidecar/credential' 2>/dev/null || true)"
    if [ -n "$dsn" ]; then
        export SENTRY_DSN="$dsn"
    fi
}
