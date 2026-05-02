#!/usr/bin/env bash
# Usage: init-library.sh <vault-path>
# Idempotent: 已存在的檔案不覆蓋
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p \
    "$VAULT/scenario-overrides" \
    "$VAULT/candidates" \
    "$VAULT/.index" \
    "$VAULT/clients/_personal/cases" \
    "$VAULT/clients/_personal/anti-library"

# personal-style-guide
if [ ! -f "$VAULT/personal-style-guide.md" ]; then
    cp "$SKILL_DIR/templates/personal-style-guide.md" "$VAULT/personal-style-guide.md"
    echo "Created: $VAULT/personal-style-guide.md"
fi

# scenario overrides
for scenario in landing saas-ui brand content; do
    target="$VAULT/scenario-overrides/$scenario.md"
    if [ ! -f "$target" ]; then
        sed "s/SCENARIO_NAME/$scenario/g" "$SKILL_DIR/templates/scenario-override.md" > "$target"
        echo "Created: $target"
    fi
done

# _personal client meta
META="$VAULT/clients/_personal/meta.yaml"
if [ ! -f "$META" ]; then
    CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    sed \
        -e "s|PLACEHOLDER_SLUG|_personal|g" \
        -e "s|PLACEHOLDER_NAME|我的品牌（未分類）|g" \
        -e "s|PLACEHOLDER_TYPE|self|g" \
        -e "s|PLACEHOLDER_CREATED_AT|$CREATED_AT|g" \
        "$SKILL_DIR/templates/client-meta.yaml" > "$META"
    echo "Created: $META"
fi

echo "OK: design-library initialized at $VAULT"
