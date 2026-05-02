#!/usr/bin/env bash
# Usage: init-library.sh <vault-path>
# Idempotent: 已存在的檔案不覆蓋
set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$VAULT"/{cases,anti-library,candidates,scenario-overrides}

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

echo "OK: design-library initialized at $VAULT"
