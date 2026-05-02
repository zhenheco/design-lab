#!/usr/bin/env bash
# Migrate vault from schema v1 (flat cases/) to v2 (clients/_personal/)
# Usage: migrate-v1-to-v2.sh <vault-path>
# Exit 0 = OK / repeated runs also OK, 1 = error

set -euo pipefail

VAULT="${1:?usage: $0 <vault-path>}"
[ -d "$VAULT" ] || { echo "ERROR: vault not found: $VAULT" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SKILL_DIR/templates/client-meta.yaml"

VAULT_ABS="$(cd "$VAULT" && pwd)"
PARENT="$(dirname "$VAULT_ABS")"
BASE="$(basename "$VAULT_ABS")"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PARENT/$BASE.v1-backup-$TS"

has_root_markdown() {
    local dir="$1"
    find "$dir" -maxdepth 1 -name '*.md' 2>/dev/null | head -1
}

if [ -f "$VAULT_ABS/clients/_personal/meta.yaml" ] && \
   [ -z "$(has_root_markdown "$VAULT_ABS/cases")" ] && \
   [ -z "$(has_root_markdown "$VAULT_ABS/anti-library")" ]; then
    echo "OK: vault already migrated to v2 (skipping, no backup created)"
    exit 0
fi

echo "Backup created at: $BACKUP" >&2
cp -R "$VAULT_ABS" "$BACKUP"

mkdir -p \
    "$VAULT_ABS/clients/_personal/cases" \
    "$VAULT_ABS/clients/_personal/anti-library"

for subdir in cases anti-library; do
    src="$VAULT_ABS/$subdir"
    dst="$VAULT_ABS/clients/_personal/$subdir"

    if [ -d "$src" ]; then
        while IFS= read -r -d '' file; do
            mv "$file" "$dst/"
        done < <(find "$src" -maxdepth 1 -name '*.md' -print0)
    fi
done

while IFS= read -r -d '' file; do
    if grep -q '^schema_version: 2$' "$file" && grep -q '^client: _personal$' "$file"; then
        continue
    fi

    awk '
        BEGIN {
            in_frontmatter = 0
            frontmatter_sections = 0
            saw_schema = 0
            saw_client = 0
        }
        /^---$/ {
            frontmatter_sections++
            if (frontmatter_sections == 1) {
                in_frontmatter = 1
                print
                next
            }
            if (frontmatter_sections == 2) {
                in_frontmatter = 0
                if (!saw_schema) print "schema_version: 2"
                if (!saw_client) print "client: _personal"
                print
                next
            }
        }
        in_frontmatter && /^schema_version:/ {
            print "schema_version: 2"
            saw_schema = 1
            next
        }
        in_frontmatter && /^client:/ {
            print "client: _personal"
            saw_client = 1
            next
        }
        {
            print
        }
    ' "$file" > "$file.tmp"
    mv "$file.tmp" "$file"
done < <(find "$VAULT_ABS/clients/_personal" -name '*.md' -print0)

META="$VAULT_ABS/clients/_personal/meta.yaml"
if [ ! -f "$META" ]; then
    CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    sed \
        -e "s|PLACEHOLDER_SLUG|_personal|g" \
        -e "s|PLACEHOLDER_NAME|我的品牌（未分類）|g" \
        -e "s|PLACEHOLDER_TYPE|self|g" \
        -e "s|PLACEHOLDER_CREATED_AT|$CREATED_AT|g" \
        "$TEMPLATE" > "$META"
fi

echo "OK: migrated $VAULT_ABS to v2"
