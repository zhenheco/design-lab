#!/usr/bin/env bash
# Usage: check-schema.sh <vault-path>
# Exit codes: 0 = OK, 2 = migration needed, 1 = error
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
[ -d "$VAULT" ] || { echo "ERROR: vault not found: $VAULT" >&2; exit 1; }

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURRENT=$(node -e "import('$SKILL_DIR/lib/schema.js').then(m => console.log(m.CURRENT_SCHEMA_VERSION))")

# 找所有 markdown 的最小 schema_version（只接受純非負整數，防 quoted/text value 讓 -eq 比較炸）
OLDEST=$(grep -rh "^schema_version:" "$VAULT" 2>/dev/null \
    | awk '{print $2}' \
    | grep -E '^[0-9]+$' \
    | sort -n \
    | head -1 || true)

if [ -z "$OLDEST" ]; then
    echo "OK: schema v$CURRENT (no files yet)"
    exit 0
fi

if [ "$OLDEST" -eq "$CURRENT" ]; then
    echo "OK: schema v$CURRENT"
    exit 0
elif [ "$OLDEST" -lt "$CURRENT" ]; then
    echo "MIGRATION_NEEDED: vault has v$OLDEST, skill expects v$CURRENT" >&2
    echo "Run: bash $SKILL_DIR/scripts/migrate-v${OLDEST}-to-v${CURRENT}.sh \"$VAULT\"" >&2
    exit 2
else
    echo "ERROR: vault schema v$OLDEST > skill v$CURRENT (downgrade not supported)" >&2
    exit 1
fi
