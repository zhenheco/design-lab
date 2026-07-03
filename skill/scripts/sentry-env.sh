#!/usr/bin/env bash
# Load optional Sentry runtime env for the local sidecar.

load_sentry_dsn() {
    if [ -n "${SENTRY_DSN:-}" ]; then
        return 0
    fi

    if ! command -v op > /dev/null 2>&1; then
        return 0
    fi

    local timeout_bin
    if command -v timeout > /dev/null 2>&1; then
        timeout_bin="timeout"
    elif command -v gtimeout > /dev/null 2>&1; then
        timeout_bin="gtimeout"
    else
        return 0
    fi

    local timeout_seconds
    timeout_seconds="${SENTRY_OP_READ_TIMEOUT_SECONDS:-1}"
    case "$timeout_seconds" in
        ''|*[!0-9]*)
            timeout_seconds=1
            ;;
    esac
    if [ "$timeout_seconds" -le 0 ]; then
        return 0
    fi

    local dsn
    dsn="$("$timeout_bin" "$timeout_seconds" op read 'op://Dev/Sentry DSN design-lab-sidecar/credential' 2>/dev/null || true)"
    if [ -n "$dsn" ]; then
        export SENTRY_DSN="$dsn"
    fi
}
