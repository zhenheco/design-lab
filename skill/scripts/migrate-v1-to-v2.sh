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
LOCK_DIR="$VAULT_ABS/.migration.lock"

if [ ! -f "$VAULT_ABS/personal-style-guide.md" ] && \
   [ ! -d "$VAULT_ABS/cases" ] && \
   [ ! -d "$VAULT_ABS/anti-library" ] && \
   [ ! -d "$VAULT_ABS/clients" ]; then
    echo "ERROR: $VAULT does not look like a design-lab vault" >&2
    echo "Expected at least one of: personal-style-guide.md, cases/, anti-library/, clients/" >&2
    exit 1
fi

has_root_markdown() {
    local dir="$1"
    find "$dir" -maxdepth 1 -name '*.md' 2>/dev/null | head -1
}

count_root_markdown() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        echo 0
        return
    fi
    find "$dir" -maxdepth 1 -name '*.md' | wc -l | tr -d ' '
}

ALREADY_MIGRATED=0
if [ -f "$VAULT_ABS/clients/_personal/meta.yaml" ]; then
    ALREADY_MIGRATED=1
fi

NEW_CASES_COUNT="$(count_root_markdown "$VAULT_ABS/cases")"
NEW_ANTI_LIBRARY_COUNT="$(count_root_markdown "$VAULT_ABS/anti-library")"
NEW_FILES_COUNT=$((NEW_CASES_COUNT + NEW_ANTI_LIBRARY_COUNT))

if [ "$ALREADY_MIGRATED" -eq 1 ] && [ "$NEW_FILES_COUNT" -eq 0 ]; then
    echo "OK: vault already migrated to v2 (skipping, no backup created)"
    exit 0
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "ERROR: another migration in progress (lock: $LOCK_DIR)" >&2
    echo "If a previous migration crashed, manually remove: rmdir $LOCK_DIR" >&2
    exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

if [ "$ALREADY_MIGRATED" -eq 0 ]; then
    echo "Backup created at: $BACKUP" >&2
    trap 'rm -rf "$BACKUP"' ERR
    cp -R "$VAULT_ABS" "$BACKUP"
    trap - ERR
else
    echo "Note: vault already migrated. Processing $NEW_FILES_COUNT new file(s) (no backup)." >&2
fi

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
        END {
            if (in_frontmatter) {
                print "ERROR: unterminated frontmatter in input" > "/dev/stderr"
                exit 1
            }
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
